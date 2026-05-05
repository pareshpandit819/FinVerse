export interface AccountSummary {
  byType: Record<string, { count: number; totalBalanceCents: number }>;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  netWorthCents: number;
}

export interface SpendingByCategory {
  categories: Array<{
    category: string;
    totalCents: number;
    transactionCount: number;
    percentOfTotal: number;
  }>;
  totalSpentCents: number;
  periodStart: string;
  periodEnd: string;
}

export interface RecurringSubscription {
  merchantName: string;
  estimatedMonthlyCents: number;
  lastSeenDate: string;
  transactionCount: number;
}

export interface GoalProgress {
  goalId: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  progressPercent: number;
  daysRemaining: number;
  isOnTrack: boolean | null;
  projectedCompletionDate: string | null;
}

export interface NetWorthDataPoint {
  date: string;
  netWorthCents: number;
  assetsCents: number;
  liabilitiesCents: number;
}

export interface AnomalousTransaction {
  date: string;
  merchantName: string;
  amountCents: number;
  category: string;
  deviationMultiple: number;
}

export interface PortfolioHolding {
  ticker: string | null;
  name: string;
  securityType: string;
  quantity: number;
  valueCents: number;
  costBasisCents: number | null;
  unrealizedGainLossCents: number | null;
  allocationPercent: number;
}

export interface PortfolioAccount {
  accountId: string;
  accountName: string;
  subtype: string | null;
  valueCents: number;
  holdingCount: number;
  holdings: PortfolioHolding[];
}

export interface PortfolioSummary {
  totalValueCents: number;
  totalCostBasisCents: number | null;
  unrealizedGainLossCents: number | null;
  gainLossPercent: number | null;
  accounts: PortfolioAccount[];
  assetClassBreakdown: Record<string, { valueCents: number; allocationPercent: number }>;
}

export interface FinancialHealthIndicators {
  savingsRatePercent: number | null;
  debtToAssetRatio: number;
  emergencyFundMonths: number | null;
  netWorthGrowthPercent: { threeMonth: number | null; sixMonth: number | null };
  budgetBreachedCategoriesCount: number;
  portfolioDiversification: {
    assetClassCount: number;
    topHoldingPercent: number | null;
    totalHoldingCount: number;
  } | null;
}
