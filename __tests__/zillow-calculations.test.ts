import { describe, it, expect } from "vitest";
import {
  computeCalculations,
  monthlyPayment,
} from "@/lib/zillow/calculations";

describe("monthlyPayment", () => {
  it("computes a standard 30-year fixed amortization", () => {
    // $400k @ 7% / 30y → ~$2,661.21/mo
    const m = monthlyPayment(400_000, 0.07, 30);
    expect(m).toBeGreaterThan(2660);
    expect(m).toBeLessThan(2662);
  });

  it("handles 0% rate as a straight-line division", () => {
    // $360k / 360 months = $1000/mo
    expect(monthlyPayment(360_000, 0, 30)).toBeCloseTo(1000, 5);
  });

  it("returns 0 for non-positive principal or term", () => {
    expect(monthlyPayment(0, 0.07, 30)).toBe(0);
    expect(monthlyPayment(100_000, 0.07, 0)).toBe(0);
    expect(monthlyPayment(-1, 0.07, 30)).toBe(0);
  });
});

describe("computeCalculations", () => {
  it("returns the three down-payment tiers", () => {
    const out = computeCalculations({ listPrice: 500_000 });
    expect(out.downPayments.map((d) => d.downPct)).toEqual([0.2, 0.25, 0.3]);
    expect(out.downPayments[0].downPayment).toBe(100_000);
    expect(out.downPayments[1].downPayment).toBe(125_000);
    expect(out.downPayments[2].downPayment).toBe(150_000);
  });

  it("computes monthly P&I per tier at the default 7%/30y", () => {
    const out = computeCalculations({ listPrice: 500_000 });
    // $400k loan @ 7%/30y → ~$2661
    expect(out.downPayments[0].loanAmount).toBe(400_000);
    expect(out.downPayments[0].monthlyPI).toBeGreaterThan(2655);
    expect(out.downPayments[0].monthlyPI).toBeLessThan(2666);
    // $350k loan should be lower
    expect(out.downPayments[2].monthlyPI).toBeLessThan(
      out.downPayments[0].monthlyPI,
    );
  });

  it("omits cap/p2r/coc when rentZestimate is missing", () => {
    const out = computeCalculations({ listPrice: 500_000 });
    expect(out.capRate).toBeNull();
    expect(out.priceToRent).toBeNull();
    expect(out.cashOnCashAt20).toBeNull();
  });

  it("computes cap rate and price-to-rent when rent is present", () => {
    const out = computeCalculations({
      listPrice: 500_000,
      rentZestimate: 3000,
    });
    // 3000 * 12 / 500000 = 0.072
    expect(out.capRate).toBeCloseTo(0.072, 4);
    // 500000 / 36000 = 13.888...
    expect(out.priceToRent).toBeCloseTo(13.889, 2);
  });

  it("computes cash-on-cash at 20% down with a 30% expense reserve", () => {
    const out = computeCalculations({
      listPrice: 500_000,
      rentZestimate: 3000,
    });
    // Annual rent 36000; expense reserve 30% = 10800; annual P&I ~31934
    // CashFlow ≈ 36000 - 31934 - 10800 ≈ -6734; ÷ 100000 down ≈ -6.7%
    expect(out.cashOnCashAt20).not.toBeNull();
    expect(out.cashOnCashAt20!).toBeGreaterThan(-0.08);
    expect(out.cashOnCashAt20!).toBeLessThan(-0.05);
  });

  it("handles bad list price gracefully", () => {
    const out = computeCalculations({ listPrice: 0 });
    expect(out.downPayments).toEqual([]);
    expect(out.capRate).toBeNull();
    expect(out.priceToRent).toBeNull();
    expect(out.cashOnCashAt20).toBeNull();
  });

  it("respects custom rate / term / expense reserve overrides", () => {
    const out = computeCalculations({
      listPrice: 500_000,
      rentZestimate: 3000,
      mortgageRate: 0.05,
      termYears: 15,
      expenseReserveFrac: 0.4,
    });
    expect(out.assumptions).toEqual({
      mortgageRate: 0.05,
      termYears: 15,
      expenseReserveFrac: 0.4,
    });
    // 15y notes are higher monthly than 30y notes for the same loan
    expect(out.downPayments[0].monthlyPI).toBeGreaterThan(2700);
  });
});
