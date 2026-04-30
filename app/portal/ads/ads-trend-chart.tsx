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
        <AreaChart data={series}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="convFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(new Date(v), "MMM d")}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v: number) => `$${Math.round(v / 100)}`}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
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
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="spendCents"
            name="Spend"
            stroke="#0f172a"
            fill="url(#spendFill)"
            strokeWidth={2}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="conversions"
            name="Conversions"
            stroke="#10b981"
            fill="url(#convFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
