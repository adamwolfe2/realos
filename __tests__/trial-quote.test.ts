import { describe, it, expect } from "vitest";
import {
  trialQuote,
  formatUsd,
  formatChargeDate,
} from "@/lib/billing/trial-quote";
import { TIERS, computeGraduatedMonthlyCents } from "@/lib/billing/catalog";

describe("trialQuote", () => {
  it("quotes the tier's graduated price x property count (what checkout bills)", () => {
    const growth = TIERS.find((t) => t.tier === "GROWTH")!;
    expect(trialQuote("GROWTH", 3)).toEqual({
      tierId: "growth",
      planName: "Growth",
      propertyCount: 3,
      monthlyCents: computeGraduatedMonthlyCents(growth.monthly.unitAmountCents, 3),
    });
  });
  it("bills at least one property", () => {
    expect(trialQuote("STARTER", 0)?.monthlyCents).toBe(49900);
  });
  it("returns null for custom or missing tiers", () => {
    expect(trialQuote("CUSTOM", 2)).toBeNull();
    expect(trialQuote(null, 2)).toBeNull();
  });
});

describe("formatting", () => {
  it("formats whole and fractional dollars", () => {
    expect(formatUsd(89900)).toBe("$899");
    expect(formatUsd(149950)).toBe("$1,499.50");
  });
  it("shows the Pacific calendar date so it is never later than the charge", () => {
    // 04:00 UTC Oct 14 is 21:00 PDT Oct 13.
    expect(formatChargeDate(new Date("2026-10-14T04:00:00Z"))).toBe("October 13, 2026");
  });
});
