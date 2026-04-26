/**
 * Implementations for the 6 Claude tool calls used in insight generation.
 * All queries are scoped to a single organizationId — never cross-org.
 * Amounts are returned as plain numbers (cents) for JSON serialization.
 */
import { prisma } from "@repo/db/client";
import { projectGoal } from "@repo/shared/goal";
import type {
  AccountSummary,
  SpendingByCategory,
  RecurringSubscription,
  GoalProgress,
  NetWorthDataPoint,
  AnomalousTransaction,
} from "@repo/shared/ai-tools";

export async function getAccountSummary(
  organizationId: string
): Promise<AccountSummary> {
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId },
    select: { type: true, balanceCurrent: true },
  });

  const byType: AccountSummary["byType"] = {};
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acct of accounts) {
    const balance = Number(acct.balanceCurrent);
    if (!byType[acct.type]) {
      byType[acct.type] = { count: 0, totalBalanceCents: 0 };
    }
    byType[acct.type]!.count++;
    byType[acct.type]!.totalBalanceCents += balance;

    if (acct.type === "credit_card" || acct.type === "loan") {
      totalLiabilities += Math.abs(balance);
    } else {
      totalAssets += Math.max(0, balance);
    }
  }

  return {
    byType,
    totalAssetsCents: totalAssets,
    totalLiabilitiesCents: totalLiabilities,
    netWorthCents: totalAssets - totalLiabilities,
  };
}

export async function getSpendingByCategory(
  organizationId: string,
  startDate: string,
  endDate: string
): Promise<SpendingByCategory> {
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
      pending: false,
      amount: { gt: 0n },
    },
    select: { amount: true, customCategory: true },
  });

  const totals = new Map<string, { total: bigint; count: number }>();
  let grandTotal = 0n;

  for (const txn of transactions) {
    const cat = txn.customCategory ?? "Other";
    const existing = totals.get(cat) ?? { total: 0n, count: 0 };
    totals.set(cat, { total: existing.total + txn.amount, count: existing.count + 1 });
    grandTotal += txn.amount;
  }

  const categories = Array.from(totals.entries())
    .map(([category, { total, count }]) => ({
      category,
      totalCents: Number(total),
      transactionCount: count,
      percentOfTotal: grandTotal > 0n ? Math.round((Number(total) / Number(grandTotal)) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  return { categories, totalSpentCents: Number(grandTotal), periodStart: startDate, periodEnd: endDate };
}

export async function getRecurringSubscriptions(
  organizationId: string
): Promise<RecurringSubscription[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: ninetyDaysAgo },
      pending: false,
      amount: { gt: 0n },
      merchantName: { not: null },
    },
    select: { merchantName: true, amount: true, date: true },
    orderBy: { date: "asc" },
  });

  // Group by merchantName, detect >= 2 charges in 90 days with similar amounts
  const byMerchant = new Map<
    string,
    { amounts: number[]; dates: Date[] }
  >();

  for (const txn of transactions) {
    if (!txn.merchantName) continue;
    const key = txn.merchantName.toLowerCase();
    const existing = byMerchant.get(key) ?? { amounts: [], dates: [] };
    existing.amounts.push(Number(txn.amount));
    existing.dates.push(txn.date);
    byMerchant.set(key, existing);
  }

  const recurring: RecurringSubscription[] = [];
  for (const [name, { amounts, dates }] of byMerchant) {
    if (amounts.length < 2) continue;

    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = amounts.reduce((d, a) => Math.max(d, Math.abs(a - avg) / avg), 0);

    // Amounts within 10% variance = recurring
    if (maxDeviation <= 0.10) {
      recurring.push({
        merchantName: name,
        estimatedMonthlyCents: Math.round((avg * 30) / (90 / amounts.length)),
        lastSeenDate: dates[dates.length - 1]!.toISOString().split("T")[0]!,
        transactionCount: amounts.length,
      });
    }
  }

  return recurring.sort((a, b) => b.estimatedMonthlyCents - a.estimatedMonthlyCents);
}

export async function getGoalProgress(
  organizationId: string,
  goalId?: string
): Promise<GoalProgress[]> {
  const goals = await prisma.goal.findMany({
    where: { organizationId, ...(goalId ? { id: goalId } : {}) },
    select: {
      id: true,
      name: true,
      targetAmount: true,
      currentAmount: true,
      targetDate: true,
      contributionRate: true,
    },
  });

  return goals.map((goal) => {
    const monthlyRate = BigInt(Math.round(Number(goal.contributionRate)));
    const projection = projectGoal(
      {
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        targetDate: goal.targetDate,
      },
      monthlyRate > 0n ? monthlyRate : undefined
    );

    return {
      goalId: goal.id,
      name: goal.name,
      targetAmountCents: Number(goal.targetAmount),
      currentAmountCents: Number(goal.currentAmount),
      progressPercent: Number(projection.progressBps) / 100,
      daysRemaining: projection.daysRemaining,
      isOnTrack: projection.isOnTrack,
      projectedCompletionDate: projection.projectedCompletionDate?.toISOString().split("T")[0] ?? null,
    };
  });
}

export async function getNetWorthTrend(
  organizationId: string,
  period: "1m" | "3m" | "6m" | "1y" | "all"
): Promise<NetWorthDataPoint[]> {
  const cutoff = new Date();
  if (period !== "all") {
    const months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[period];
    cutoff.setMonth(cutoff.getMonth() - months);
  } else {
    cutoff.setFullYear(2000);
  }

  const snapshots = await prisma.netWorthSnapshot.findMany({
    where: { organizationId, snapshotDate: { gte: cutoff } },
    orderBy: { snapshotDate: "asc" },
    select: { snapshotDate: true, netWorth: true, totalAssets: true, totalLiabilities: true },
  });

  return snapshots.map((s) => ({
    date: s.snapshotDate.toISOString().split("T")[0]!,
    netWorthCents: Number(s.netWorth),
    assetsCents: Number(s.totalAssets),
    liabilitiesCents: Number(s.totalLiabilities),
  }));
}

export async function findAnomalousTransactions(
  organizationId: string,
  thresholdMultiple: number = 3.0
): Promise<AnomalousTransaction[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: { gte: ninetyDaysAgo },
      pending: false,
      amount: { gt: 0n },
    },
    select: { amount: true, date: true, merchantName: true, customCategory: true },
    orderBy: { date: "desc" },
  });

  // Compute per-category mean and stddev
  const byCategory = new Map<string, number[]>();
  for (const txn of transactions) {
    const cat = txn.customCategory ?? "Other";
    const arr = byCategory.get(cat) ?? [];
    arr.push(Number(txn.amount));
    byCategory.set(cat, arr);
  }

  const stats = new Map<string, { mean: number; stddev: number }>();
  for (const [cat, amounts] of byCategory) {
    if (amounts.length < 3) continue; // need enough data for z-score to be meaningful
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    stats.set(cat, { mean, stddev: Math.sqrt(variance) });
  }

  const anomalies: AnomalousTransaction[] = [];
  for (const txn of transactions) {
    const cat = txn.customCategory ?? "Other";
    const s = stats.get(cat);
    if (!s || s.stddev === 0) continue;

    const amount = Number(txn.amount);
    const deviationMultiple = (amount - s.mean) / s.stddev;

    if (deviationMultiple >= thresholdMultiple) {
      anomalies.push({
        date: txn.date.toISOString().split("T")[0]!,
        merchantName: txn.merchantName ?? "Unknown",
        amountCents: amount,
        category: cat,
        deviationMultiple: Math.round(deviationMultiple * 10) / 10,
      });
    }
  }

  return anomalies.sort((a, b) => b.deviationMultiple - a.deviationMultiple).slice(0, 10);
}
