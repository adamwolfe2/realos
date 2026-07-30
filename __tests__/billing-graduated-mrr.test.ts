import { describe, it, expect } from "vitest";
import {
  TIERS,
  computeGraduatedMonthlyCents,
  subscriptionItemMonthlyCents,
} from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// Regression: /portal/billing showed $0 MRR for graduated Stripe prices.
// Stripe returns unit_amount = null when billing_scheme = "tiers" (the tiers
// array drives the invoice), and the page multiplied that null by quantity.
// The money math now lives here in the domain layer: the page hands over the
// raw subscription-item facts and gets the same monthly cents Stripe's
// graduated invoice will produce.
// ---------------------------------------------------------------------------

// Foundation is the STARTER tier internally (product name ≠ tier id).
const foundation = TIERS.find((t) => t.id === "starter")!;

describe("subscriptionItemMonthlyCents — graduated prices", () => {
  it("graduated monthly with null unit_amount uses the bracket math, not 0", () => {
    const cents = subscriptionItemMonthlyCents({
      lookupKey: foundation.graduatedMonthly.lookupKey,
      unitAmountCents: null, // what Stripe actually returns for tiered prices
      interval: "month",
      quantity: 5,
    });
    // 1 × full base + 4 × 20%-off base (brackets 1 / 2-9).
    const base = foundation.monthly.unitAmountCents;
    expect(cents).toBe(base + 4 * Math.round(base * 0.8));
    expect(cents).toBe(computeGraduatedMonthlyCents(base, 5));
    expect(cents).toBeGreaterThan(0);
  });

  it("graduated annual uses the ANNUAL base rate (already monthly-equivalent)", () => {
    const cents = subscriptionItemMonthlyCents({
      lookupKey: foundation.graduatedAnnual.lookupKey,
      unitAmountCents: null,
      interval: "year",
      quantity: 3,
    });
    expect(cents).toBe(
      computeGraduatedMonthlyCents(foundation.annual.unitAmountCents, 3),
    );
  });

  it("legacy flat monthly price is unchanged: unit_amount × quantity", () => {
    const cents = subscriptionItemMonthlyCents({
      lookupKey: foundation.monthly.lookupKey,
      unitAmountCents: foundation.monthly.unitAmountCents,
      interval: "month",
      quantity: 1,
    });
    expect(cents).toBe(foundation.monthly.unitAmountCents);
  });

  it("legacy flat annual price divides the yearly amount by 12", () => {
    const yearly = foundation.annual.unitAmountCents * 12;
    const cents = subscriptionItemMonthlyCents({
      lookupKey: foundation.annual.lookupKey,
      unitAmountCents: yearly,
      interval: "year",
      quantity: 1,
    });
    expect(cents).toBe(Math.round(yearly / 12));
  });

  it("unknown lookup key returns null (caller decides, no silent 0)", () => {
    expect(
      subscriptionItemMonthlyCents({
        lookupKey: "not_a_tier_price",
        unitAmountCents: 500,
        interval: "month",
        quantity: 1,
      }),
    ).toBeNull();
  });

  it("graduated with zero/negative quantity yields 0, never negative", () => {
    expect(
      subscriptionItemMonthlyCents({
        lookupKey: foundation.graduatedMonthly.lookupKey,
        unitAmountCents: null,
        interval: "month",
        quantity: 0,
      }),
    ).toBe(0);
  });
});
