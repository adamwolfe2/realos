// Regressions from the SG Real Estate / Telegraph Commons Jul-Oct 2026
// report audit: inflated active leases, junk competitors, top-10 branded share.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { brandedShareFromRows, currentLeaseWhere, isBrandedQuery } from "@/lib/reports/generate";
import { cleanCompetitorName, competitorKey, rankCompetitors } from "@/lib/reports/competitors";

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

describe("data sources and popup tracking (portal signals)", () => {
  it("a source with data in the window is connected even with a stale sync", async () => {
    const { dataSourceStatus } = await import("@/lib/reports/generate");
    const threshold = new Date("2026-09-21T00:00:00Z");
    expect(dataSourceStatus(null, false, true, threshold).connected).toBe(true);
    // Stale sync WITH window data: still connected.
    expect(dataSourceStatus(new Date("2026-01-01"), true, true, threshold).connected).toBe(true);
    expect(dataSourceStatus(new Date("2026-01-01"), true, false, threshold).connected).toBe(false);
    expect(dataSourceStatus(new Date("2026-10-20"), true, false, threshold).connected).toBe(true);
  });

  it("popup conversion rate is null until tracking covered the whole window", async () => {
    const { popupConversionRate } = await import("@/lib/reports/popup-stats");
    const start = new Date("2026-07-19T00:00:00Z");
    expect(popupConversionRate(1000, 1, new Date("2026-10-20T22:40:00Z"), start)).toBeNull();
    expect(popupConversionRate(1000, 0, null, start)).toBeNull();
    expect(popupConversionRate(1000, 20, new Date("2026-05-14"), start)).toBe(2);
    expect(popupConversionRate(0, 0, new Date("2026-05-14"), start)).toBeNull();
  });
});

describe("stalled content drafts", () => {
  it("GENERATING older than 24h is stalled; fresh or other statuses are not", async () => {
    const { isStalledDraft } = await import("@/lib/seo/draft-stalled");
    const now = new Date("2026-10-21T00:00:00Z");
    expect(isStalledDraft({ status: "GENERATING", updatedAt: new Date("2026-05-22") }, now)).toBe(true);
    expect(isStalledDraft({ status: "GENERATING", updatedAt: new Date("2026-10-20T12:00:00Z") }, now)).toBe(false);
    expect(isStalledDraft({ status: "PENDING_REVIEW", updatedAt: new Date("2026-05-22") }, now)).toBe(false);
  });

  it("stalledDraftWhere uses the same 24h cutoff, and stalled rows do not count as in flight", async () => {
    const { stalledDraftWhere } = await import("@/lib/seo/draft-stalled");
    const now = new Date("2026-10-21T00:00:00Z");
    expect(stalledDraftWhere(now)).toEqual({
      status: "GENERATING",
      updatedAt: { lt: new Date("2026-10-20T00:00:00Z") },
    });
    const fs = await import("fs");
    const route = fs.readFileSync("app/api/portal/seo/drafts/route.ts", "utf8");
    const cap = route.slice(route.indexOf("const inFlight"), route.indexOf("if (inFlight >= 10)"));
    expect(cap).toContain("NOT: stalledDraftWhere()");
    const page = fs.readFileSync("app/portal/seo/drafts/page.tsx", "utf8");
    expect(page).toMatch(/CHANGES_REQUESTED"\) \?\? 0\) -\s*stalledCount/);
  });
});
