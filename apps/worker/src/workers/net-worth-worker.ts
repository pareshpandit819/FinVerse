import { Worker, type Job } from "bullmq";
import { z } from "zod";
import { prisma } from "@repo/db/client";
import { calculateNetWorth } from "@repo/shared/net-worth";
import type { AccountBalance, HoldingValue } from "@repo/shared/net-worth";
import { logger } from "@repo/shared/logger";
import { redis } from "../lib/redis.js";

const NetWorthJobPayloadSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export function createNetWorthWorker(): Worker {
  return new Worker(
    "net-worth.snapshot",
    async (job: Job) => {
      const result = NetWorthJobPayloadSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error(`Invalid net-worth job payload: ${JSON.stringify(result.error.issues)}`);
      }

      const { organizationId, userId } = result.data;
      const log = logger.child({ jobId: job.id, organizationId });

      const accounts = await prisma.plaidAccount.findMany({
        where: { organizationId },
        select: {
          id: true,
          type: true,
          subtype: true,
          balanceCurrent: true,
          isoCurrencyCode: true,
        },
      });

      const holdings = await prisma.holding.findMany({
        where: { organizationId },
        select: { id: true, institutionValue: true, isoCurrencyCode: true },
      });

      // Credit/loan liabilities from the Liability table (more authoritative than account balance)
      const liabilities = await prisma.liability.findMany({
        where: { organizationId },
        select: {
          id: true,
          account: { select: { balanceCurrent: true, isoCurrencyCode: true } },
        },
      });

      const accountBalances: AccountBalance[] = accounts.map((a) => ({
        id: a.id,
        type: a.type as AccountBalance["type"],
        subtype: a.subtype ?? "",
        balanceCurrent: a.balanceCurrent,
        isoCurrencyCode: a.isoCurrencyCode,
      }));

      const holdingValues: HoldingValue[] = holdings.map((h) => ({
        id: h.id,
        institutionValue: h.institutionValue,
        isoCurrencyCode: h.isoCurrencyCode,
      }));

      const liabilityBalances = liabilities.map((l) => ({
        id: l.id,
        balanceCurrent: l.account.balanceCurrent,
        isoCurrencyCode: l.account.isoCurrencyCode,
      }));

      const { totalAssets, totalLiabilities, netWorth, breakdown } = calculateNetWorth(
        accountBalances,
        holdingValues,
        liabilityBalances
      );

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await prisma.netWorthSnapshot.upsert({
        where: { organizationId_userId_snapshotDate: { organizationId, userId, snapshotDate: today } },
        update: { totalAssets, totalLiabilities, netWorth, breakdown: breakdown as object },
        create: {
          organizationId,
          userId,
          totalAssets,
          totalLiabilities,
          netWorth,
          snapshotDate: today,
          breakdown: breakdown as object,
        },
      });

      // Refresh goal currentAmounts from linked accounts
      await refreshGoalProgress(organizationId, userId, accountBalances);

      log.info({ netWorth: netWorth.toString() }, "Net worth snapshot saved");
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );
}

async function refreshGoalProgress(
  organizationId: string,
  userId: string,
  accounts: AccountBalance[]
): Promise<void> {
  const goals = await prisma.goal.findMany({
    where: { organizationId, userId, isCompleted: false },
    select: { id: true, linkedAccountIds: true, targetAmount: true },
  });

  for (const goal of goals) {
    if (goal.linkedAccountIds.length === 0) continue;

    const linkedBalance = accounts
      .filter((a) => goal.linkedAccountIds.includes(a.id))
      .reduce((sum, a) => sum + (a.balanceCurrent > 0n ? a.balanceCurrent : 0n), 0n);

    const isCompleted = linkedBalance >= goal.targetAmount;

    await prisma.goal.update({
      where: { id: goal.id },
      data: {
        currentAmount: linkedBalance,
        isCompleted,
        updatedAt: new Date(),
      },
    });
  }
}
