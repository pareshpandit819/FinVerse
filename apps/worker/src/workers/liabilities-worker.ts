import { Worker, type Job } from "bullmq";
import { prisma } from "@repo/db/client";
import { decryptToken } from "@repo/shared/crypto";
import { plaidAmountToCents } from "@repo/shared/money";
import { logger } from "@repo/shared/logger";
import { plaidClient } from "../lib/plaid.js";
import { redis } from "../lib/redis.js";
import { z } from "zod";

const LiabilitiesJobSchema = z.object({
  plaidItemId: z.string().uuid(),
  organizationId: z.string().uuid(),
});

export function createLiabilitiesWorker(): Worker {
  return new Worker(
    "plaid.liabilities",
    async (job: Job) => {
      const result = LiabilitiesJobSchema.safeParse(job.data);
      if (!result.success) throw new Error("Invalid liabilities job payload");

      const { plaidItemId, organizationId } = result.data;
      const log = logger.child({ jobId: job.id, plaidItemId });

      const item = await prisma.plaidItem.findUnique({ where: { id: plaidItemId } });
      if (!item) throw new Error(`PlaidItem ${plaidItemId} not found`);

      const accessToken = decryptToken(item.encryptedAccessToken);

      const response = await plaidClient.liabilitiesGet({ access_token: accessToken });
      const { credit, student, mortgage } = response.data.liabilities;

      const allLiabilities = [
        ...(credit ?? []).map((l) => ({ type: "credit", accountId: l.account_id, data: l })),
        ...(student ?? []).map((l) => ({ type: "student", accountId: l.account_id, data: l })),
        ...(mortgage ?? []).map((l) => ({ type: "mortgage", accountId: l.account_id, data: l })),
      ];

      for (const { type, accountId, data } of allLiabilities) {
        const account = await prisma.plaidAccount.findUnique({
          where: { accountId },
          select: { id: true },
        });
        if (!account) continue;

        // Extract common fields from the varying liability shapes
        const creditData = type === "credit" ? (data as { last_payment_amount?: number; last_payment_date?: string; minimum_payment_amount?: number; next_payment_due_date?: string }) : null;

        await prisma.liability.upsert({
          where: { plaidAccountId: account.id },
          update: {
            type,
            lastPaymentAmount: creditData?.last_payment_amount != null
              ? plaidAmountToCents(creditData.last_payment_amount)
              : null,
            lastPaymentDate: creditData?.last_payment_date
              ? new Date(creditData.last_payment_date)
              : null,
            minimumPaymentAmount: creditData?.minimum_payment_amount != null
              ? plaidAmountToCents(creditData.minimum_payment_amount)
              : null,
            nextPaymentDueDate: creditData?.next_payment_due_date
              ? new Date(creditData.next_payment_due_date)
              : null,
            metadata: data as Record<string, unknown>,
            updatedAt: new Date(),
          },
          create: {
            plaidAccountId: account.id,
            organizationId,
            type,
            lastPaymentAmount: creditData?.last_payment_amount != null
              ? plaidAmountToCents(creditData.last_payment_amount)
              : null,
            lastPaymentDate: creditData?.last_payment_date
              ? new Date(creditData.last_payment_date)
              : null,
            minimumPaymentAmount: creditData?.minimum_payment_amount != null
              ? plaidAmountToCents(creditData.minimum_payment_amount)
              : null,
            nextPaymentDueDate: creditData?.next_payment_due_date
              ? new Date(creditData.next_payment_due_date)
              : null,
            metadata: data as Record<string, unknown>,
          },
        });
      }

      log.info({ count: allLiabilities.length }, "Liabilities sync complete");
    },
    { connection: redis, concurrency: 3 }
  );
}
