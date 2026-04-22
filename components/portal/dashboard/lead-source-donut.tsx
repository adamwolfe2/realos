"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type LeadSourceSlice = {
  source: string;
  count: number;
  color?: string;
};

const PALETTE = [
  "#2563EB", // primary blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // rose
  "#06b6d4", // cyan
];

export function LeadSourceDonut({ slices }: { slices: LeadSourceSlice[] }) {
  const total = slices.reduce((acc, s) => acc + s.count, 0);
  const data = slices.map((s, i) => ({
    name: s.source,
    value: s.count,
    color: s.color ?? PALETTE[i % PALETTE.length],
  }));

  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        No lead source data yet. Once your channels report in, this fills out.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] items-center gap-5">
      <div className="relative h-[160px] w-[160px] mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              cursor={false}
              contentStyle={{
                fontSize: 12,
                background: "white",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                boxShadow: "0 4px 24px rgba(0,0,0,0.05)",
              }}
              formatter={(v: number, n: string) => [v, n]}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={75}
              stroke="white"
              strokeWidth={2}
              paddingAngle={1.5}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
            Total
          </span>
          <span className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {total}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {data.map((d) => {
          const pct = total ? Math.round((d.value / total) * 100) : 0;
          return (
            <li
              key={d.name}
              className="grid grid-cols-[12px_1fr_auto_42px] items-center gap-2.5 text-xs"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-foreground truncate">{d.name}</span>
              <span className="tabular-nums text-muted-foreground">{d.value}</span>
              <span className="text-right tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
