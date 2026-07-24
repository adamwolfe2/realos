"use client";

// ---------------------------------------------------------------------------
// PerformanceOverTimeChart — recharts-bearing inner chart only.
//
// Split from performance-over-time.tsx so the dashboard can lazy-load
// recharts via dynamic(). The wrapper handles the empty state inline
// (no recharts needed) and only requests this chunk when there's real
// data to plot.
// ---------------------------------------------------------------------------

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
import { BRAND_BLUE } from "@/lib/charts/palette";
import { CHART_AXIS_TICK } from "@/components/portal/ui/chart-theme";

export type PerformancePoint = {
  date: string;
  label: string;
  current: number;
  comparison: number | null;
};

export default function PerformanceOverTimeChart({
  points,
  compare,
  interval,
}: {
  points: PerformancePoint[];
  compare: boolean;
  interval: number;
}) {
  return (
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
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
          tickMargin={8}
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
  );
}
