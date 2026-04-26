export interface GoalProjectionInput {
  targetAmount: bigint;
  currentAmount: bigint;
  targetDate: Date;
  referenceDate?: Date;
}

export interface GoalProjectionResult {
  progressBps: bigint;
  amountRemaining: bigint;
  daysRemaining: number;
  requiredDailyContribution: bigint;
  requiredMonthlyContribution: bigint;
  isCompleted: boolean;
  isOnTrack: boolean | null;
  projectedCompletionDate: Date | null;
}

/**
 * Projects goal completion based on linear extrapolation of the current run rate.
 * Pass `contributionRate` (monthly, in cents) for on-track calculation.
 */
export function projectGoal(
  input: GoalProjectionInput,
  monthlyContributionRate?: bigint
): GoalProjectionResult {
  const now = input.referenceDate ?? new Date();
  const msPerDay = 86_400_000;

  const daysRemaining = Math.max(
    0,
    Math.ceil((input.targetDate.getTime() - now.getTime()) / msPerDay)
  );

  const amountRemaining =
    input.targetAmount > input.currentAmount
      ? input.targetAmount - input.currentAmount
      : 0n;

  const isCompleted = input.currentAmount >= input.targetAmount;

  const progressBps = isCompleted
    ? 10000n
    : input.targetAmount > 0n
    ? (input.currentAmount * 10000n) / input.targetAmount
    : 0n;

  const requiredDailyContribution =
    daysRemaining > 0 && !isCompleted
      ? amountRemaining / BigInt(daysRemaining)
      : 0n;

  const requiredMonthlyContribution =
    daysRemaining > 0 && !isCompleted
      ? (amountRemaining * 30n) / BigInt(daysRemaining)
      : 0n;

  let isOnTrack: boolean | null = null;
  let projectedCompletionDate: Date | null = null;

  if (monthlyContributionRate !== undefined && monthlyContributionRate > 0n) {
    isOnTrack = monthlyContributionRate >= requiredMonthlyContribution;
    if (!isCompleted) {
      const monthsToComplete = Number(amountRemaining) / Number(monthlyContributionRate);
      const projMs = now.getTime() + monthsToComplete * 30 * msPerDay;
      projectedCompletionDate = new Date(projMs);
    } else {
      projectedCompletionDate = now;
    }
  }

  return {
    progressBps,
    amountRemaining,
    daysRemaining,
    requiredDailyContribution,
    requiredMonthlyContribution,
    isCompleted,
    isOnTrack,
    projectedCompletionDate,
  };
}
