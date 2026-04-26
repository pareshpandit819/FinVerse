import { describe, it, expect } from "vitest";
import { mapCategory } from "../categorize.js";

describe("mapCategory", () => {
  it("maps food-related names", () => {
    expect(mapCategory("Whole Foods grocery store")).toBe("Food & Dining");
    expect(mapCategory("Starbucks coffee")).toBe("Food & Dining");
    expect(mapCategory("Chipotle restaurant")).toBe("Food & Dining");
  });

  it("maps travel and transport", () => {
    expect(mapCategory("Shell gas station")).toBe("Travel & Transport");
    expect(mapCategory("Uber ride")).toBe("Travel & Transport");
    expect(mapCategory("Delta airline flight")).toBe("Travel & Transport");
  });

  it("maps entertainment", () => {
    expect(mapCategory("Netflix streaming")).toBe("Entertainment");
    expect(mapCategory("Spotify music")).toBe("Entertainment");
  });

  it("maps subscriptions/software", () => {
    expect(mapCategory("Adobe subscription")).toBe("Subscriptions");
    expect(mapCategory("GitHub SaaS")).toBe("Subscriptions");
  });

  it("maps health", () => {
    expect(mapCategory("CVS pharmacy")).toBe("Health & Wellness");
    expect(mapCategory("Planet Fitness gym")).toBe("Health & Wellness");
  });

  it("maps shopping", () => {
    expect(mapCategory("Amazon retail shopping")).toBe("Shopping");
    expect(mapCategory("Zara clothing store")).toBe("Shopping");
  });

  it("maps utilities/bills", () => {
    expect(mapCategory("AT&T phone bill")).toBe("Bills & Utilities");
    expect(mapCategory("PG&E electric utilities")).toBe("Bills & Utilities");
  });

  it("falls back to Other for unknown names", () => {
    expect(mapCategory("Miscellaneous charge")).toBe("Other");
    expect(mapCategory("")).toBe("Other");
  });
});
