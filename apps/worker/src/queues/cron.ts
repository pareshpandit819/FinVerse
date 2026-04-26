import { prisma } from "@repo/db/client";
import { logger } from "@repo/shared/logger";
import { netWorthQueue, insightsQueue, budgetQueue } from "./sync.js";

/**
 * Schedules daily net-worth snapshots for all active organizations.
 * Called once at worker startup; BullMQ deduplicates by jobId.
 */
export async function scheduleDailySnapshots(): Promise<void> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      memberships: {
        where: { role: "OWNER" },
        select: { userId: true },
        take: 1,
      },
    },
  });

  let enqueued = 0;
  for (const org of orgs) {
    const owner = org.memberships[0];
    if (!owner) continue;

    await netWorthQueue.add(
      "daily-snapshot",
      { organizationId: org.id, userId: owner.userId },
      {
        jobId: `snapshot-daily-${org.id}`,
        repeat: { pattern: "0 2 * * *" }, // 02:00 UTC daily
      }
    );
    enqueued++;
  }

  logger.info({ enqueued }, "Daily net-worth snapshots scheduled");
}

/**
 * Schedules daily budget spending aggregation for budgets in the current month.
 */
export async function scheduleMonthlyBudgetAggregation(): Promise<void> {
  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const budgets = await prisma.budget.findMany({
    where: { month, year },
    select: { organizationId: true, userId: true, month: true, year: true },
  });

  for (const budget of budgets) {
    await budgetQueue.add(
      "monthly-aggregate",
      budget,
      {
        jobId: `budget-${budget.organizationId}-${budget.year}-${budget.month}`,
        repeat: { pattern: "30 2 * * *" }, // 02:30 UTC daily
      }
    );
  }

  logger.info({ count: budgets.length }, "Monthly budget aggregation scheduled");
}

/**
 * Schedules weekly AI insight generation for all active organizations.
 */
export async function scheduleWeeklyInsights(): Promise<void> {
  const memberships = await prisma.membership.findMany({
    where: { role: { in: ["OWNER", "ADMIN"] } },
    select: { organizationId: true, userId: true },
    distinct: ["organizationId"],
  });

  for (const m of memberships) {
    await insightsQueue.add(
      "weekly-insights",
      { organizationId: m.organizationId, userId: m.userId },
      {
        jobId: `insights-weekly-${m.organizationId}`,
        repeat: { pattern: "0 6 * * 1" }, // 06:00 UTC every Monday
      }
    );
  }

  logger.info({ count: memberships.length }, "Weekly insight jobs scheduled");
}
