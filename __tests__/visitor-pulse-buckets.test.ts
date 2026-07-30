import { describe, it, expect } from "vitest";
import { bucketDailyCounts } from "@/lib/visitors/pulse";

// Pins the review finding: the headline total must equal the bar sum, so
// rows outside the window (idx < 0) are dropped from BOTH — callers sum the
// returned buckets rather than counting raw rows.

const DAY = 86_400_000;

describe("bucketDailyCounts", () => {
  it("today lands in the last bucket, yesterday in the one before", () => {
    const buckets = bucketDailyCounts([new Date(), new Date(Date.now() - DAY)], 30);
    expect(buckets).toHaveLength(30);
    expect(buckets[29]).toBe(1);
    expect(buckets[28]).toBe(1);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("rows older than the window are dropped, not misfiled", () => {
    const old = new Date(Date.now() - 45 * DAY);
    const buckets = bucketDailyCounts([old, new Date()], 30);
    expect(buckets.reduce((a, b) => a + b, 0)).toBe(1);
    expect(buckets[29]).toBe(1);
  });

  it("a row ~30 wall-clock days old (oldest partial UTC day) never inflates the sum", () => {
    // The query fetches rows >= now - 30d wall-clock; the oldest ones can
    // fall on UTC day index -1. They must vanish from the buckets so the
    // summed headline matches the bars.
    const boundary = new Date(Date.now() - 30 * DAY);
    const buckets = bucketDailyCounts([boundary], 30);
    const sum = buckets.reduce((a, b) => a + b, 0);
    expect(sum === 0 || buckets[0] === 1).toBe(true);
    expect(sum).toBeLessThanOrEqual(1);
  });

  it("empty input → 30 zero buckets", () => {
    const buckets = bucketDailyCounts([], 30);
    expect(buckets).toHaveLength(30);
    expect(buckets.every((b) => b === 0)).toBe(true);
  });
});
