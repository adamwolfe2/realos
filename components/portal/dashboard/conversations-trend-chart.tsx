"use client";

// Recharts-bearing inner chart only — lazy-loaded by conversations-trend.tsx
// (same split as performance-over-time-chart.tsx, so the dashboard's initial
// bundle never ships recharts).

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
  CHART_COLORS,
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from "@/components/portal/ui/chart-theme";

export type ConversationTrendPoint = { label: string; count: number };

export default function ConversationsTrendChart({
  points,
}: {
  points: ConversationTrendPoint[];
}) {
  // Sparse x labels: ~6 ticks regardless of window length.
  const interval = Math.max(1, Math.ceil(points.length / 6));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="ls-convo-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: CHART_COLORS.axis }}
          tickLine={false}
          axisLine={false}
          interval={interval}
          padding={{ left: 4, right: 4 }}
        />
        <YAxis
          tick={CHART_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: CHART_COLORS.silver, strokeDasharray: "3 3" }}
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={CHART_TOOLTIP_LABEL_STYLE}
          itemStyle={CHART_TOOLTIP_ITEM_STYLE}
          formatter={(value) => {
            const num = typeof value === "number" ? value : Number(value);
            return [
              Number.isFinite(num) ? num.toLocaleString() : "—",
              "Conversations",
            ] as [string, string];
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={CHART_COLORS.brand}
          strokeWidth={2}
          fill="url(#ls-convo-grad)"
          dot={false}
          activeDot={{
            r: 4,
            stroke: CHART_COLORS.brand,
            strokeWidth: 2,
            fill: "white",
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
