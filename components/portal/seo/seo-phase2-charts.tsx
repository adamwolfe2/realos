"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// SEO Phase 2 chart pack — operator-facing visualizations sourced from
// the QueryLandingDaily + RankedKeyword + KeywordIntersection tables.
//
// Color system: brand-blue ramp for "you," neutral grays for context,
// semantic green / red ONLY for week-over-week deltas. Matches the
// brand cohesion rule in CLAUDE.md.
// ---------------------------------------------------------------------------

const BRAND = "#2563EB";
const BRAND_LIGHT = "#93C5FD";
const BRAND_LIGHTER = "#DBEAFE";
const INK = "#1E2A3A";
const MUTED = "#94A3B8";
const SUCCESS = "#059669";
const DANGER = "#DC2626";
const BORDER = "#E2E8F0";

// ============================================================================
// EXECUTIVE SUMMARY ROW
// ============================================================================

export type ExecSummaryStat = {
  label: string;
  value: string;
  /** Numeric delta (positive = improvement); null when no prior period. */
  delta: number | null;
  /** Render delta as percent (true) or absolute (false). */
  deltaPct?: boolean;
  /** For metrics where "lower is better" (cost, position) — flips color. */
  inverted?: boolean;
  hint?: string;
};

export function ExecSummaryRow({ stats }: { stats: ExecSummaryStat[] }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] via-card to-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          Executive summary
        </p>
        <p className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
          vs prior period
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-border/60">
        {stats.map((s) => {
          const showDelta = s.delta != null;
          const positive = showDelta && (s.inverted ? s.delta! < 0 : s.delta! > 0);
          const negative = showDelta && (s.inverted ? s.delta! > 0 : s.delta! < 0);
          const flat = showDelta && s.delta === 0;
          const color = positive
            ? SUCCESS
            : negative
              ? DANGER
              : MUTED;
          const sign = showDelta && s.delta! > 0 ? "+" : "";
          return (
            <div key={s.label} className="px-4 py-3">
              <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
                {s.label}
              </p>
              <p className="mt-0.5 text-[20px] font-display font-medium tabular-nums leading-none text-foreground">
                {s.value}
              </p>
              {showDelta ? (
                <p
                  className="mt-1.5 text-[11px] font-medium tabular-nums leading-none"
                  style={{ color }}
                >
                  {flat ? "Flat" : `${sign}${s.deltaPct ? `${s.delta!.toFixed(1)}%` : s.delta!.toLocaleString()}`}
                </p>
              ) : s.hint ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-tight truncate">
                  {s.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ============================================================================
// RANGE SELECTOR (7d / 28d / 90d / 12mo)
// ============================================================================

export type RangeKey = "7d" | "28d" | "90d" | "12mo";

export function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
}) {
  const opts: Array<{ k: RangeKey; label: string }> = [
    { k: "7d", label: "7 days" },
    { k: "28d", label: "28 days" },
    { k: "90d", label: "90 days" },
    { k: "12mo", label: "12 months" },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
      {opts.map((o) => {
        const active = o.k === value;
        return (
          <button
            key={o.k}
            type="button"
            onClick={() => onChange(o.k)}
            className={`px-3 py-1 text-[11.5px] font-semibold rounded-md transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// POSITION-BUCKET AREA CHART (1, 2-3, 4-10, 11-20, 21-50, 51-100)
// ============================================================================

export type PositionBucketPoint = {
  date: string; // YYYY-MM-DD
  pos1: number;
  pos2to3: number;
  pos4to10: number;
  pos11to20: number;
  pos21to50: number;
  pos51to100: number;
};

export function PositionBucketChart({
  data,
}: {
  data: PositionBucketPoint[];
}) {
  if (data.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Keyword portfolio"
          title="Position bucket distribution"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Keyword position trends appear after the first weekly sync.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Keyword portfolio"
        title="Position bucket distribution"
        hint="Higher area = more keywords ranking in that band"
      />
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pb-1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.85} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: MUTED }}
              tickFormatter={(d: string) => (d ? d.slice(5) : "")}
              tickLine={false}
              axisLine={{ stroke: BORDER }}
            />
            <YAxis tick={{ fontSize: 10, fill: MUTED }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 11,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, paddingTop: 6 }}
              iconType="circle"
              iconSize={8}
            />
            <Area
              type="monotone"
              dataKey="pos1"
              stackId="1"
              stroke={BRAND}
              fill="url(#pb-1)"
              name="#1"
            />
            <Area
              type="monotone"
              dataKey="pos2to3"
              stackId="1"
              stroke={BRAND}
              fill={BRAND}
              fillOpacity={0.6}
              name="#2–3"
            />
            <Area
              type="monotone"
              dataKey="pos4to10"
              stackId="1"
              stroke={BRAND_LIGHT}
              fill={BRAND_LIGHT}
              fillOpacity={0.5}
              name="#4–10"
            />
            <Area
              type="monotone"
              dataKey="pos11to20"
              stackId="1"
              stroke={BRAND_LIGHTER}
              fill={BRAND_LIGHTER}
              fillOpacity={0.7}
              name="#11–20"
            />
            <Area
              type="monotone"
              dataKey="pos21to50"
              stackId="1"
              stroke={MUTED}
              fill={MUTED}
              fillOpacity={0.35}
              name="#21–50"
            />
            <Area
              type="monotone"
              dataKey="pos51to100"
              stackId="1"
              stroke={MUTED}
              fill={MUTED}
              fillOpacity={0.2}
              name="#51–100"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ============================================================================
// CTR vs POSITION SCATTER (with expected-CTR benchmark curve)
// ============================================================================

export type CtrScatterPoint = {
  query: string;
  position: number;
  ctr: number; // 0..1
  impressions: number;
};

export function CtrPositionScatter({ data }: { data: CtrScatterPoint[] }) {
  if (data.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="GSC × DataforSEO"
          title="CTR vs position"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Plot appears once Search Console + DataforSEO data overlap.
        </p>
      </section>
    );
  }
  // Expected-CTR benchmark line (Advanced Web Ranking 2024 organic CTR
  // curve). Used as a sanity check so the operator sees which queries
  // under-perform their position.
  const benchmark = [
    { position: 1, expectedCtr: 0.39 },
    { position: 2, expectedCtr: 0.18 },
    { position: 3, expectedCtr: 0.10 },
    { position: 4, expectedCtr: 0.075 },
    { position: 5, expectedCtr: 0.055 },
    { position: 6, expectedCtr: 0.04 },
    { position: 7, expectedCtr: 0.032 },
    { position: 8, expectedCtr: 0.026 },
    { position: 9, expectedCtr: 0.021 },
    { position: 10, expectedCtr: 0.018 },
    { position: 15, expectedCtr: 0.01 },
    { position: 20, expectedCtr: 0.006 },
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="GSC × DataforSEO"
        title="CTR vs position"
        hint="Dashed line is the expected-CTR benchmark. Dots below = title/meta opportunity."
      />
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={BORDER} strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="position"
              name="Position"
              domain={[1, 20]}
              reversed
              tick={{ fontSize: 10, fill: MUTED }}
              tickLine={false}
              axisLine={{ stroke: BORDER }}
              label={{
                value: "Position",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 10, fill: MUTED },
              }}
            />
            <YAxis
              type="number"
              dataKey="ctr"
              name="CTR"
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 10, fill: MUTED }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "CTR",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: MUTED },
              }}
            />
            <ZAxis
              type="number"
              dataKey="impressions"
              range={[60, 600]}
              name="Impressions"
            />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              contentStyle={{
                background: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value: number | string, name) => {
                if (name === "CTR")
                  return [`${(Number(value) * 100).toFixed(2)}%`, name];
                return [value, name];
              }}
            />
            <Scatter name="Queries" data={data} fill={BRAND} fillOpacity={0.7} />
            <Line
              data={benchmark}
              type="monotone"
              dataKey="expectedCtr"
              stroke={MUTED}
              strokeDasharray="4 4"
              dot={false}
              name="Expected CTR"
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

// ============================================================================
// STRIKING DISTANCE TABLE (positions 4–20, high impressions)
// ============================================================================

export type StrikingDistanceRow = {
  query: string;
  url: string | null;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

export function StrikingDistanceTable({
  rows,
}: {
  rows: StrikingDistanceRow[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-border bg-gradient-to-r from-primary/[0.04] via-card to-card">
        <div>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Striking distance
          </p>
          <h3 className="text-sm font-semibold text-foreground">
            Queries ranking #4–20 with real impressions
          </h3>
        </div>
        <span className="text-[10.5px] text-muted-foreground tabular-nums">
          {rows.length} opportunities
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Appears once Search Console data flows for 14 days.
        </p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground border-b border-border/60">
              <th className="px-5 py-2 font-semibold">Query</th>
              <th className="px-3 py-2 font-semibold text-right">Position</th>
              <th className="px-3 py-2 font-semibold text-right">Impressions</th>
              <th className="px-3 py-2 font-semibold text-right">Clicks</th>
              <th className="px-3 py-2 font-semibold text-right">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 12).map((r, i) => (
              <tr
                key={`${r.query}-${i}`}
                className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-5 py-2 min-w-0">
                  <p className="font-medium text-foreground truncate max-w-[260px]">
                    {r.query}
                  </p>
                  {r.url ? (
                    <p className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                      {r.url.replace(/^https?:\/\//, "")}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  #{r.position}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {r.impressions.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {r.clicks.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {(r.ctr * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ============================================================================
// SHARE OF VOICE DONUT
// ============================================================================

export type ShareOfVoiceSlice = {
  domain: string;
  shareOfVoice: number; // 0..1
  isUs?: boolean;
};

export function ShareOfVoiceDonut({
  slices,
}: {
  slices: ShareOfVoiceSlice[];
}) {
  if (slices.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Competitive"
          title="Share of voice"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Available after the first competitor scan completes.
        </p>
      </section>
    );
  }
  // Brand-blue ramp for everyone; muted-gray for "Other." Our slice
  // gets the full brand color; competitors get progressively lighter
  // shades so the operator's eye still finds their bar first.
  const palette = [BRAND, "#3B82F6", "#60A5FA", BRAND_LIGHT, "#BFDBFE", BRAND_LIGHTER];
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Competitive"
        title="Share of voice"
        hint="% of total impressions across your tracked queries"
      />
      <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-4 items-center">
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="shareOfVoice"
                nameKey="domain"
                innerRadius={48}
                outerRadius={78}
                paddingAngle={2}
                strokeWidth={0}
              >
                {slices.map((s, i) => (
                  <Cell
                    key={s.domain}
                    fill={s.isUs ? BRAND : palette[i % palette.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number | string) =>
                  typeof v === "number" ? `${(v * 100).toFixed(1)}%` : v
                }
                contentStyle={{
                  background: "#fff",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1.5">
          {slices.slice(0, 6).map((s, i) => (
            <li
              key={s.domain}
              className="flex items-center gap-2.5 text-[12px]"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: s.isUs ? BRAND : palette[i % palette.length],
                }}
              />
              <span
                className={`truncate flex-1 ${
                  s.isUs ? "font-semibold text-foreground" : "text-foreground"
                }`}
              >
                {s.domain}
                {s.isUs ? " (you)" : ""}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {(s.shareOfVoice * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ============================================================================
// OPPORTUNITY MATRIX (bubble: volume × position × conversion potential)
// ============================================================================

export type OpportunityPoint = {
  query: string;
  position: number; // 1..100
  searchVolume: number;
  conversionPotential: number; // 0..1 — derived from intent + CTR curve
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
        />
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

// ============================================================================
// CONTENT ROI TREEMAP (per-URL composite score)
// ============================================================================

export type ContentRoiNode = {
  url: string;
  clicks: number;
  rankCount: number;
  conversions: number;
  /** Composite 0–100, drives the cell fill saturation. */
  roiScore: number;
};

export function ContentRoiTreemap({ nodes }: { nodes: ContentRoiNode[] }) {
  if (nodes.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Content ROI"
          title="Per-URL performance"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Pages appear here once you have ranking + click data.
        </p>
      </section>
    );
  }
  const data = nodes.map((n) => ({
    name: n.url.replace(/^https?:\/\//, "").slice(0, 48),
    size: Math.max(1, n.clicks),
    roiScore: n.roiScore,
    clicks: n.clicks,
    rankCount: n.rankCount,
  }));
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Content ROI"
        title="Per-URL performance"
        hint="Cell size = clicks · saturation = composite ROI score (0–100)"
      />
      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            stroke="#fff"
            // Recharts' Treemap content slot expects a ReactElement; pass
            // the component directly and Recharts injects the cell props.
            content={<RoiTreemapCell />}
          />
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type TreemapCellProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  roiScore?: number;
};

function RoiTreemapCell(props: TreemapCellProps = {}) {
  const { x = 0, y = 0, width = 0, height = 0, name, roiScore = 0 } = props;
  if (!width || !height) return null;
  // Color: brand blue at full ROI, fading to brand-lighter at low ROI.
  const opacity = 0.25 + (roiScore / 100) * 0.7;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={BRAND}
        fillOpacity={opacity}
      />
      {width > 60 && height > 24 ? (
        <text
          x={x + 6}
          y={y + 14}
          fontSize={10}
          fill="#fff"
          fontFamily="var(--font-mono)"
        >
          {(name ?? "").slice(0, Math.max(8, width / 7))}
        </text>
      ) : null}
    </g>
  );
}

// ============================================================================
// KEYWORD PIPELINE FUNNEL (impressions -> clicks -> sessions -> conversions)
// ============================================================================

export type PipelineStage = {
  label: string;
  value: number;
};

export function KeywordPipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Pipeline"
        title="Search → revenue"
        hint="GSC impressions → clicks → GA4 sessions → conversions"
      />
      <ol className="space-y-2 mt-3">
        {stages.map((s, i) => {
          const pct = (s.value / max) * 100;
          const dropPct =
            i > 0 && stages[i - 1].value > 0
              ? ((stages[i - 1].value - s.value) / stages[i - 1].value) * 100
              : null;
          return (
            <li key={s.label} className="grid grid-cols-[120px_1fr_88px_72px] items-center gap-3">
              <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
                {s.label}
              </span>
              <div className="relative h-6 rounded-md bg-muted/40 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-md"
                  style={{
                    width: `${Math.max(2, pct)}%`,
                    background: `linear-gradient(90deg, ${BRAND}, ${BRAND_LIGHT})`,
                  }}
                />
              </div>
              <span className="text-[13px] font-display font-medium tabular-nums text-foreground text-right">
                {s.value.toLocaleString()}
              </span>
              <span className="text-[10.5px] tabular-nums text-muted-foreground text-right">
                {dropPct != null ? `−${dropPct.toFixed(0)}%` : "—"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ============================================================================
// BRANDED vs NON-BRANDED SPLIT
// ============================================================================

export function BrandedVsNonBrandedCard({
  branded,
  nonBranded,
}: {
  branded: { clicks: number; impressions: number };
  nonBranded: { clicks: number; impressions: number };
}) {
  const total = branded.clicks + nonBranded.clicks;
  const brandedPct = total > 0 ? (branded.clicks / total) * 100 : 0;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader
        eyebrow="Brand health"
        title="Branded vs non-branded"
        hint="Healthy SEO mix is ~30% branded / 70% non-branded"
      />
      <div className="mt-3 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${brandedPct}%`,
            background: BRAND,
            display: "inline-block",
          }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
            Branded
          </p>
          <p className="text-[18px] font-display font-medium tabular-nums text-foreground leading-tight">
            {branded.clicks.toLocaleString()}{" "}
            <span className="text-[10px] font-mono text-muted-foreground">
              ({brandedPct.toFixed(0)}%)
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {branded.impressions.toLocaleString()} impressions
          </p>
        </div>
        <div>
          <p className="text-[9.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
            Non-branded
          </p>
          <p className="text-[18px] font-display font-medium tabular-nums text-foreground leading-tight">
            {nonBranded.clicks.toLocaleString()}{" "}
            <span className="text-[10px] font-mono text-muted-foreground">
              ({(100 - brandedPct).toFixed(0)}%)
            </span>
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {nonBranded.impressions.toLocaleString()} impressions
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SITE HEALTH GAUGE
// ============================================================================

export function SiteHealthGauge({
  score,
  critical,
  warning,
  notice,
}: {
  score: number;
  critical: number;
  warning: number;
  notice: number;
}) {
  const data = [{ name: "score", value: score, fill: BRAND }];
  void data;
  const color = score >= 75 ? SUCCESS : score >= 50 ? BRAND : score >= 25 ? "#F59E0B" : DANGER;
  const ringR = 36;
  const ringC = 2 * Math.PI * ringR;
  const dash = (score / 100) * ringC;
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <SectionHeader eyebrow="Technical" title="Site health" />
      <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-4 items-center mt-2">
        <div className="relative h-[100px] w-[100px]">
          <svg viewBox="0 0 80 80" className="absolute inset-0">
            <circle cx="40" cy="40" r={ringR} fill="none" stroke={BORDER} strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r={ringR}
              fill="none"
              stroke={color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${ringC}`}
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[24px] font-display font-medium tabular-nums leading-none">
              {Math.round(score)}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
              / 100
            </span>
          </div>
        </div>
        <div className="space-y-1">
          <Severity dot={DANGER} label="Critical" value={critical} />
          <Severity dot="#F59E0B" label="Warning" value={warning} />
          <Severity dot={MUTED} label="Notice" value={notice} />
        </div>
      </div>
    </section>
  );
}

function Severity({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dot }}
      />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ============================================================================
// LOCAL PACK TRACKER
// ============================================================================

export type LocalPackRow = {
  query: string;
  ourPosition: number | null;
  topResults: Array<{ position: number; title: string; rating: number | null; reviewCount: number }>;
};

export function LocalPackCard({ rows }: { rows: LocalPackRow[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <SectionHeader
          eyebrow="Google Maps"
          title="Local pack tracker"
        />
        <p className="text-[12px] text-muted-foreground py-8 text-center">
          Available after the first DataforSEO sync (local pack queries).
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="px-5 py-3 border-b border-border">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          Google Maps
        </p>
        <h3 className="text-sm font-semibold text-foreground">
          Local pack tracker
        </h3>
      </header>
      <ul className="divide-y divide-border">
        {rows.slice(0, 6).map((r) => (
          <li
            key={r.query}
            className="grid grid-cols-[1fr_72px_120px] items-center gap-3 px-5 py-2.5"
          >
            <p className="text-[12.5px] font-medium text-foreground truncate">
              "{r.query}"
            </p>
            <div className="text-right">
              {r.ourPosition == null ? (
                <span className="text-[10.5px] text-muted-foreground">
                  Not in pack
                </span>
              ) : (
                <span
                  className={`text-[14px] font-display font-semibold tabular-nums ${
                    r.ourPosition === 1 ? "text-emerald-700" : "text-primary"
                  }`}
                >
                  #{r.ourPosition}
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground truncate text-right">
              Top: {r.topResults[0]?.title ?? "—"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ============================================================================
// Shared section header
// ============================================================================

function SectionHeader({
  eyebrow,
  title,
  hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <header className="mb-3">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
        {eyebrow}
      </p>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint ? (
        <p className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </header>
  );
}
