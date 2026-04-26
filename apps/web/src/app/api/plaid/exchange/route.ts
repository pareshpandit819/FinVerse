import { plaidClient } from "@/lib/plaid";
import { requirePermission, withAuthErrors } from "@/lib/rbac";
import { prisma } from "@repo/db/client";
import { writeAudit } from "@repo/db";
import { encryptToken } from "@repo/shared/crypto";
import { PlaidPublicTokenExchangeSchema } from "@repo/shared/schemas";
import { syncQueue } from "@/lib/queues";
import { headers } from "next/headers";

export function POST(request: Request): Promise<Response> {
  return withAuthErrors(async () => {
    const body: unknown = await request.json().catch(() => null);
    const result = PlaidPublicTokenExchangeSchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid request body", issues: result.error.issues }, { status: 400 });
    }

    const { publicToken, institutionId, institutionName } = result.data;

    // organizationId must be provided by the client that initiated Link
    const orgId = (body as Record<string, unknown>)["organizationId"];
    if (typeof orgId !== "string") {
      return Response.json({ error: "organizationId is required" }, { status: 400 });
    }

    const ctx = await requirePermission(orgId, "plaid.link");

    // Exchange the short-lived public token for a long-lived access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchangeResponse.data;

    const encryptedToken = encryptToken(access_token);
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") ?? undefined;

    const plaidItem = await prisma.$transaction(async (tx) => {
      const item = await tx.plaidItem.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId,
          encryptedAccessToken: encryptedToken,
          itemId: item_id,
          institutionId,
          institutionName,
          status: "active",
        },
      });

      await writeAudit({
        tx,
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        action: "plaid_item.created",
        entityType: "plaid_items",
        entityId: item.id,
        after: { itemId: item_id, institutionId, institutionName, status: "active" },
        ipAddress: ip,
      });

      return item;
    });

    // Enqueue initial sync — runs outside the transaction
    await syncQueue.add(
      "initial-sync",
      {
        plaidItemId: plaidItem.id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        isInitial: true,
      },
      {
        jobId: `initial-sync-${plaidItem.id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      }
    );

    return Response.json({ itemId: plaidItem.id, status: "syncing" });
  });
}
