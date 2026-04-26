import { Worker, type Job } from "bullmq";
import { prisma } from "@repo/db/client";
import type { Prisma } from "@prisma/client";
import { decryptToken } from "@repo/shared/crypto";
import { SyncJobPayloadSchema } from "@repo/shared/schemas";
import { plaidAmountToCents } from "@repo/shared/money";
import { mapPlaidCategory } from "@repo/shared/categorize";
import { logger } from "@repo/shared/logger";
import { plaidClient } from "../lib/plaid.js";
import { redis } from "../lib/redis.js";
import { netWorthQueue, budgetQueue } from "../queues/sync.js";

const SYNC_PAGE_SIZE = 500;

export interface SyncTransactionsInput {
  plaidItemId: string;
  organizationId: string;
  userId: string;
  isInitial: boolean;
}

export async function syncTransactions({
  plaidItemId,
  organizationId,
  userId,
  isInitial,
}: SyncTransactionsInput): Promise<void> {
  const log = logger.child({ plaidItemId, isInitial });

  const item = await prisma.plaidItem.findUnique({ where: { id: plaidItemId } });
  if (!item) throw new Error(`PlaidItem ${plaidItemId} not found`);
  if (item.status === "login_required") {
    log.warn("Skipping sync — item requires re-authentication");
    return;
  }

  const accessToken = decryptToken(item.encryptedAccessToken);
  let cursor = item.transactionCursor ?? undefined;
  let hasMore = true;
  let addedCount = 0;
  let modifiedCount = 0;
  let removedCount = 0;

  log.info({ cursor: cursor ?? "initial" }, "Starting transaction sync");

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
      count: SYNC_PAGE_SIZE,
      options: { include_personal_finance_category: true },
    });

    const { added, modified, removed, next_cursor, has_more } = response.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const txn of added) {
        const account = await tx.plaidAccount.findUnique({
          where: { accountId: txn.account_id },
          select: { id: true },
        });
        if (!account) continue;

        await tx.transaction.upsert({
          where: { transactionId: txn.transaction_id },
          update: {
            amount: plaidAmountToCents(txn.amount),
            name: txn.name,
            merchantName: txn.merchant_name ?? null,
            pending: txn.pending,
            plaidCategories: txn.category ?? [],
            updatedAt: new Date(),
          },
          create: {
            plaidAccountId: account.id,
            organizationId,
            transactionId: txn.transaction_id,
            amount: plaidAmountToCents(txn.amount),
            isoCurrencyCode: txn.iso_currency_code ?? "USD",
            date: new Date(txn.date),
            name: txn.name,
            merchantName: txn.merchant_name ?? null,
            paymentChannel: txn.payment_channel ?? null,
            plaidCategories: txn.category ?? [],
            customCategory: mapPlaidCategory(txn.category ?? []),
            pending: txn.pending,
          },
        });
        addedCount++;
      }

      for (const txn of modified) {
        await tx.transaction.updateMany({
          where: { transactionId: txn.transaction_id },
          data: {
            amount: plaidAmountToCents(txn.amount),
            name: txn.name,
            merchantName: txn.merchant_name ?? null,
            pending: txn.pending,
            plaidCategories: txn.category ?? [],
            updatedAt: new Date(),
          },
        });
        modifiedCount++;
      }

      for (const txn of removed) {
        await tx.transaction.deleteMany({ where: { transactionId: txn.transaction_id } });
        removedCount++;
      }

      await tx.plaidItem.update({
        where: { id: plaidItemId },
        data: { transactionCursor: next_cursor, lastSyncedAt: new Date() },
      });
    });

    cursor = next_cursor;
    hasMore = has_more;
  }

  if (isInitial) {
    await syncAccounts(accessToken, plaidItemId, organizationId);
  }

  log.info({ addedCount, modifiedCount, removedCount }, "Transaction sync complete");

  await netWorthQueue.add(
    "snapshot",
    { organizationId, userId },
    { jobId: `snapshot-${organizationId}-${Date.now()}` }
  );

  const now = new Date();
  await budgetQueue.add(
    "aggregate",
    { organizationId, userId, month: now.getUTCMonth() + 1, year: now.getUTCFullYear() },
    { jobId: `budget-${organizationId}-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}` }
  );
}

export function createSyncWorker(): Worker {
  return new Worker(
    "plaid.sync",
    async (job: Job) => {
      const result = SyncJobPayloadSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error(`Invalid sync job payload: ${JSON.stringify(result.error.issues)}`);
      }
      await syncTransactions(result.data);
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    }
  );
}

async function syncAccounts(
  accessToken: string,
  plaidItemId: string,
  organizationId: string
): Promise<void> {
  const response = await plaidClient.accountsGet({ access_token: accessToken });

  for (const account of response.data.accounts) {
    await prisma.plaidAccount.upsert({
      where: { accountId: account.account_id },
      update: {
        balanceCurrent: plaidAmountToCents(account.balances.current ?? 0),
        balanceAvailable: account.balances.available != null
          ? plaidAmountToCents(account.balances.available)
          : null,
        balanceLimit: account.balances.limit != null
          ? plaidAmountToCents(account.balances.limit)
          : null,
        updatedAt: new Date(),
      },
      create: {
        plaidItemId,
        organizationId,
        accountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? null,
        type: account.type,
        subtype: account.subtype ?? null,
        mask: account.mask ?? null,
        balanceCurrent: plaidAmountToCents(account.balances.current ?? 0),
        balanceAvailable: account.balances.available != null
          ? plaidAmountToCents(account.balances.available)
          : null,
        balanceLimit: account.balances.limit != null
          ? plaidAmountToCents(account.balances.limit)
          : null,
        isoCurrencyCode: account.balances.iso_currency_code ?? "USD",
      },
    });
  }
}
