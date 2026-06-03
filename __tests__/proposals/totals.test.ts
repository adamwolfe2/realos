import { describe, it, expect } from "vitest";
import {
  allocateDiscountCents,
  computeProposalTotalsCents,
  computeSubtotalsCents,
} from "@/lib/proposals/totals";

// ---------------------------------------------------------------------------
// Proposal totals math is the load-bearing core of pricing. Every render of
// the composer, every invoice, every PDF reads from these helpers — a bug
// here is a cash bug. These tests pin the behavior across:
//   - empty / single / multi-line inputs
//   - recurring vs one-time mix
//   - discount allocation under each scope
//   - trial period (recurring shifted out of invoice #1)
// ---------------------------------------------------------------------------

const recurring = (cents: number, qty = 1) => ({
  unitPriceCents: cents,
  quantity: qty,
  recurring: true,
});

const oneTime = (cents: number, qty = 1) => ({
  unitPriceCents: cents,
  quantity: qty,
  recurring: false,
});

describe("computeSubtotalsCents", () => {
  it("returns zeros for empty input", () => {
    expect(computeSubtotalsCents([])).toEqual({ recurring: 0, oneTime: 0 });
  });

  it("multiplies unit price by quantity", () => {
    expect(computeSubtotalsCents([recurring(1999, 3)])).toEqual({
      recurring: 5997,
      oneTime: 0,
    });
  });

  it("buckets recurring vs one-time correctly", () => {
    expect(
      computeSubtotalsCents([recurring(89900), oneTime(250000), recurring(14900)]),
    ).toEqual({ recurring: 104800, oneTime: 250000 });
  });

  it("clamps negative or non-finite prices to 0", () => {
    expect(
      computeSubtotalsCents([
        { unitPriceCents: -100, quantity: 1, recurring: true },
        { unitPriceCents: NaN, quantity: 1, recurring: true },
        recurring(500),
      ]),
    ).toEqual({ recurring: 500, oneTime: 0 });
  });

  it("defaults invalid quantities to 1", () => {
    expect(
      computeSubtotalsCents([
        { unitPriceCents: 100, quantity: 0, recurring: true },
        { unitPriceCents: 100, quantity: -3, recurring: true },
      ]),
    ).toEqual({ recurring: 200, oneTime: 0 });
  });
});

describe("allocateDiscountCents", () => {
  it("zero discount → zero allocation", () => {
    expect(
      allocateDiscountCents({
        recurringSubtotal: 1000,
        oneTimeSubtotal: 500,
        discountAmount: 0,
        scope: "both",
      }),
    ).toEqual({ recurring: 0, oneTime: 0 });
  });

  it("scope=recurring lands the whole discount on recurring (clamped)", () => {
    expect(
      allocateDiscountCents({
        recurringSubtotal: 1000,
        oneTimeSubtotal: 500,
        discountAmount: 800,
        scope: "recurring",
      }),
    ).toEqual({ recurring: 800, oneTime: 0 });
    expect(
      allocateDiscountCents({
        recurringSubtotal: 1000,
        oneTimeSubtotal: 500,
        discountAmount: 9999,
        scope: "recurring",
      }),
    ).toEqual({ recurring: 1000, oneTime: 0 });
  });

  it("scope=one_time lands on one-time", () => {
    expect(
      allocateDiscountCents({
        recurringSubtotal: 1000,
        oneTimeSubtotal: 500,
        discountAmount: 9999,
        scope: "one_time",
      }),
    ).toEqual({ recurring: 0, oneTime: 500 });
  });

  it("scope=both pro-rates across subtotals (exact sum, no off-by-one)", () => {
    const r = allocateDiscountCents({
      recurringSubtotal: 800,
      oneTimeSubtotal: 200,
      discountAmount: 200,
      scope: "both",
    });
    // 80% goes to recurring, 20% to one-time
    expect(r.recurring + r.oneTime).toBe(200);
    expect(r.recurring).toBe(160);
    expect(r.oneTime).toBe(40);
  });

  it("scope=both with a zero bucket lands fully on the non-zero side", () => {
    expect(
      allocateDiscountCents({
        recurringSubtotal: 0,
        oneTimeSubtotal: 500,
        discountAmount: 200,
        scope: "both",
      }),
    ).toEqual({ recurring: 0, oneTime: 200 });
  });
});

describe("computeProposalTotalsCents", () => {
  it("recurring-only, no discount, no trial", () => {
    const t = computeProposalTotalsCents(
      { cadence: "MONTHLY", trialDays: 0, discountAmountCents: 0, discountScope: "both" },
      [recurring(89900)],
    );
    expect(t.recurringTotal).toBe(89900);
    expect(t.oneTimeTotal).toBe(0);
    expect(t.firstInvoiceTotal).toBe(89900);
    expect(t.hasTrial).toBe(false);
  });

  it("recurring + one-time setup, no trial → both hit first invoice", () => {
    const t = computeProposalTotalsCents(
      { cadence: "MONTHLY", trialDays: 0, discountAmountCents: 0, discountScope: "both" },
      [recurring(89900), oneTime(250000)],
    );
    expect(t.firstInvoiceTotal).toBe(89900 + 250000);
  });

  it("recurring + one-time + trial → only one-time hits first invoice", () => {
    const t = computeProposalTotalsCents(
      { cadence: "MONTHLY", trialDays: 14, discountAmountCents: 0, discountScope: "both" },
      [recurring(89900), oneTime(250000)],
    );
    expect(t.hasTrial).toBe(true);
    expect(t.firstInvoiceTotal).toBe(250000);
    expect(t.recurringTotal).toBe(89900);
  });

  it("scope=recurring discount on mixed lines", () => {
    const t = computeProposalTotalsCents(
      { cadence: "MONTHLY", trialDays: 0, discountAmountCents: 10000, discountScope: "recurring" },
      [recurring(89900), oneTime(250000)],
    );
    expect(t.recurringDiscount).toBe(10000);
    expect(t.oneTimeDiscount).toBe(0);
    expect(t.recurringTotal).toBe(79900);
    expect(t.firstInvoiceTotal).toBe(79900 + 250000);
  });

  it("annual cadence preserved", () => {
    const t = computeProposalTotalsCents(
      { cadence: "ANNUAL", trialDays: 0, discountAmountCents: 0, discountScope: "both" },
      [recurring(749 * 100 * 12)], // year prepay equivalent
    );
    expect(t.cadence).toBe("ANNUAL");
    expect(t.recurringTotal).toBe(898800);
  });

  it("one-time only, null cadence", () => {
    const t = computeProposalTotalsCents(
      { cadence: null, trialDays: 0, discountAmountCents: 0, discountScope: "both" },
      [oneTime(250000)],
    );
    expect(t.cadence).toBeNull();
    expect(t.recurringTotal).toBe(0);
    expect(t.firstInvoiceTotal).toBe(250000);
  });

  it("invalid discountScope falls back to 'both'", () => {
    const t = computeProposalTotalsCents(
      { cadence: "MONTHLY", trialDays: 0, discountAmountCents: 100, discountScope: "garbage" },
      [recurring(1000), oneTime(1000)],
    );
    expect(t.recurringDiscount + t.oneTimeDiscount).toBe(100);
  });
});
