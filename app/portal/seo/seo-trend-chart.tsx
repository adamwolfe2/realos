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
          <CartesianGrid stroke="#e5e2da" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d: string) =>
              d ? d.slice(5).replace("-", "/") : ""
            }
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: "1px solid #e5e2da",
              fontSize: 12,
              background: "#fff",
            }}
            labelStyle={{ color: "#111", fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
            verticalAlign="top"
            height={28}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="#a16207"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
