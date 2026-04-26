/** Formats BigInt cents as a dollar string, e.g. 110050n → "$1,100.50" */
export function formatCents(cents: bigint | number, opts?: { compact?: boolean }): string {
  const n = typeof cents === "bigint" ? Number(cents) : cents;
  const dollars = n / 100;

  if (opts?.compact) {
    if (Math.abs(dollars) >= 1_000_000) {
      return `$${(dollars / 1_000_000).toFixed(1)}M`;
    }
    if (Math.abs(dollars) >= 1_000) {
      return `$${(dollars / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(dollars);
}

/** Formats a plain number of cents (from tool results) as a dollar string */
export function formatCentsNumber(cents: number, opts?: { compact?: boolean }): string {
  return formatCents(cents, opts);
}

/** Format a Date or ISO string as "Apr 25, 2026" */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Format a percentage from basis points (e.g. 7523n → "75.23%") */
export function formatBps(bps: bigint | number): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return `${(n / 100).toFixed(1)}%`;
}
