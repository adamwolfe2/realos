import { describe, it, expect } from "vitest";
import { dedupeSupersededByDate } from "@/lib/seo/snapshot-supersede";

// ---------------------------------------------------------------------------
// 2026-08-01 review fix (item 3): the seo-sync write-side supersede
// (lib/integrations/seo-sync.ts deletes a date's org-wide NULL SeoSnapshot
// row once a property-scoped row covers it) is best-effort — a deleteMany
// failure is caught and only logged, and seed/backfill scripts write rows
// without triggering it at all. So an org-wide (unfiltered) aggregate read
// CAN see both a NULL row and a property row for the same date. This pins
// the read-side dedupe: property rows win per date, NULL rows are kept
// only for dates with no property-scoped coverage at all.
// ---------------------------------------------------------------------------

type Row = { date: Date; propertyId: string | null; totalClicks: number };

describe("dedupeSupersededByDate", () => {
  it("drops the NULL row for a date that also has a property row", () => {
    const day = new Date("2026-07-15");
    const rows: Row[] = [
      { date: day, propertyId: null, totalClicks: 999 },
      { date: day, propertyId: "prop-1", totalClicks: 5 },
    ];
    expect(dedupeSupersededByDate(rows)).toEqual([
      { date: day, propertyId: "prop-1", totalClicks: 5 },
    ]);
  });

  it("keeps the NULL row for a date with no property-scoped coverage", () => {
    const day = new Date("2026-07-16");
    const rows: Row[] = [{ date: day, propertyId: null, totalClicks: 42 }];
    expect(dedupeSupersededByDate(rows)).toEqual(rows);
  });

  it("keeps multiple property rows for the same date (different properties, no NULL row)", () => {
    const day = new Date("2026-07-17");
    const rows: Row[] = [
      { date: day, propertyId: "prop-1", totalClicks: 5 },
      { date: day, propertyId: "prop-2", totalClicks: 7 },
    ];
    expect(dedupeSupersededByDate(rows)).toEqual(rows);
  });

  it("is a no-op when every row is already property-scoped (property-filtered reads)", () => {
    const rows: Row[] = [
      { date: new Date("2026-07-01"), propertyId: "prop-1", totalClicks: 1 },
      { date: new Date("2026-07-02"), propertyId: "prop-1", totalClicks: 2 },
    ];
    expect(dedupeSupersededByDate(rows)).toEqual(rows);
  });

  it("handles a mix across multiple dates independently", () => {
    const dayA = new Date("2026-07-01");
    const dayB = new Date("2026-07-02");
    const rows: Row[] = [
      { date: dayA, propertyId: null, totalClicks: 100 }, // superseded by prop row below
      { date: dayA, propertyId: "prop-1", totalClicks: 10 },
      { date: dayB, propertyId: null, totalClicks: 50 }, // no property coverage, kept
    ];
    expect(dedupeSupersededByDate(rows)).toEqual([
      { date: dayA, propertyId: "prop-1", totalClicks: 10 },
      { date: dayB, propertyId: null, totalClicks: 50 },
    ]);
  });
});
