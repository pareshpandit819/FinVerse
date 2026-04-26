/**
 * Converts a Plaid float amount to BigInt cents.
 * Plaid returns amounts as floats (e.g., 12.34). We immediately convert
 * to minor units to avoid floating-point arithmetic in business logic.
 */
export function plaidAmountToCents(amount: number): bigint {
  return BigInt(Math.round(Math.abs(amount) * 100));
}

export function centsToDollars(cents: bigint): number {
  return Number(cents) / 100;
}

export function formatCurrency(cents: bigint, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(centsToDollars(cents));
}

/** Safe BigInt percentage: returns basis points (1% = 100 bps) to avoid division precision issues. */
export function percentageBps(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  return (numerator * 10000n) / denominator;
}

/** JSON serializer replacer — converts BigInt to string with a "$bigint" wrapper. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return { $bigint: value.toString() };
  return value;
}

/** JSON parser reviver — converts "$bigint" wrapper back to BigInt. */
export function bigintReviver(_key: string, value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    "$bigint" in value &&
    typeof (value as Record<string, unknown>)["$bigint"] === "string"
  ) {
    return BigInt((value as Record<string, string>)["$bigint"]);
  }
  return value;
}
