import { Worker, type Job } from "bullmq";
import { z } from "zod";
import { prisma } from "@repo/db/client";
import { mapCategory } from "@repo/shared/categorize";
import { logger } from "@repo/shared/logger";
import { redis } from "../lib/redis.js";

const BudgetJobPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
});

export type BudgetJobPayload = z.infer<typeof BudgetJobPayloadSchema>;

export function createBudgetWorker(): Worker {
  return new Worker(
    "budget.aggregate",
    async (job: Job) => {
      const result = BudgetJobPayloadSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error(`Invalid budget job payload: ${JSON.stringify(result.error.issues)}`);
      }

      const { organizationId, userId, month, year } = result.data;
      const log = logger.child({ jobId: job.id, organizationId, month, year });

      const budget = await prisma.budget.findUnique({
        where: { organizationId_userId_month_year: { organizationId, userId, month, year } },
        include: { categories: true },
      });

      if (!budget) {
        log.info("No budget found for period — skipping");
        return;
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);

      const transactions = await prisma.transaction.findMany({
        where: {
          organizationId,
          date: { gte: startDate, lt: endDate },
          pending: false,
          amount: { gt: 0n },
        },
        select: { amount: true, name: true, customCategory: true },
      });

      const spending = new Map<string, bigint>();
      for (const txn of transactions) {
        const cat = txn.customCategory ?? mapCategory(txn.name);
        spending.set(cat, (spending.get(cat) ?? 0n) + txn.amount);
      }

      // Update each budget category's spent amount
      for (const budgetCat of budget.categories) {
        const spent = spending.get(budgetCat.category) ?? 0n;
        await prisma.budgetCategory.update({
          where: { id: budgetCat.id },
          data: { spentAmount: spent, updatedAt: new Date() },
        });
      }

      log.info(
        { categories: budget.categories.length, transactions: transactions.length },
        "Budget aggregation complete"
      );
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );
}
