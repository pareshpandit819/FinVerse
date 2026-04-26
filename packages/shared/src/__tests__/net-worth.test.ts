import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateNetWorth } from "../net-worth.js";
import type { AccountBalance, HoldingValue, LiabilityBalance } from "../net-worth.js";

describe("calculateNetWorth", () => {
  it("returns zero net worth when no accounts", () => {
    const result = calculateNetWorth([], [], []);
    expect(result.netWorth).toBe(0n);
    expect(result.totalAssets).toBe(0n);
    expect(result.totalLiabilities).toBe(0n);
  });

  it("calculates simple checking + savings correctly", () => {
    const accounts: AccountBalance[] = [
      { id: "1", type: "depository", subtype: "checking", balanceCurrent: 100000n, isoCurrencyCode: "USD" },
      { id: "2", type: "depository", subtype: "savings", balanceCurrent: 500000n, isoCurrencyCode: "USD" },
    ];
    const result = calculateNetWorth(accounts, [], []);
    expect(result.totalAssets).toBe(600000n);
    expect(result.totalLiabilities).toBe(0n);
    expect(result.netWorth).toBe(600000n);
    expect(result.breakdown.checking).toBe(100000n);
    expect(result.breakdown.savings).toBe(500000n);
  });

  it("subtracts credit liabilities from assets", () => {
    const accounts: AccountBalance[] = [
      { id: "1", type: "depository", subtype: "checking", balanceCurrent: 500000n, isoCurrencyCode: "USD" },
      { id: "2", type: "credit", subtype: "credit card", balanceCurrent: 200000n, isoCurrencyCode: "USD" },
    ];
    const result = calculateNetWorth(accounts, [], []);
    expect(result.totalAssets).toBe(500000n);
    expect(result.totalLiabilities).toBe(200000n);
    expect(result.netWorth).toBe(300000n);
  });

  it("net worth can be negative (more debt than assets)", () => {
    const accounts: AccountBalance[] = [
      { id: "1", type: "depository", subtype: "checking", balanceCurrent: 100n, isoCurrencyCode: "USD" },
      { id: "2", type: "loan", subtype: "mortgage", balanceCurrent: 100000000n, isoCurrencyCode: "USD" },
    ];
    const result = calculateNetWorth(accounts, [], []);
    expect(result.netWorth).toBe(100n - 100000000n);
  });

  it("uses holdings total when provided (overrides investment account balance)", () => {
    const accounts: AccountBalance[] = [
      { id: "1", type: "investment", subtype: "brokerage", balanceCurrent: 100000n, isoCurrencyCode: "USD" },
    ];
    const holdings: HoldingValue[] = [
      { id: "h1", institutionValue: 120000n, isoCurrencyCode: "USD" },
      { id: "h2", institutionValue: 80000n, isoCurrencyCode: "USD" },
    ];
    const result = calculateNetWorth(accounts, holdings, []);
    expect(result.breakdown.investment).toBe(200000n);
  });

  it("property: netWorth === totalAssets - totalLiabilities", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constantFrom("depository", "credit", "loan", "investment", "other") as fc.Arbitrary<
              "depository" | "credit" | "loan" | "investment" | "other"
            >,
            subtype: fc.constantFrom("checking", "savings", "credit card", "mortgage", "brokerage"),
            balanceCurrent: fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
            isoCurrencyCode: fc.constant("USD"),
          }),
          { maxLength: 10 }
        ),
        (accounts) => {
          const result = calculateNetWorth(accounts, [], []);
          return result.netWorth === result.totalAssets - result.totalLiabilities;
        }
      )
    );
  });

  it("property: totalAssets is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constantFrom("depository", "investment", "other") as fc.Arbitrary<
              "depository" | "investment" | "other"
            >,
            subtype: fc.constant("checking"),
            balanceCurrent: fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
            isoCurrencyCode: fc.constant("USD"),
          }),
          { maxLength: 10 }
        ),
        (accounts) => {
          const result = calculateNetWorth(accounts, [], []);
          return result.totalAssets >= 0n;
        }
      )
    );
  });
});
