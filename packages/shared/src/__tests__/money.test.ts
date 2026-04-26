import { describe, expect, it } from "vitest";
import { toCents, centsToDollars, formatCurrency, percentageBps, bigintReplacer, bigintReviver } from "../money.js";

describe("toCents", () => {
  it("converts 12.34 to 1234n", () => {
    expect(toCents(12.34)).toBe(1234n);
  });

  it("handles negative amounts as positive cents", () => {
    expect(toCents(-45.67)).toBe(4567n);
  });

  it("rounds floating point correctly", () => {
    expect(toCents(0.1 + 0.2)).toBe(30n);
  });
});

describe("centsToDollars", () => {
  it("converts 1234n to 12.34", () => {
    expect(centsToDollars(1234n)).toBeCloseTo(12.34);
  });
});

describe("percentageBps", () => {
  it("returns 5000 bps for 50%", () => {
    expect(percentageBps(50n, 100n)).toBe(5000n);
  });

  it("returns 0 for zero denominator", () => {
    expect(percentageBps(100n, 0n)).toBe(0n);
  });
});

describe("bigintReplacer / bigintReviver", () => {
  it("round-trips a BigInt through JSON", () => {
    const obj = { amount: 123456789012345678n };
    const json = JSON.stringify(obj, bigintReplacer);
    const parsed = JSON.parse(json, bigintReviver) as { amount: bigint };
    expect(parsed.amount).toBe(123456789012345678n);
  });
});

describe("formatCurrency", () => {
  it("formats cents as USD string", () => {
    expect(formatCurrency(1234n)).toBe("$12.34");
  });
});
