export type AccountType = "depository" | "credit" | "loan" | "investment" | "other";

export interface AccountBalance {
  id: string;
  type: AccountType;
  subtype: string;
  balanceCurrent: bigint;
  isoCurrencyCode: string;
}

export interface HoldingValue {
  id: string;
  institutionValue: bigint;
  isoCurrencyCode: string;
}

export interface LiabilityBalance {
  id: string;
  balanceCurrent: bigint;
  isoCurrencyCode: string;
}

export interface NetWorthBreakdown {
  checking: bigint;
  savings: bigint;
  investment: bigint;
  other: bigint;
  credit: bigint;
  loans: bigint;
}

export interface NetWorthResult {
  totalAssets: bigint;
  totalLiabilities: bigint;
  netWorth: bigint;
  breakdown: NetWorthBreakdown;
}

/**
 * Pure net worth calculation — no I/O, no side effects.
 * All values must be in the same currency (USD) for v0.1.
 * Multi-currency extension: convert via FX rates before calling this function.
 */
export function calculateNetWorth(
  accounts: AccountBalance[],
  holdings: HoldingValue[],
  liabilities: LiabilityBalance[]
): NetWorthResult {
  const breakdown: NetWorthBreakdown = {
    checking: 0n,
    savings: 0n,
    investment: 0n,
    other: 0n,
    credit: 0n,
    loans: 0n,
  };

  for (const account of accounts) {
    const balance = account.balanceCurrent < 0n ? 0n : account.balanceCurrent;
    switch (account.type) {
      case "depository":
        if (account.subtype === "checking") {
          breakdown.checking += balance;
        } else {
          breakdown.savings += balance;
        }
        break;
      case "investment":
        breakdown.investment += balance;
        break;
      case "credit":
        breakdown.credit += account.balanceCurrent < 0n ? -account.balanceCurrent : account.balanceCurrent;
        break;
      case "loan":
        breakdown.loans += account.balanceCurrent < 0n ? -account.balanceCurrent : account.balanceCurrent;
        break;
      default:
        breakdown.other += balance;
    }
  }

  // Holdings override investment account balance when available (more precise)
  const holdingTotal = holdings.reduce((sum, h) => sum + h.institutionValue, 0n);
  if (holdingTotal > 0n) {
    breakdown.investment = holdingTotal;
  }

  const liabilityTotal = liabilities.reduce((sum, l) => sum + l.balanceCurrent, 0n);
  breakdown.credit += liabilityTotal;

  const totalAssets = breakdown.checking + breakdown.savings + breakdown.investment + breakdown.other;
  const totalLiabilities = breakdown.credit + breakdown.loans;

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    breakdown,
  };
}
