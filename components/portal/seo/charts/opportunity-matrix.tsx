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
import { BRAND, BRAND_LIGHT, BORDER, MUTED, SectionHeader, EmptyStateBody } from "./shared";

// Faded preview scatter showing the four quadrants of the opportunity
// matrix — the top-right corner (high-volume, low-position) is where
// real bubbles will appear once we have data.
function OpportunityMatrixPreview() {
  return (
    <svg viewBox="0 0 160 96" className="w-full h-auto" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="om-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={BRAND} stopOpacity={0.06} />
          <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x="10" y="6" width="144" height="78" fill="url(#om-bg)" rx="4" />
      {/* axis quadrant guides */}
      <line x1="82" y1="6" x2="82" y2="84" stroke={BORDER} strokeDasharray="2 3" />
      <line x1="10" y1="45" x2="154" y2="45" stroke={BORDER} strokeDasharray="2 3" />
      {/* bubbles — biggest in top-right "win zone" */}
      <circle cx="120" cy="22" r="11" fill={BRAND} fillOpacity="0.55" />
      <circle cx="138" cy="32" r="6" fill={BRAND} fillOpacity="0.45" />
      <circle cx="104" cy="36" r="8" fill={BRAND_LIGHT} fillOpacity="0.6" />
      <circle cx="55" cy="60" r="5" fill={MUTED} fillOpacity="0.45" />
      <circle cx="38" cy="72" r="4" fill={MUTED} fillOpacity="0.35" />
      <circle cx="70" cy="50" r="6" fill={MUTED} fillOpacity="0.35" />
      <text x="118" y="14" fontSize="6" fontFamily="var(--font-mono)" fill={BRAND}>
        WIN ZONE
      </text>
    </svg>
  );
}

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
        <SectionHeader
          eyebrow="Strategy"
          title="Opportunity matrix"
          hint="Bubble plot of position × monthly search volume, sized by conversion potential."
        />
        <EmptyStateBody
          preview={<OpportunityMatrixPreview />}
          body="Every tracked query is plotted as a bubble — X is current rank, Y is monthly search volume, size is conversion potential (intent × expected-CTR lift). The top-right quadrant is the win zone: high-volume queries already ranking #1–20."
          example={`A query ranking #12 with 2,400 monthly searches and high commercial intent will land as a fat bubble at the top edge — pushing it to #5 is roughly +180 clicks/month.`}
        />
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
