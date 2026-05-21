"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  CHART_COLORS,
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
} from "@/components/portal/ui/chart-theme";

// ---------------------------------------------------------------------------
// SeoTimeseriesChart — the unified Clicks + Impressions line chart that
// anchors the SEO overview. Two series, dual y-axes (clicks left,
// impressions right) so impressions — which dwarf clicks by 1-2 orders
// of magnitude — don't flatten the clicks line into the x-axis.
//
// Legend chips render above the chart and are clickable to toggle each
// series on/off. State is local — parent doesn't need to know which
// series is visible.
// ---------------------------------------------------------------------------

export type TimeseriesPoint = {
  date: string;        // ISO YYYY-MM-DD
  clicks: number;
  impressions: number;
};

type SeriesKey = "clicks" | "impressions";

type SeriesMeta = {
  key: SeriesKey;
  label: string;
  color: string;
  axis: "left" | "right";
};

const SERIES: SeriesMeta[] = [
  { key: "clicks",       label: "Clicks",      color: CHART_COLORS.brand,     axis: "left"  },
  { key: "impressions",  label: "Impressions", color: CHART_COLORS.brandFog,  axis: "right" },
];

export function SeoTimeseriesChart({
  data,
}: {
  data: TimeseriesPoint[];
}) {
  const [visible, setVisible] = React.useState<Record<SeriesKey, boolean>>({
    clicks: true,
    impressions: true,
  });

  const toggle = (key: SeriesKey) =>
    setVisible((prev) => {
      // Refuse to hide the last visible series — empty chart looks broken.
      const next = { ...prev, [key]: !prev[key] };
      if (!next.clicks && !next.impressions) return prev;
      return next;
    });

  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-16 text-center">
        No trend data yet. Once your first sync completes, daily clicks and
        impressions will plot here.
      </div>
    );
  }

  // Show ~10 x-axis ticks regardless of range length so a 30d view and a
  // 365d view both read cleanly.
  const tickInterval = Math.max(0, Math.floor(data.length / 10));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {SERIES.map((s) => {
          const on = visible[s.key];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                on
                  ? "border-border bg-card text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground line-through"
              }`}
              aria-pressed={on}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: on ? s.color : CHART_COLORS.silver,
                }}
              />
              {s.label}
            </button>
          );
        })}
      </div>
      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis
              dataKey="date"
              tick={CHART_AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART_COLORS.grid }}
              interval={tickInterval}
              tickFormatter={(d: string) =>
                d ? d.slice(5).replace("-", "/") : ""
              }
            />
            <YAxis
              yAxisId="left"
              tick={CHART_AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={36}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={CHART_AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              labelStyle={CHART_TOOLTIP_LABEL_STYLE}
              itemStyle={CHART_TOOLTIP_ITEM_STYLE}
              cursor={{
                stroke: CHART_COLORS.brand,
                strokeOpacity: 0.18,
                strokeWidth: 1,
              }}
              formatter={(v: number, name: string) => [v.toLocaleString(), name]}
            />
            {visible.clicks ? (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="clicks"
                name="Clicks"
                stroke={CHART_COLORS.brand}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: CHART_COLORS.brand,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            ) : null}
            {visible.impressions ? (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="impressions"
                name="Impressions"
                stroke={CHART_COLORS.brandFog}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: CHART_COLORS.brandFog,
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function fmtCompact(v: number): string {
  if (!Number.isFinite(v)) return "0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return `${v}`;
}
