"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { SPARKLINE_AREA } from "@/lib/charts/palette";

// ---------------------------------------------------------------------------
// PerformanceOverTime — the headline chart on /portal home.
//
// Mirrors the AeroStore "Sales Performance Over Time" reference: a soft
// area chart showing the current period's leads-per-day, with an
// optional comparison overlay (faded blue line) for the prior period
// of the same length. The interactive Recharts tooltip surfaces exact
// numbers on hover so the chart stops being decorative and becomes a
// real explore-the-data surface.
//
// The recharts-bearing inner chart is dynamic()-imported with ssr:false
// so the dashboard initial bundle doesn't ship recharts. The empty
// state + chart shell render synchronously; only the SVG plot waits
// for the chunk.
// ---------------------------------------------------------------------------

const PerformanceOverTimeChart = dynamic(
  () => import("./performance-over-time-chart"),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-md bg-muted/30" aria-hidden="true" />
    ),
  },
);

export type PerformancePoint = {
  /** ISO date for the current period's point — used for the tooltip header. */
  date: string;
  /** Display label on the x-axis (already formatted). */
  label: string;
  /** Leads created on this day in the current window. */
  current: number;
  /** Leads created on the equivalent day of the prior window. */
  comparison: number | null;
};

export function PerformanceOverTime({
  points,
  compare,
}: {
  points: PerformancePoint[];
  compare: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground">
        Performance chart fills out as leads come in.
      </div>
    );
  }

  // Pick a sparse x-axis tick set so the labels don't crowd at small
  // widths. Recharts otherwise tries to render every tick and we end up
  // with overlapping dates on a 28-day window. Aim for ~7 visible ticks
  // regardless of window length.
  const interval = Math.max(0, Math.floor(points.length / 7) - 1);

  return (
    <div className="h-[260px]">
      <PerformanceOverTimeChart
        points={points}
        compare={compare}
        interval={interval}
      />
    </div>
  );
  // Reference the area-fill token so the import isn't tree-shaken before
  // a future variant uses it directly. Cheap and prevents lint churn.
  void SPARKLINE_AREA;
}
