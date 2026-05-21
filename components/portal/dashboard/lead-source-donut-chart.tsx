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
} from "recharts";

export type LeadSourceDonutChartDatum = {
  name: string;
  value: number;
  color: string;
};

// Reporter bug #62 (Norman): the recharts <Tooltip> renders right under
// the cursor as the user hovers/clicks the donut, which overlaps the
// "Total" center label inside the doughnut hole. The legend to the
// right of the chart already shows source · value · %, so the tooltip
// duplicates that info. Removing the Tooltip eliminates the overlap and
// keeps the surface clean — the legend remains the source of truth.
export default function LeadSourceDonutChart({
  data,
}: {
  data: LeadSourceDonutChartDatum[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={75}
          stroke="white"
          strokeWidth={2}
          paddingAngle={1.5}
          // Disable the click-to-select activation in addition to removing
          // the tooltip — without this, clicking a slice keeps it
          // "active" and dims siblings, which reads as a bug because the
          // user can't deselect by clicking elsewhere.
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
