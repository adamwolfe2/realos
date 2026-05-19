"use client";

// ---------------------------------------------------------------------------
// LeadSourceDonutChart — the recharts-bearing inner chart only.
//
// Split out from lead-source-donut.tsx so the dashboard parent component
// can dynamic-import this with ssr:false and keep recharts (~80kb gzipped
// after tree-shake) out of the initial dashboard bundle. The wrapper
// component still ships the legend (which is just <ul>/<li>) inline so
// the visual surface above the fold is identical on first paint; only
// the SVG chart fills in once the chunk lands.
// ---------------------------------------------------------------------------

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type LeadSourceDonutChartDatum = {
  name: string;
  value: number;
  color: string;
};

export default function LeadSourceDonutChart({
  data,
}: {
  data: LeadSourceDonutChartDatum[];
}) {
  return (
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
  );
}
