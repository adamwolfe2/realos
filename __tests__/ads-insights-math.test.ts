import { describe, expect, it } from "vitest";
import {
  budgetShift,
  byFormat,
  fatigue,
  parseAdsRange,
  weekStart,
  weeklyFunnel,
} from "@/lib/integrations/ads-insights-math";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("ads insights math", () => {
  it("parses only the supported ranges", () => {
    expect(parseAdsRange("7")).toBe(7);
    expect(parseAdsRange(["90"])).toBe(90);
    expect(parseAdsRange("30")).toBe(28);
    expect(parseAdsRange(undefined)).toBe(28);
  });

  it("buckets by Monday weeks and counts stages cumulatively", () => {
    expect(weekStart(day("2026-11-11"))).toBe("2026-11-09"); // Wednesday
    expect(weekStart(day("2026-11-09"))).toBe("2026-11-09"); // Monday
    expect(weekStart(day("2026-11-08"))).toBe("2026-11-02"); // Sunday
    const rows = weeklyFunnel(
      [{ date: day("2026-11-02"), spendCents: 500 }, { date: day("2026-11-10"), spendCents: 700 }],
      [
        { createdAt: day("2026-11-03"), status: "NEW" },
        { createdAt: day("2026-11-04"), status: "SIGNED" },
        { createdAt: day("2026-11-10"), status: "TOURED" },
      ],
    );
    expect(rows).toEqual([
      { week: "2026-11-02", spendCents: 500, leads: 2, tours: 1, signed: 1 },
      { week: "2026-11-09", spendCents: 700, leads: 1, tours: 1, signed: 0 },
    ]);
  });

  it("flags fatigue only with enough data on both ends", () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      date: day(`2026-10-${String(i + 1).padStart(2, "0")}`),
      impressions: 1000,
      clicks: i < 7 ? 30 : 15,
    }));
    expect(fatigue(rows)?.drop).toBeCloseTo(0.5);
    expect(fatigue(rows.slice(0, 13))).toBeNull();
    expect(fatigue(rows.map((r) => ({ ...r, impressions: 100 })))).toBeNull();
  });

  it("groups ads by format", () => {
    const rows = byFormat([
      { format: "image", spendCents: 100, leads: 2, clicks: 10, impressions: 500 },
      { format: null, spendCents: 300, leads: 1, clicks: 5, impressions: 200 },
      { format: "image", spendCents: 50, leads: 1, clicks: 4, impressions: 100 },
    ]);
    expect(rows).toEqual([
      { format: "text", ads: 1, spendCents: 300, leads: 1, clicks: 5, impressions: 200 },
      { format: "image", ads: 2, spendCents: 150, leads: 3, clicks: 14, impressions: 600 },
    ]);
  });

  it("suggests a budget shift only on a 2x gap with enough leases", () => {
    const shift = budgetShift([
      { propertyId: "a", name: "A", spendCents: 200000, signed: 2 },
      { propertyId: "b", name: "B", spendCents: 80000, signed: 2 },
      { propertyId: "c", name: "C", spendCents: 90000, signed: 1 },
      { propertyId: null, name: "Whole portfolio", spendCents: 50000, signed: 9 },
    ]);
    expect(shift).toMatchObject({ from: { id: "a", costPerLeaseCents: 100000 }, to: { id: "b", costPerLeaseCents: 40000 } });
    expect(shift?.ratio).toBeCloseTo(2.5);
    expect(budgetShift([
      { propertyId: "a", name: "A", spendCents: 100000, signed: 2 },
      { propertyId: "b", name: "B", spendCents: 80000, signed: 2 },
    ])).toBeNull();
  });
});

describe("leadSourceForPlatform", () => {
  it("maps every ad platform, including Meta (enum META, source META_ADS)", async () => {
    const { leadSourceForPlatform } = await import("@/lib/integrations/ad-lead-source");
    expect(leadSourceForPlatform("META")).toBe("META_ADS");
    expect(leadSourceForPlatform("GOOGLE_ADS")).toBe("GOOGLE_ADS");
    expect(leadSourceForPlatform("TIKTOK")).toBeNull();
    expect(leadSourceForPlatform("META_ADS")).toBeNull();
  });
});

describe("fallbackBrief", () => {
  it("writes the week from the numbers and turns open suggestions into decisions", async () => {
    const { fallbackBrief } = await import("@/lib/integrations/ads-brief-text");
    const week = { spendCents: 210000, googleCents: 120000, metaCents: 90000, conversions: 180, leads: 60, tours: 18, signed: 3 };
    const brief = fallbackBrief({
      weekStart: "2026-11-02",
      thisWeek: week,
      lastWeek: { ...week, spendCents: 200000, leads: 50 },
      properties: [],
      bestCampaign: { name: "Lair | Search", costPerConversionCents: 900 },
      worstCampaign: { name: "Den | Display", costPerConversionCents: 4100 },
      openSuggestions: ["The Den pays 2.4x more per signed lease than The Lair"],
    });
    expect(brief.headline).toBe("$2,100 in ads, 60 leads, 3 signed leases last week");
    expect(brief.summary).toContain("$1,200 on Google and $900 on Meta");
    expect(brief.summary).toContain("60 leads at $35 per lead (+20% vs the week before)");
    expect(brief.decisions).toEqual([{ title: "The Den pays 2.4x more per signed lease than The Lair", why: expect.any(String) }]);
  });
});
