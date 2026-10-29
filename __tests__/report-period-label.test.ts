// The report window's periodEnd is exclusive UTC midnight. The label must name
// the last included day in UTC regardless of server/browser timezone.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { periodLabel } from "@/components/portal/reports/snapshot-shared";
import type { ReportSnapshot } from "@/lib/reports/generate";

const snap = (kind: string, periodStart: string, periodEnd: string) =>
  ({ kind, periodStart, periodEnd }) as unknown as ReportSnapshot;

// Run every case under UTC, Pacific (behind UTC: local formatting would
// print the previous day) and Tokyo (ahead), so a regression to local-time
// formatting fails even on a UTC CI runner.
const ZONES = [
  { tz: "UTC", offsetMin: 0 },
  { tz: "America/Los_Angeles", offsetMin: 420 }, // PDT on Oct 20
  { tz: "Asia/Tokyo", offsetMin: -540 },
];

describe.each(ZONES)("periodLabel in $tz", ({ tz, offsetMin }) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    // Assigning undefined would store the string "undefined".
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("the runtime timezone actually switched", () => {
    expect(new Date("2026-10-20T00:00:00.000Z").getTimezoneOffset()).toBe(offsetMin);
  });
  it("custom: Jul 19 start, exclusive Oct 20 end -> Jul 19 – Oct 19", () => {
    expect(periodLabel(snap("custom", "2026-07-19T00:00:00.000Z", "2026-10-20T00:00:00.000Z"))).toBe("Jul 19 – Oct 19, 2026");
  });
  it("weekly names the last included day", () => {
    expect(periodLabel(snap("weekly", "2026-10-13T00:00:00.000Z", "2026-10-20T00:00:00.000Z"))).toBe("Trailing 7 days through Oct 19, 2026");
  });
  it("adds the start year across a year boundary", () => {
    expect(periodLabel(snap("custom", "2025-12-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"))).toBe("Dec 1, 2025 – Jan 31, 2026");
  });
});
