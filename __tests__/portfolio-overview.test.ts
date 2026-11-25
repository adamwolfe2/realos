import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { bucket, NEXT_TERM, sum, WINDOW } from "@/lib/portal/portfolio-overview";

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

  it("treats pre-lease and next-term floor plans as not-yet-vacant listings", () => {
    for (const name of ["Prelease 2B/2B 2027-2028", "Pre lease 1Bed", "Spring Double 2027", "PRELEASE 27/28 - Single Room", "Single Occupancy Pre-lease"]) {
      expect(NEXT_TERM.test(name), name).toBe(true);
    }
    for (const name of ["206-5", "603 Room 1 Bed A", "408 - Furnished", "Telegraph Commons - Double"]) {
      expect(NEXT_TERM.test(name), name).toBe(false);
    }
  });
});
