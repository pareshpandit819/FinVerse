import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { projectGoal } from "../goal.js";

const NOW = new Date("2026-04-25T00:00:00Z");
const IN_ONE_YEAR = new Date("2027-04-25T00:00:00Z");

describe("projectGoal", () => {
  it("returns isCompleted=true when currentAmount >= targetAmount", () => {
    const result = projectGoal({
      targetAmount: 100000n,
      currentAmount: 100000n,
      targetDate: IN_ONE_YEAR,
      referenceDate: NOW,
    });
    expect(result.isCompleted).toBe(true);
    expect(result.progressBps).toBe(10000n);
    expect(result.amountRemaining).toBe(0n);
  });

  it("isCompleted=false when below target", () => {
    const result = projectGoal({
      targetAmount: 100000n,
      currentAmount: 50000n,
      targetDate: IN_ONE_YEAR,
      referenceDate: NOW,
    });
    expect(result.isCompleted).toBe(false);
    expect(result.progressBps).toBe(5000n);
    expect(result.amountRemaining).toBe(50000n);
  });

  it("isOnTrack=true when monthly contribution covers required rate", () => {
    const result = projectGoal(
      { targetAmount: 120000n, currentAmount: 0n, targetDate: IN_ONE_YEAR, referenceDate: NOW },
      12000n // 120,000 / 12 months = 10,000/mo needed; 12,000 > 10,000
    );
    expect(result.isOnTrack).toBe(true);
  });

  it("isOnTrack=false when contribution is below required rate", () => {
    const result = projectGoal(
      { targetAmount: 120000n, currentAmount: 0n, targetDate: IN_ONE_YEAR, referenceDate: NOW },
      5000n
    );
    expect(result.isOnTrack).toBe(false);
  });

  it("isOnTrack=null when no contribution rate provided", () => {
    const result = projectGoal({
      targetAmount: 100000n,
      currentAmount: 0n,
      targetDate: IN_ONE_YEAR,
      referenceDate: NOW,
    });
    expect(result.isOnTrack).toBeNull();
    expect(result.projectedCompletionDate).toBeNull();
  });

  it("daysRemaining is 0 when target date has passed", () => {
    const result = projectGoal({
      targetAmount: 100000n,
      currentAmount: 50000n,
      targetDate: new Date("2020-01-01"),
      referenceDate: NOW,
    });
    expect(result.daysRemaining).toBe(0);
  });

  it("requiredMonthlyContribution is 0 when already completed", () => {
    const result = projectGoal({
      targetAmount: 100000n,
      currentAmount: 150000n,
      targetDate: IN_ONE_YEAR,
      referenceDate: NOW,
    });
    expect(result.requiredMonthlyContribution).toBe(0n);
    expect(result.requiredDailyContribution).toBe(0n);
  });

  it("property: progressBps is always 0–10000", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 10_000_000n }),
        fc.bigInt({ min: 0n, max: 10_000_000n }),
        (target, current) => {
          const result = projectGoal({
            targetAmount: target > 0n ? target : 1n,
            currentAmount: current,
            targetDate: IN_ONE_YEAR,
            referenceDate: NOW,
          });
          return result.progressBps >= 0n && result.progressBps <= 10000n;
        }
      )
    );
  });
});
