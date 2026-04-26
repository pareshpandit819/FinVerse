import type { FastifyInstance, FastifyRequest } from "fastify";
import { PlaidWebhookSchema } from "@repo/shared/schemas";
import { logger } from "@repo/shared/logger";
import { verifyPlaidWebhook } from "../lib/webhook-verifier.js";
import { syncQueue, investmentsQueue, liabilitiesQueue } from "../queues/sync.js";
import { prisma } from "@repo/db/client";

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Parse raw body for signature verification before JSON parsing
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req: FastifyRequest, body: string, done: (err: Error | null, body: string) => void) => {
      done(null, body);
    }
  );

  app.post("/plaid", async (request: FastifyRequest, reply) => {
    const rawBody = request.body as string;
    const signatureHeader = request.headers["plaid-verification"] as string | undefined ?? null;

    const verified = await verifyPlaidWebhook(rawBody, signatureHeader);
    if (!verified) {
      logger.warn({ ip: request.ip }, "Plaid webhook signature verification failed");
      return reply.status(401).send({ error: "Invalid webhook signature" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return reply.status(400).send({ error: "Invalid JSON" });
    }

    const result = PlaidWebhookSchema.safeParse(parsed);
    if (!result.success) {
      logger.warn({ issues: result.error.issues }, "Invalid Plaid webhook payload shape");
      return reply.status(400).send({ error: "Invalid payload" });
    }

    const webhook = result.data;
    const log = logger.child({
      webhook_type: webhook.webhook_type,
      webhook_code: webhook.webhook_code,
      item_id: webhook.item_id,
    });
    log.info("Plaid webhook received");

    const item = await prisma.plaidItem.findUnique({
      where: { itemId: webhook.item_id },
      select: { id: true, organizationId: true, userId: true },
    });

    if (!item) {
      log.warn("Received webhook for unknown item_id — ignoring");
      return reply.status(200).send({ received: true });
    }

    await routeWebhook(webhook, item.id, item.organizationId, item.userId, log);

    return reply.status(200).send({ received: true });
  });
}

async function routeWebhook(
  webhook: { webhook_type: string; webhook_code: string; item_id: string },
  plaidItemId: string,
  organizationId: string,
  userId: string,
  log: ReturnType<typeof logger.child>
): Promise<void> {
  const jobBase = { plaidItemId, organizationId, userId };

  switch (webhook.webhook_type) {
    case "TRANSACTIONS":
      if (webhook.webhook_code === "SYNC_UPDATES_AVAILABLE") {
        await syncQueue.add("sync", { ...jobBase, isInitial: false }, {
          jobId: `sync-${plaidItemId}-${Date.now()}`,
        });
        log.info("Enqueued transaction sync job");
      }
      break;

    case "HOLDINGS":
      if (webhook.webhook_code === "DEFAULT_UPDATE") {
        await investmentsQueue.add("sync-investments", { plaidItemId, organizationId }, {
          jobId: `investments-${plaidItemId}-${Date.now()}`,
        });
        log.info("Enqueued investments sync job");
      }
      break;

    case "LIABILITIES":
      if (webhook.webhook_code === "DEFAULT_UPDATE") {
        await liabilitiesQueue.add("sync-liabilities", { plaidItemId, organizationId }, {
          jobId: `liabilities-${plaidItemId}-${Date.now()}`,
        });
        log.info("Enqueued liabilities sync job");
      }
      break;

    case "ITEM":
      if (webhook.webhook_code === "ERROR") {
        await prisma.plaidItem.update({
          where: { id: plaidItemId },
          data: { status: "login_required" },
        });
        log.warn("Item marked as login_required due to ITEM ERROR webhook");
      } else if (webhook.webhook_code === "WEBHOOK_UPDATE_ACKNOWLEDGED") {
        log.info("Webhook update acknowledged");
      }
      break;

    default:
      log.info("Unhandled webhook type — ignoring");
  }
}
