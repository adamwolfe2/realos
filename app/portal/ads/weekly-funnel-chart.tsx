"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_GRID_PROPS,
  CHART_LEGEND_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_STYLE,
} from "@/components/portal/ui/chart-theme";
import type { WeekRow } from "@/lib/integrations/ads-insights-math";

// Leads, tours and leases per week as bars, spend as a line on its own axis.
const label = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function WeeklyFunnelChart({ weeks }: { weeks: WeekRow[] }) {
  const data = weeks.map((w) => ({ week: label(w.week), Leads: w.leads, Tours: w.tours, Leases: w.signed, Spend: Math.round(w.spendCents / 100) }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis dataKey="week" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis yAxisId="n" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <YAxis yAxisId="usd" orientation="right" tick={CHART_AXIS_TICK} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_TOOLTIP_LABEL_STYLE}
            itemStyle={CHART_TOOLTIP_ITEM_STYLE}
            formatter={(v, name) => (name === "Spend" ? `$${Number(v).toLocaleString()}` : Number(v).toLocaleString())}
          />
          <Legend wrapperStyle={CHART_LEGEND_STYLE} iconType="circle" iconSize={8} />
          <Bar yAxisId="n" dataKey="Leads" fill="#93b4ff" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="n" dataKey="Tours" fill="#1f5eff" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Bar yAxisId="n" dataKey="Leases" fill="#15803d" radius={[3, 3, 0, 0]} maxBarSize={22} />
          <Line yAxisId="usd" type="linear" dataKey="Spend" stroke="#0b1530" strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
