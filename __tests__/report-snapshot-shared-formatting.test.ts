import { describe, it, expect } from "vitest";
import { compactUsd, bucketWeekly } from "@/components/portal/reports/snapshot-shared";

// ---------------------------------------------------------------------------
// compactUsd + bucketWeekly — pulled out of the SG Real Estate report review
// (2026-08-01): "$5968.8K" is not a real money format, and a 134-bar daily
// traffic chart is unreadable. See components/portal/reports/property-one-pager.tsx.
// ---------------------------------------------------------------------------

describe("compactUsd", () => {
  it("renders sub-$10K amounts as plain dollars", () => {
    expect(compactUsd(8400)).toBe("$8,400");
    expect(compactUsd(0)).toBe("$0");
  });

  it("renders $10K-$1M as one-decimal K", () => {
    expect(compactUsd(159_300)).toBe("$159.3K");
    expect(compactUsd(10_000)).toBe("$10.0K");
  });

  it("renders $1M+ as two-decimal M — the bug this fixes ($5968.8K -> $5.97M)", () => {
    expect(compactUsd(5_968_800)).toBe("$5.97M");
    expect(compactUsd(1_000_000)).toBe("$1.00M");
  });

  it("returns an em dash for null/undefined", () => {
    expect(compactUsd(null)).toBe("—");
    expect(compactUsd(undefined)).toBe("—");
  });
});

describe("bucketWeekly", () => {
  it("sums a 14-day trend into 2 weekly buckets, newest week aligned to the end", () => {
    const days = [
      ...Array(7).fill(1), // oldest week: 7
      ...Array(7).fill(2), // newest week: 14
    ];
    expect(bucketWeekly(days)).toEqual([7, 14]);
  });

  it("leaves a leftover partial week at the start, not the end", () => {
    const days = [9, ...Array(7).fill(1), ...Array(7).fill(1)]; // 15 days
    const weeks = bucketWeekly(days);
    expect(weeks).toHaveLength(3);
    expect(weeks[0]).toBe(9); // partial (1 day) leads
    expect(weeks[1]).toBe(7);
    expect(weeks[2]).toBe(7);
  });

  it("returns an empty array for an empty trend", () => {
    expect(bucketWeekly([])).toEqual([]);
  });
});
