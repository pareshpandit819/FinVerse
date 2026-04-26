import { describe, it, expect } from "vitest";
import { mapPlaidCategory } from "../categorize.js";

describe("mapPlaidCategory", () => {
  it("maps food categories", () => {
    expect(mapPlaidCategory(["Food and Drink", "Restaurants"])).toBe("Food & Dining");
    expect(mapPlaidCategory(["Shops", "Grocery Stores"])).toBe("Food & Dining");
  });

  it("maps travel and transport", () => {
    expect(mapPlaidCategory(["Travel", "Airlines and Aviation Services"])).toBe("Travel & Transport");
    expect(mapPlaidCategory(["Travel", "Gas Stations"])).toBe("Travel & Transport");
  });

  it("maps entertainment", () => {
    expect(mapPlaidCategory(["Recreation", "Streaming Services"])).toBe("Entertainment");
  });

  it("maps subscriptions/software", () => {
    expect(mapPlaidCategory(["Service", "Subscription"])).toBe("Subscriptions");
  });

  it("maps health", () => {
    expect(mapPlaidCategory(["Medical", "Pharmacy"])).toBe("Health & Wellness");
  });

  it("maps shopping", () => {
    expect(mapPlaidCategory(["Shops", "Clothing and Accessories"])).toBe("Shopping");
  });

  it("maps utilities/bills", () => {
    expect(mapPlaidCategory(["Service", "Utilities"])).toBe("Bills & Utilities");
  });

  it("falls back to Other for unknown categories", () => {
    expect(mapPlaidCategory(["Unknown", "Miscellaneous"])).toBe("Other");
    expect(mapPlaidCategory([])).toBe("Other");
  });

  it("uses first matching category in the list", () => {
    // "Food" matches before "Travel" — first matching item wins
    const result = mapPlaidCategory(["Coffee Shop", "Airlines"]);
    expect(result).toBe("Food & Dining");
  });
});
