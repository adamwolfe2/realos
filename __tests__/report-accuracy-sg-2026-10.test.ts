// Regressions from the SG Real Estate / Telegraph Commons Jul-Oct 2026
// report audit: inflated active leases, junk competitors, top-10 branded share.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { brandedShareFromRows, currentLeaseWhere, isBrandedQuery } from "@/lib/reports/generate";
import { cleanCompetitorName, competitorKey, rankCompetitors } from "@/lib/reports/competitors";

describe("currentLeaseWhere", () => {
  it("requires an open status (ACTIVE or EXPIRING) and an in-term date range at asOf", () => {
    const asOf = new Date("2026-10-20T00:00:00Z");
    expect(currentLeaseWhere(asOf)).toEqual({
      status: { in: ["ACTIVE", "EXPIRING"] },
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: asOf } }] },
        { OR: [{ endDate: null }, { endDate: { gte: asOf } }] },
      ],
    });
  });

  it("keeps a lease counted through its inclusive end date (midnight-UTC bound)", () => {
    const afternoon = new Date("2026-10-20T15:30:00Z");
    const where = currentLeaseWhere(afternoon);
    expect(where.AND[1]).toEqual({
      OR: [{ endDate: null }, { endDate: { gte: new Date("2026-10-20T00:00:00Z") } }],
    });
  });
});

describe("isBrandedQuery", () => {
  const brand = ["telegraph commons"];
  it("matches only queries containing the brand name", () => {
    expect(isBrandedQuery("Telegraph Commons Berkeley", brand)).toBe(true);
    expect(isBrandedQuery("berkeley student housing", brand)).toBe(false);
    expect(isBrandedQuery("apartments on telegraph", brand)).toBe(false);
  });
});

describe("competitor cleaning", () => {
  it("drops neighborhoods, section labels, streets and landmarks", () => {
    for (const junk of [
      "Budget", "Price range:", "Northside", "Downtown Berkeley", "Telegraph Avenue area",
      "Solano Ave", "Sproul Plaza", "UC Berkeley", "UC Berkeley Off-Campus Housing portal",
      "Ashby/Adeline", "Facebook groups", "Best Apartments", "Best for", "Best Fully Furnished",
      "Rockridge", "Residence halls",
    ]) {
      expect(cleanCompetitorName(junk), junk).toBeNull();
    }
  });

  it("keeps real buildings and strips parenthetical qualifiers", () => {
    expect(cleanCompetitorName("The Durant")).toBe("The Durant");
    expect(cleanCompetitorName("Varsity Berkeley (Downtown)")).toBe("Varsity Berkeley");
    expect(cleanCompetitorName("Stonefire Apartments:")).toBe("Stonefire Apartments");
  });

  it("merges spellings of one building and counts once per answer", () => {
    const ranked = rankCompetitors([
      ["The Standard at Berkeley", "The Standard Berkeley (Downtown)", "Budget"],
      ["The Standard at Berkeley", "The Durant"],
      ["The Standard", "Southside"],
    ]);
    expect(ranked).toEqual([
      { name: "The Standard at Berkeley", mentions: 3 },
      { name: "The Durant", mentions: 1 },
    ]);
  });
});

describe("review fixes (#191)", () => {
  it("keys every spelling of The Standard the same", () => {
    const keys = ["The Standard Berkeley Apartments", "The Standard", "The Standard at Berkeley", "The Standard Berkeley"].map(competitorKey);
    expect(new Set(keys)).toEqual(new Set(["standard"]));
  });

  it("keeps UC Village, drops UC Berkeley and the plural Popular Apartments heading", () => {
    expect(cleanCompetitorName("UC Village")).toBe("UC Village");
    expect(cleanCompetitorName("UC Berkeley")).toBeNull();
    expect(cleanCompetitorName("Popular Apartments")).toBeNull();
  });

  it("computes branded share over all rows, not the top 10", () => {
    // 10 generic rows with the most clicks, then 5 branded rows below them.
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ query: `berkeley housing ${i}`, clicks: 100, impressions: 1000 })),
      ...Array.from({ length: 5 }, (_, i) => ({ query: `telegraph commons ${i}`, clicks: 20, impressions: 50 })),
    ];
    const v = brandedShareFromRows(rows, ["telegraph commons"]);
    expect(v?.brandedClicks).toBe(100);
    expect(v?.brandedImpressions).toBe(250);
    expect(v?.brandedShare).toBe(Math.round((100 / 1100) * 100));
    expect(v?.topBrandedTerms).toHaveLength(5);
    expect(brandedShareFromRows([{ query: "x", clicks: 0, impressions: 3 }], [])).toBeNull();
  });
});
