"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { BRAND, BORDER, MUTED, SectionHeader } from "./shared";

// ---------------------------------------------------------------------------
// Opportunity matrix — top-right quadrant means high volume, ranking
// 1–20, big conversion bubble. Extracted from seo-phase2-charts.tsx so
// ScatterChart lives in its own bundle chunk.
// ---------------------------------------------------------------------------

export type OpportunityPoint = {
  query: string;
  position: number;
  searchVolume: number;
  conversionPotential: number;
};

export function OpportunityMatrix({
  points,
}: {
  points: OpportunityPoint[];
}) {
  if (points.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader eyebrow="Strategy" title="Opportunity matrix" />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Appears once we have keyword volume + ranking data.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Strategy"
        title="Opportunity matrix"
        hint="Top-right quadrant = high volume, ranking #1–20. Bubble size = conversion potential."
      />
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
            <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="position"
              name="Position"
              domain={[1, 100]}
              reversed
              tick={{ fontSize: 10, fill: MUTED }}
              tickLine={false}
              axisLine={{ stroke: BORDER }}
              label={{
                value: "Position (lower is better →)",
                position: "insideBottom",
                offset: -4,
                style: { fontSize: 10, fill: MUTED },
              }}
            />
            <YAxis
              type="number"
              dataKey="searchVolume"
              name="Monthly searches"
              tick={{ fontSize: 10, fill: MUTED }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
              }
              label={{
                value: "Volume",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: MUTED },
              }}
            />
            <ZAxis
              type="number"
              dataKey="conversionPotential"
              range={[50, 600]}
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Scatter
              name="Queries"
              data={points}
              fill={BRAND}
              fillOpacity={0.65}
              stroke={BRAND}
              strokeOpacity={0.9}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default OpportunityMatrix;
