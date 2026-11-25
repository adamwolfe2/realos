import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { availabilitySeries, bucket, listedDays, NEXT_TERM, sum, WINDOW } from "@/lib/portal/portfolio-overview";

const DAY = 86_400_000;
const end = Date.UTC(2026, 10, 24);

describe("portfolio overview", () => {
  it("buckets the 28 days ending on `end` and the 28 before, dropping the rest", () => {
    const s = bucket(
      [
        { at: new Date(end + 5 * 3_600_000) }, // today, mid-day
        { at: new Date(end - (WINDOW - 1) * DAY), n: 3 }, // first day of the window
        { at: new Date(end - WINDOW * DAY), n: 2 }, // last day of the prior window
        { at: new Date(end - 2 * WINDOW * DAY) }, // too old
        { at: new Date(end + DAY) }, // future
      ],
      end,
    );
    expect(s.cur[WINDOW - 1]).toBe(1);
    expect(s.cur[0]).toBe(3);
    expect(s.prev[WINDOW - 1]).toBe(2);
    expect(sum(s.cur)).toBe(4);
    expect(sum(s.prev)).toBe(2);
  });

  it("days listed: untracked listings count as at least the tracking floor", () => {
    const d = (days: number) => new Date(end - days * DAY);
    expect(listedDays([], end, 5)).toEqual({ median: null, atLeast: false, tracked: 0, total: 0 });
    expect(listedDays([null, null], end, 5)).toEqual({ median: 5, atLeast: true, tracked: 0, total: 2 });
    // Median of 3 lands on a tracked listing.
    expect(listedDays([d(2), d(4), null], end, 5)).toEqual({ median: 4, atLeast: false, tracked: 2, total: 3 });
    // Median of 3 lands on an untracked one: a lower bound.
    expect(listedDays([d(2), null, null], end, 5)).toEqual({ median: 5, atLeast: true, tracked: 1, total: 3 });
  });

  it("availability trend counts only properties recorded every day", () => {
    const d1 = new Date(end - DAY);
    const d2 = new Date(end);
    const s = availabilitySeries([
      { propertyId: "a", date: d1, rooms: 2, units: 3 },
      { propertyId: "a", date: d2, rooms: 1, units: 3 },
      { propertyId: "b", date: d2, rooms: 9, units: 0 }, // activated on d2: would fake a jump
    ]);
    expect(s.availability).toEqual([{ date: d1, homes: 5 }, { date: d2, homes: 4 }]);
    expect(s.availabilitySites).toBe(1);
  });

  it("treats pre-lease and next-term floor plans as not-yet-vacant listings", () => {
    for (const name of ["Stranda Apartments - 2Bedroom 2027 - 2028", "Double 2027–2028 – [Premium]", "Prelease 2B/2B 2027-2028", "Pre lease 1Bed", "Spring Double 2027", "PRELEASE 27/28 - Single Room", "Single Occupancy Pre-lease"]) {
      expect(NEXT_TERM.test(name), name).toBe(true);
    }
    for (const name of ["206-5", "2015", "Unit 2027", "603 Room 1 Bed A", "408 - Furnished", "Telegraph Commons - Double"]) {
      expect(NEXT_TERM.test(name), name).toBe(false);
    }
  });
});
