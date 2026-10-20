// Regressions from the SG Real Estate / Telegraph Commons Jul-Oct 2026
// report audit: inflated active leases, junk competitors, top-10 branded share.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { currentLeaseWhere, isBrandedQuery } from "@/lib/reports/generate";
import { cleanCompetitorName, rankCompetitors } from "@/lib/reports/competitors";

describe("currentLeaseWhere", () => {
  it("requires ACTIVE and an in-term date range at asOf", () => {
    const asOf = new Date("2026-10-20T00:00:00Z");
    expect(currentLeaseWhere(asOf)).toEqual({
      status: "ACTIVE",
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: asOf } }] },
        { OR: [{ endDate: null }, { endDate: { gte: asOf } }] },
      ],
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
