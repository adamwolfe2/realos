import { describe, it, expect } from "vitest";
import { computeLostLeads } from "@/lib/marketing/lost-leads-math";

// Pure-function coverage for the /lost-leads calculator math. No grounded
// "95% anonymous" stat exists in PRODUCT.md, so this is straight
// visitors - leads with clamping — lock in the clamps so a bad input never
// prints a negative or NaN on the marketing page.

describe("computeLostLeads", () => {
  it("subtracts leads from visitors for the headline number", () => {
    expect(computeLostLeads(1000, 40)).toEqual({
      lostLeads: 960,
      unnamedRate: 96,
    });
  });

  it("clamps to zero when leads exceed visitors (never negative)", () => {
    expect(computeLostLeads(50, 200)).toEqual({ lostLeads: 0, unnamedRate: 0 });
  });

  it("returns zero rate when visitors is zero (no divide-by-zero)", () => {
    expect(computeLostLeads(0, 0)).toEqual({ lostLeads: 0, unnamedRate: 0 });
  });

  it("floors fractional input and clamps negatives", () => {
    expect(computeLostLeads(100.9, -5)).toEqual({
      lostLeads: 100,
      unnamedRate: 100,
    });
  });

  it("treats NaN input as zero instead of propagating NaN", () => {
    expect(computeLostLeads(NaN, 10)).toEqual({ lostLeads: 0, unnamedRate: 0 });
  });
});
