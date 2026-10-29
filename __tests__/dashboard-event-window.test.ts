import { describe, expect, it } from "vitest";
import { applicationEventWhere, leadEventWhere, tourEventWhere } from "@/lib/dashboard/event-window";

const start = new Date("2026-10-01T00:00:00Z");
const end = new Date("2026-10-29T00:00:00Z");
const r = { gte: start, lt: end };

describe("funnel event windows", () => {
  it("dates every stage by its real event within the same bounds", () => {
    expect(leadEventWhere(start, end)).toEqual({ firstSeenAt: r });
    expect(tourEventWhere(start, end).OR).toEqual([
      { completedAt: r },
      { completedAt: null, scheduledAt: r },
      { completedAt: null, scheduledAt: null, createdAt: r },
    ]);
    expect(applicationEventWhere(start, end).OR[0]).toEqual({ appliedAt: r });
  });

  it("caps at now so tours booked for next week are not in a past window", () => {
    const before = Date.now();
    const lt = tourEventWhere(start).OR[1].scheduledAt!.lt.getTime();
    expect(lt).toBeGreaterThanOrEqual(before);
    expect(lt).toBeLessThanOrEqual(Date.now());
  });
});
