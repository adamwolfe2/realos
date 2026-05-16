"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  CHART_COLORS,
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_LEGEND_STYLE,
} from "@/components/portal/ui/chart-theme";

// SeoTrendChart renders a dual-axis line chart of clicks (left) and
// impressions (right) over the supplied date series. The series is the daily
// SeoSnapshot rows for the last 28 days. Values use parchment-friendly tones
// to match the site palette.

export type TrendPoint = {
  date: string; // ISO YYYY-MM-DD
  clicks: number;
  impressions: number;
};

export function SeoTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        No trend data yet. Once your first sync completes, the last 28 days of
        clicks and impressions will plot here.
      </div>
    );
  }

  return (
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
            tickFormatter={(d: string) =>
              d ? d.slice(5).replace("-", "/") : ""
            }
          />
          <YAxis
            yAxisId="left"
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={CHART_AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ stroke: CHART_COLORS.brand, strokeOpacity: 0.18, strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={CHART_LEGEND_STYLE}
            iconType="circle"
            iconSize={8}
            verticalAlign="top"
            height={28}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke={CHART_COLORS.brand}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.brand, stroke: "#fff", strokeWidth: 2 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke={CHART_COLORS.warning}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.warning, stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
