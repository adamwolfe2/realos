// The report window's periodEnd is exclusive UTC midnight. The label must name
// the last included day in UTC regardless of server/browser timezone.
import { describe, expect, it } from "vitest";
import { periodLabel } from "@/components/portal/reports/snapshot-shared";
import type { ReportSnapshot } from "@/lib/reports/generate";

const snap = (kind: string, periodStart: string, periodEnd: string) =>
  ({ kind, periodStart, periodEnd }) as unknown as ReportSnapshot;

describe("periodLabel", () => {
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
