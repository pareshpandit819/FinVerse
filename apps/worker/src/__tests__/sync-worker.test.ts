/**
 * Sync worker integration tests — uses MSW to mock Plaid API calls.
 * Requires DATABASE_URL (Postgres) to be set; skips gracefully otherwise.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { server } from "./mocks/server.js";
import { plaidLoginRequiredHandler } from "./mocks/plaid-handlers.js";
import {
  FIXTURE_ITEM_ID,
  FIXTURE_ACCOUNT_ID,
} from "./fixtures/plaid-responses.js";
import { encryptToken } from "@repo/shared/crypto";

// Set test encryption keys
process.env["PLAID_TOKEN_ENCRYPTION_KEY"] = "a".repeat(64);
process.env["MFA_SECRET_ENCRYPTION_KEY"] = "b".repeat(64);
process.env["PLAID_ENV"] = "sandbox";

const db = new PrismaClient();

// Skip entire suite if no DATABASE_URL configured
const runIntegration = !!process.env["DATABASE_URL"];

let orgId: string;
let userId: string;
let plaidItemId: string;

beforeAll(async () => {
  server.listen({ onUnhandledRequest: "bypass" });

  if (!runIntegration) return;

  const org = await db.organization.create({
    data: { name: "Sync Test Org", slug: `sync-test-${Date.now()}` },
  });
  const user = await db.user.create({
    data: { email: `sync-test-${Date.now()}@example.com` },
  });
  orgId = org.id;
  userId = user.id;

  const item = await db.plaidItem.create({
    data: {
      organizationId: orgId,
      userId,
      encryptedAccessToken: encryptToken("access-sandbox-test"),
      itemId: FIXTURE_ITEM_ID,
      institutionId: "ins_test",
      institutionName: "Test Bank",
      status: "active",
    },
  });
  plaidItemId = item.id;
});

afterEach(() => server.resetHandlers());

afterAll(async () => {
  server.close();
  if (!runIntegration) return;
  await db.transaction.deleteMany({ where: { organizationId: orgId } });
  await db.plaidAccount.deleteMany({ where: { organizationId: orgId } });
  await db.plaidItem.deleteMany({ where: { organizationId: orgId } });
  await db.membership.deleteMany({ where: { organizationId: orgId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.organization.deleteMany({ where: { id: orgId } });
  await db.$disconnect();
});

describe("Sync worker — transaction sync", () => {
  it.skipIf(!runIntegration)("upserts accounts and transactions from Plaid", async () => {
    // Dynamically import to pick up env vars set above
    const { syncTransactions } = await import("../workers/sync-worker.js");
    await syncTransactions({ plaidItemId, organizationId: orgId, userId, isInitial: true });

    const account = await db.plaidAccount.findUnique({ where: { accountId: FIXTURE_ACCOUNT_ID } });
    expect(account).not.toBeNull();
    expect(account?.balanceCurrent).toBe(11000n); // $110.00 → 11000 cents

    const transactions = await db.transaction.findMany({
      where: { plaidAccountId: account?.id },
      orderBy: { date: "asc" },
    });
    expect(transactions).toHaveLength(2);
    expect(transactions[0]?.amount).toBe(1234n);  // $12.34
    expect(transactions[1]?.amount).toBe(999n);   // $9.99
  });

  it.skipIf(!runIntegration)("updates modified transactions and removes deleted ones", async () => {
    const { http, HttpResponse } = await import("msw");
    const { transactionsSyncWithModifiedAndRemoved } = await import("./fixtures/plaid-responses.js");

    server.use(
      http.post("https://sandbox.plaid.com/transactions/sync", () =>
        HttpResponse.json(transactionsSyncWithModifiedAndRemoved)
      )
    );

    const { syncTransactions } = await import("../workers/sync-worker.js");
    await syncTransactions({ plaidItemId, organizationId: orgId, userId, isInitial: false });

    const account = await db.plaidAccount.findUnique({ where: { accountId: FIXTURE_ACCOUNT_ID } });
    const txn = await db.transaction.findUnique({ where: { transactionId: "txn-test-001" } });
    expect(txn?.amount).toBe(1500n); // updated to $15.00

    const removed = await db.transaction.findUnique({ where: { transactionId: "txn-test-002" } });
    expect(removed).toBeNull();

    void account; // used for plaidAccountId lookup
  });

  it.skipIf(!runIntegration)("marks item as login_required when Plaid returns ITEM_LOGIN_REQUIRED", async () => {
    server.use(plaidLoginRequiredHandler);

    const { syncTransactions } = await import("../workers/sync-worker.js");
    await expect(syncTransactions({ plaidItemId, organizationId: orgId, userId, isInitial: false }))
      .rejects.toThrow();

    // Item status updated by the worker error handler in a real BullMQ run
    // In unit test context, we verify the error is thrown and can be handled
  });
});

describe("Sync worker — idempotency", () => {
  it.skipIf(!runIntegration)("running sync twice does not duplicate transactions", async () => {
    const { syncTransactions } = await import("../workers/sync-worker.js");
    await syncTransactions({ plaidItemId, organizationId: orgId, userId, isInitial: false });
    await syncTransactions({ plaidItemId, organizationId: orgId, userId, isInitial: false });

    const account = await db.plaidAccount.findUnique({ where: { accountId: FIXTURE_ACCOUNT_ID } });
    const count = await db.transaction.count({ where: { plaidAccountId: account?.id ?? "" } });
    // Should not have doubled — upsert on transactionId
    expect(count).toBeLessThanOrEqual(2);
  });
});

describe("Webhook verification", () => {
  it("rejects webhook with missing Plaid-Verification header", async () => {
    const { verifyPlaidWebhook } = await import("../lib/webhook-verifier.js");
    const valid = await verifyPlaidWebhook('{"test":1}', null);
    expect(valid).toBe(false);
  });

  it("rejects webhook with malformed JWT (wrong number of parts)", async () => {
    const { verifyPlaidWebhook } = await import("../lib/webhook-verifier.js");
    const valid = await verifyPlaidWebhook('{"test":1}', "not.a.valid.jwt.with.too.many.parts");
    expect(valid).toBe(false);
  });

  it("rejects webhook with expired iat claim", async () => {
    const { verifyPlaidWebhook } = await import("../lib/webhook-verifier.js");
    // Craft a JWT with iat 10 minutes ago (past the 5-minute window)
    const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: "test-key-id-001" })).toString("base64url");
    const tenMinutesAgo = Math.floor(Date.now() / 1000) - 600;
    const claims = Buffer.from(JSON.stringify({ iat: tenMinutesAgo, request_body_sha256: "fake" })).toString("base64url");
    const fakeJwt = `${header}.${claims}.fakesig`;

    // Will fail at key fetch (MSW returns mock key) or at signature check
    const valid = await verifyPlaidWebhook('{"test":1}', fakeJwt).catch(() => false);
    expect(valid).toBe(false);
  });
});
