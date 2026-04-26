import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { calculateBudget } from "../budget.js";

describe("calculateBudget", () => {
  it("marks a category as breached when spent exceeds limit", () => {
    const result = calculateBudget(
      [{ category: "Food", limitAmount: 50000n, spentAmount: 60000n, rolloverCarryIn: 0n }],
      false
    );
    expect(result.categories[0]?.isBreached).toBe(true);
    expect(result.categories[0]?.overage).toBe(10000n);
    expect(result.isBreached).toBe(true);
  });

  it("marks category as not breached when under limit", () => {
    const result = calculateBudget(
      [{ category: "Food", limitAmount: 50000n, spentAmount: 30000n, rolloverCarryIn: 0n }],
      false
    );
    expect(result.categories[0]?.isBreached).toBe(false);
    expect(result.categories[0]?.remaining).toBe(20000n);
  });

  it("applies rollover carry-in to effective limit", () => {
    const result = calculateBudget(
      [{ category: "Entertainment", limitAmount: 20000n, spentAmount: 25000n, rolloverCarryIn: 10000n }],
      true
    );
    expect(result.categories[0]?.effectiveLimit).toBe(30000n);
    expect(result.categories[0]?.isBreached).toBe(false);
    expect(result.categories[0]?.remaining).toBe(5000n);
  });

  it("rollover carry-out is zero when category is breached", () => {
    const result = calculateBudget(
      [{ category: "Shopping", limitAmount: 10000n, spentAmount: 15000n, rolloverCarryIn: 0n }],
      true
    );
    expect(result.categories[0]?.rolloverCarryOut).toBe(0n);
  });

  it("rollover carry-out equals remaining when under limit", () => {
    const result = calculateBudget(
      [{ category: "Transport", limitAmount: 10000n, spentAmount: 3000n, rolloverCarryIn: 0n }],
      true
    );
    expect(result.categories[0]?.rolloverCarryOut).toBe(7000n);
  });

  it("no rollover carry-out when rollover=false", () => {
    const result = calculateBudget(
      [{ category: "Transport", limitAmount: 10000n, spentAmount: 3000n, rolloverCarryIn: 0n }],
      false
    );
    expect(result.categories[0]?.rolloverCarryOut).toBe(0n);
  });

  it("utilization is 100% (10000 bps) when at limit", () => {
    const result = calculateBudget(
      [{ category: "X", limitAmount: 10000n, spentAmount: 10000n, rolloverCarryIn: 0n }],
      false
    );
    expect(result.categories[0]?.utilizationBps).toBe(10000n);
  });

  it("property: totalSpent === sum of category spentAmounts", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            category: fc.string({ minLength: 1, maxLength: 20 }),
            limitAmount: fc.bigInt({ min: 0n, max: 1_000_000n }),
            spentAmount: fc.bigInt({ min: 0n, max: 1_000_000n }),
            rolloverCarryIn: fc.bigInt({ min: 0n, max: 100_000n }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.boolean(),
        (cats, rollover) => {
          const result = calculateBudget(cats, rollover);
          const expectedTotal = cats.reduce((s, c) => s + c.spentAmount, 0n);
          return result.totalSpent === expectedTotal;
        }
      )
    );
  });
});
