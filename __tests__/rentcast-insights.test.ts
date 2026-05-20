import { describe, it, expect } from "vitest";
import {
  computeRentGap,
  freshnessCopy,
  marketStatsCacheKey,
  marketTemperature,
  normalizeAddress,
  rentAvmCacheKey,
} from "../lib/rentcast/insights";

// ---------------------------------------------------------------------------
// RentCast insights — boundary + copy-shape coverage. Pure helpers, no DB.
// ---------------------------------------------------------------------------

describe("marketTemperature", () => {
  it("returns HOT when median DOM <= 7", () => {
    expect(marketTemperature(0)).toBe("HOT");
    expect(marketTemperature(1)).toBe("HOT");
    expect(marketTemperature(7)).toBe("HOT");
  });

  it("returns WARM at the 8-21 boundary", () => {
    expect(marketTemperature(8)).toBe("WARM");
    expect(marketTemperature(14)).toBe("WARM");
    expect(marketTemperature(21)).toBe("WARM");
  });

  it("returns COOL above 21 days", () => {
    expect(marketTemperature(22)).toBe("COOL");
    expect(marketTemperature(60)).toBe("COOL");
  });

  it("falls back to WARM for null / undefined / NaN", () => {
    expect(marketTemperature(null)).toBe("WARM");
    expect(marketTemperature(undefined)).toBe("WARM");
    expect(marketTemperature(Number.NaN)).toBe("WARM");
  });
});

describe("computeRentGap", () => {
  it("returns 'below' when current rent is more than 2% under market", () => {
    // $1,500/mo vs $1,800 market → -$300, -16.7%
    const gap = computeRentGap(150_000, 1_800);
    expect(gap.direction).toBe("below");
    expect(gap.delta).toBe(300);
    expect(gap.copy).toContain("/mo below market");
    expect(gap.copy).toContain("$3,600/yr");
  });

  it("returns 'at' when current rent is within ±2% of market", () => {
    const gap = computeRentGap(180_000, 1_800);
    expect(gap.direction).toBe("at");
    expect(gap.copy).toBe("Right at market — no action needed.");
  });

  it("returns 'above' when current rent is more than 2% over market", () => {
    // $2,100 vs $1,800 → +$300, +16.7%
    const gap = computeRentGap(210_000, 1_800);
    expect(gap.direction).toBe("above");
    expect(gap.copy).toContain("/mo above market");
    expect(gap.copy).toContain("retention risk");
  });

  it("returns the empty-state copy when current rent is null", () => {
    const gap = computeRentGap(null, 1_800);
    expect(gap.direction).toBe("at");
    expect(gap.copy).toContain("Add a current rent");
  });

  it("guards against invalid market mid values", () => {
    const gap = computeRentGap(150_000, 0);
    expect(gap.direction).toBe("at");
    expect(gap.delta).toBe(0);
  });
});

describe("normalizeAddress", () => {
  it("collapses casing and punctuation to the same key", () => {
    const a = normalizeAddress("2410 Telegraph Ave");
    const b = normalizeAddress("2410 telegraph ave,");
    const c = normalizeAddress("  2410   TELEGRAPH AVE.  ");
    expect(a).toBe("2410-telegraph-ave");
    expect(a).toBe(b);
    expect(a).toBe(c);
  });

  it("preserves unit number hyphens", () => {
    expect(normalizeAddress("2410 Telegraph Ave Apt 201-A")).toBe(
      "2410-telegraph-ave-apt-201-a",
    );
  });
});

describe("cache key shapes", () => {
  it("rentAvmCacheKey produces the documented format", () => {
    expect(
      rentAvmCacheKey({
        address: "2410 Telegraph Ave, Berkeley, CA 94704",
        bedrooms: 2,
        bathrooms: 1,
        propertyType: "Apartment",
      }),
    ).toBe("rent:2410-telegraph-ave-berkeley-ca-94704:2br:1ba:Apartment");
  });

  it("marketStatsCacheKey produces the documented format", () => {
    expect(
      marketStatsCacheKey({ zipCode: "94704", historyRange: 6 }),
    ).toBe("market:94704:Rental:6");
  });
});

describe("freshnessCopy", () => {
  it("rounds to minutes / hours / days based on age", () => {
    const now = Date.now();
    expect(freshnessCopy(new Date(now - 5 * 60_000))).toMatch(/\d+m ago/);
    expect(freshnessCopy(new Date(now - 3 * 60 * 60_000))).toMatch(/\d+h ago/);
    expect(freshnessCopy(new Date(now - 3 * 24 * 60 * 60_000))).toMatch(/\d+d ago/);
  });
});
