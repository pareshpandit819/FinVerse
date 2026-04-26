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
