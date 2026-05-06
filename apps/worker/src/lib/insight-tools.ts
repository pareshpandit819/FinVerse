/**
 * Implementations for the Claude tool calls used in insight generation.
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
  PortfolioSummary,
  FinancialHealthIndicators,
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

export async function getPortfolioSummary(
  organizationId: string
): Promise<PortfolioSummary> {
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId, type: "investment" },
    select: {
      id: true,
      name: true,
      subtype: true,
      holdings: {
        select: {
          quantity: true,
          institutionValue: true,
          costBasis: true,
          unrealizedGainLoss: true,
          security: {
            select: { name: true, tickerSymbol: true, type: true },
          },
        },
      },
    },
  });

  let totalValueCents = 0;
  let totalCostBasisCents = 0;
  let hasCostBasis = false;

  const accountData = accounts.map((account) => {
    const accountValueCents = account.holdings.reduce(
      (sum, h) => sum + Number(h.institutionValue),
      0
    );
    totalValueCents += accountValueCents;

    const holdings = account.holdings.map((h) => {
      const valueCents = Number(h.institutionValue);
      const costBasisCents = h.costBasis ? Number(h.costBasis) : null;
      const unrealizedGainLossCents = h.unrealizedGainLoss
        ? Number(h.unrealizedGainLoss)
        : costBasisCents !== null
          ? valueCents - costBasisCents
          : null;

      if (costBasisCents !== null) {
        hasCostBasis = true;
        totalCostBasisCents += costBasisCents;
      }

      return {
        ticker: h.security.tickerSymbol,
        name: h.security.name,
        securityType: h.security.type,
        quantity: Number(h.quantity),
        valueCents,
        costBasisCents,
        unrealizedGainLossCents,
        allocationPercent: 0, // filled below after totals are known
      };
    });

    return {
      accountId: account.id,
      accountName: account.name,
      subtype: account.subtype,
      valueCents: accountValueCents,
      holdingCount: holdings.length,
      holdings,
    };
  });

  // Fill allocation percentages and asset class breakdown
  const assetClassBreakdown: PortfolioSummary["assetClassBreakdown"] = {};

  for (const account of accountData) {
    for (const holding of account.holdings) {
      holding.allocationPercent =
        totalValueCents > 0
          ? Math.round((holding.valueCents / totalValueCents) * 10000) / 100
          : 0;

      const cls = holding.securityType || "other";
      if (!assetClassBreakdown[cls]) {
        assetClassBreakdown[cls] = { valueCents: 0, allocationPercent: 0 };
      }
      assetClassBreakdown[cls]!.valueCents += holding.valueCents;
    }
  }

  for (const cls of Object.keys(assetClassBreakdown)) {
    assetClassBreakdown[cls]!.allocationPercent =
      totalValueCents > 0
        ? Math.round(
            (assetClassBreakdown[cls]!.valueCents / totalValueCents) * 10000
          ) / 100
        : 0;
  }

  const unrealizedGainLossCents = hasCostBasis
    ? totalValueCents - totalCostBasisCents
    : null;
  const gainLossPercent =
    unrealizedGainLossCents !== null && totalCostBasisCents > 0
      ? Math.round(
          (unrealizedGainLossCents / totalCostBasisCents) * 10000
        ) / 100
      : null;

  return {
    totalValueCents,
    totalCostBasisCents: hasCostBasis ? totalCostBasisCents : null,
    unrealizedGainLossCents,
    gainLossPercent,
    accounts: accountData,
    assetClassBreakdown,
  };
}

export async function getFinancialHealthIndicators(
  organizationId: string
): Promise<FinancialHealthIndicators> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oneEightyDaysAgo = new Date();
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

  const [accounts, recentTransactions, snapshots, latestBudget, holdings] =
    await Promise.all([
      prisma.financialAccount.findMany({
        where: { organizationId },
        select: { type: true, balanceCurrent: true },
      }),
      prisma.transaction.findMany({
        where: {
          organizationId,
          date: { gte: thirtyDaysAgo },
          pending: false,
        },
        select: { amount: true },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { organizationId, snapshotDate: { gte: oneEightyDaysAgo } },
        orderBy: { snapshotDate: "asc" },
        select: { snapshotDate: true, netWorth: true },
      }),
      prisma.budget.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: { categories: { select: { limitAmount: true, spentAmount: true } } },
      }),
      prisma.holding.findMany({
        where: { organizationId },
        select: {
          institutionValue: true,
          security: { select: { type: true } },
        },
      }),
    ]);

  // Asset/liability split + liquid assets
  let totalAssets = 0;
  let totalLiabilities = 0;
  let liquidAssets = 0;

  for (const acc of accounts) {
    const balance = Number(acc.balanceCurrent);
    if (acc.type === "credit_card" || acc.type === "loan") {
      totalLiabilities += Math.abs(balance);
    } else {
      const pos = Math.max(0, balance);
      totalAssets += pos;
      if (acc.type === "checking" || acc.type === "savings") liquidAssets += pos;
    }
  }

  const debtToAssetRatio =
    totalAssets > 0
      ? Math.round((totalLiabilities / totalAssets) * 10000) / 100
      : 0;

  // Income vs spending (income = negative amounts = money coming in)
  const income = recentTransactions
    .filter((t) => Number(t.amount) < 0)
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const spending = recentTransactions
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);

  const savingsRatePercent =
    income > 0
      ? Math.round(((income - spending) / income) * 10000) / 100
      : null;

  const emergencyFundMonths =
    spending > 0 ? Math.round((liquidAssets / spending) * 10) / 10 : null;

  // Net worth growth
  let threeMonthGrowth: number | null = null;
  let sixMonthGrowth: number | null = null;
  if (snapshots.length >= 2) {
    const latest = snapshots[snapshots.length - 1]!;
    const threeMonthCutoff = new Date();
    threeMonthCutoff.setDate(threeMonthCutoff.getDate() - 90);
    const threeMonthSnap = snapshots.find(
      (s) => s.snapshotDate >= threeMonthCutoff
    );
    const sixMonthSnap = snapshots[0]!;

    if (threeMonthSnap && Number(threeMonthSnap.netWorth) !== 0) {
      threeMonthGrowth =
        Math.round(
          ((Number(latest.netWorth) - Number(threeMonthSnap.netWorth)) /
            Math.abs(Number(threeMonthSnap.netWorth))) *
            10000
        ) / 100;
    }
    if (Number(sixMonthSnap.netWorth) !== 0) {
      sixMonthGrowth =
        Math.round(
          ((Number(latest.netWorth) - Number(sixMonthSnap.netWorth)) /
            Math.abs(Number(sixMonthSnap.netWorth))) *
            10000
        ) / 100;
    }
  }

  // Budget adherence
  const budgetBreachedCategoriesCount = latestBudget
    ? latestBudget.categories.filter(
        (c) => Number(c.spentAmount) > Number(c.limitAmount)
      ).length
    : 0;

  // Portfolio diversification
  let portfolioDiversification: FinancialHealthIndicators["portfolioDiversification"] =
    null;
  if (holdings.length > 0) {
    const totalPortfolioValue = holdings.reduce(
      (s, h) => s + Number(h.institutionValue),
      0
    );
    const assetClasses = new Set(holdings.map((h) => h.security.type));
    const topHoldingValue = Math.max(
      ...holdings.map((h) => Number(h.institutionValue))
    );
    portfolioDiversification = {
      assetClassCount: assetClasses.size,
      topHoldingPercent:
        totalPortfolioValue > 0
          ? Math.round((topHoldingValue / totalPortfolioValue) * 10000) / 100
          : null,
      totalHoldingCount: holdings.length,
    };
  }

  return {
    savingsRatePercent,
    debtToAssetRatio,
    emergencyFundMonths,
    netWorthGrowthPercent: { threeMonth: threeMonthGrowth, sixMonth: sixMonthGrowth },
    budgetBreachedCategoriesCount,
    portfolioDiversification,
  };
}

export async function findDuplicateCharges(
  organizationId: string,
  daysWindow = 3
) {
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
    },
    orderBy: {
      postedAt: "desc",
    },
    take: 500,
  });

  const grouped = new Map<string, typeof transactions>();

  for (const tx of transactions) {
    const name = typeof tx.name === "string" ? tx.name : "";
    const amount = tx.amount;

    if (!name || amount == null) {
      continue;
    }

    const normalizedMerchant = name.toLowerCase().trim();
    const key = `${normalizedMerchant}:${amount}`;

    grouped.set(key, [...(grouped.get(key) ?? []), tx]);
  }

  return [...grouped.values()]
    .filter((group) => group.length >= 2)
    .map((group) => ({
      merchantName: group[0].name,
      amount: group[0].amount / 100,
      amountCents: group[0].amount,
      transactionIds: group.map((tx) => tx.id),
      transactionDates: group.map((tx) => tx.postedAt),
      count: group.length,
      daysWindow,
      confidence: 0.82,
    }));
}
