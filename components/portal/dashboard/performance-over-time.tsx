"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BRAND_BLUE,
  SPARKLINE_AREA,
} from "@/lib/charts/palette";

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
// Data shape: an array of points pre-aligned by relative day-of-window
// so day 0 is the first day of the current window and day N is "today".
// Both series share an x-axis label (the date of the current period's
// point). The comparison value at the same index is from the previous
// period's same offset — that's how the operator reads "we're 22%
// ahead of where we were last cycle."
// ---------------------------------------------------------------------------

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
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ls-perf-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND_BLUE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={BRAND_BLUE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#F1F5F9"
            strokeDasharray="2 3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            interval={interval}
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "#CBD5E1", strokeDasharray: "3 3" }}
            contentStyle={{
              fontSize: 12,
              background: "white",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              boxShadow: "0 4px 24px rgba(15,23,42,0.06)",
              padding: "8px 10px",
            }}
            labelStyle={{
              color: "#0F172A",
              fontWeight: 600,
              fontSize: 11,
              marginBottom: 4,
            }}
            itemStyle={{ padding: 0, color: "#0F172A" }}
            formatter={(value, name) => {
              const n = String(name);
              const label = n === "current" ? "Current" : "Prior";
              if (value == null) return ["—", label] as [string, string];
              const num = typeof value === "number" ? value : Number(value);
              if (!Number.isFinite(num)) return ["—", label] as [string, string];
              return [num.toLocaleString(), label] as [string, string];
            }}
          />
          {/* Prior-period overlay, rendered BEHIND the current series so
              the current line reads as the primary signal. Only rendered
              when compare is on — keeps the default view clean. */}
          {compare ? (
            <Area
              type="monotone"
              dataKey="comparison"
              stroke="#CBD5E1"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="current"
            stroke={BRAND_BLUE}
            strokeWidth={2}
            fill="url(#ls-perf-grad)"
            // A subtle accent dot follows the cursor on hover so the
            // selected point is unambiguous when the tooltip is near
            // the edge of the canvas.
            activeDot={{
              r: 4,
              stroke: BRAND_BLUE,
              strokeWidth: 2,
              fill: "white",
            }}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
  // Reference the area-fill token so the import isn't tree-shaken before
  // a future variant uses it directly. Cheap and prevents lint churn.
  void SPARKLINE_AREA;
}
