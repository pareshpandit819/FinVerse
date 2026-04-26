export interface BudgetCategoryInput {
  category: string;
  limitAmount: bigint;
  spentAmount: bigint;
  rolloverCarryIn: bigint;
}

export interface BudgetCategoryResult {
  category: string;
  effectiveLimit: bigint;
  spentAmount: bigint;
  remaining: bigint;
  overage: bigint;
  utilizationBps: bigint;
  isBreached: boolean;
  rolloverCarryOut: bigint;
}

export interface BudgetResult {
  totalLimit: bigint;
  totalSpent: bigint;
  totalRemaining: bigint;
  categories: BudgetCategoryResult[];
  isBreached: boolean;
}

/**
 * Calculates budget status per category with optional rollover logic.
 *
 * When rollover=true, unspent budget from the previous period is added to
 * this period's limit (carryIn). Any overage reduces the next period's carryIn.
 */
export function calculateBudget(
  categories: BudgetCategoryInput[],
  rollover: boolean
): BudgetResult {
  const results: BudgetCategoryResult[] = categories.map((cat) => {
    const effectiveLimit = rollover
      ? cat.limitAmount + cat.rolloverCarryIn
      : cat.limitAmount;

    const remaining = effectiveLimit - cat.spentAmount;
    const isBreached = cat.spentAmount > effectiveLimit;
    const overage = isBreached ? cat.spentAmount - effectiveLimit : 0n;
    const rolloverCarryOut = rollover
      ? remaining > 0n
        ? remaining
        : 0n
      : 0n;

    const utilizationBps =
      effectiveLimit > 0n
        ? (cat.spentAmount * 10000n) / effectiveLimit
        : cat.spentAmount > 0n
        ? 10000n
        : 0n;

    return {
      category: cat.category,
      effectiveLimit,
      spentAmount: cat.spentAmount,
      remaining: remaining < 0n ? 0n : remaining,
      overage,
      utilizationBps,
      isBreached,
      rolloverCarryOut,
    };
  });

  const totalLimit = results.reduce((s, r) => s + r.effectiveLimit, 0n);
  const totalSpent = results.reduce((s, r) => s + r.spentAmount, 0n);

  return {
    totalLimit,
    totalSpent,
    totalRemaining: totalLimit > totalSpent ? totalLimit - totalSpent : 0n,
    categories: results,
    isBreached: results.some((r) => r.isBreached),
  };
}
