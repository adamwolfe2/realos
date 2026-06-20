import { describe, it, expect } from "vitest";
import { computeMrrCents } from "@/lib/billing/plans";

// ---------------------------------------------------------------------------
// Regression for the P2 MRR-inflation bug: MRR must be the monthly-normalized
// figure from the subscription items (computeMrrCents), NOT invoice.amount_paid
// (which is the full billing-period charge — ~12x for annual subscribers). The
// invoice.paid webhook no longer writes mrrCents; this locks the canonical
// normalization that owns it.
// ---------------------------------------------------------------------------

const item = (unit: number, interval: string, quantity = 1, usageType = "licensed") => ({
  quantity,
  price: { unit_amount: unit, recurring: { interval, usage_type: usageType } },
});

describe("computeMrrCents (canonical MRR source)", () => {
  it("counts a monthly price at face value", () => {
    expect(computeMrrCents([item(99_00, "month")])).toBe(99_00);
  });

  it("normalizes an ANNUAL price to a monthly figure (/12)", () => {
    // $11,880/yr → $990/mo, NOT $11,880/mo (the invoice.amount_paid bug).
    expect(computeMrrCents([item(11_880_00, "year")])).toBe(990_00);
  });

  it("sums mixed monthly + annual modules and multiplies by quantity", () => {
    expect(
      computeMrrCents([item(50_00, "month", 2), item(1_200_00, "year")]),
    ).toBe(50_00 * 2 + Math.round(1_200_00 / 12)); // 10000 + 10000
  });

  it("ignores metered (usage-based) items", () => {
    expect(computeMrrCents([item(500_00, "month", 1, "metered")])).toBe(0);
  });

  it("is zero for an empty subscription", () => {
    expect(computeMrrCents([])).toBe(0);
  });
});
