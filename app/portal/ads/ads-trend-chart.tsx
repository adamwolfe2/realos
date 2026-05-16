"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { format } from "date-fns";
import {
  CHART_COLORS,
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_LEGEND_STYLE,
} from "@/components/portal/ui/chart-theme";

// Extracted from ads-dashboard.tsx so the recharts bundle (~80KB gzipped)
// can be lazily code-split. The dashboard page renders this only when there
// is real data, behind a Suspense boundary via next/dynamic.

export type AdsTrendPoint = {
  date: string;
  spendCents: number;
  conversions: number;
};

export function AdsTrendChart({
  series,
  formatCents,
}: {
  series: AdsTrendPoint[];
  formatCents: (cents: number) => string;
}) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.brand} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS.brand} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(new Date(v), "MMM d")}
            tick={CHART_AXIS_TICK}
            axisLine={{ stroke: CHART_COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={CHART_AXIS_TICK}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            cursor={{ stroke: CHART_COLORS.brand, strokeOpacity: 0.18, strokeWidth: 1 }}
            formatter={(value: number, name: string) => {
              if (name === "Spend") return [formatCents(value), name];
              return [
                value.toLocaleString(undefined, { maximumFractionDigits: 1 }),
                name,
              ];
            }}
            labelFormatter={(v: string) =>
              format(new Date(v), "EEE, MMM d, yyyy")
            }
          />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} iconType="circle" iconSize={8} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="spendCents"
            name="Spend"
            stroke={CHART_COLORS.brand}
            fill="url(#spendFill)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.brand, stroke: "#fff", strokeWidth: 2 }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="conversions"
            name="Conversions"
            stroke={CHART_COLORS.success}
            fill="url(#convFill)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CHART_COLORS.success, stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
