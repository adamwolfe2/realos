"use client";

import * as React from "react";
import { EmptyStateBody } from "./charts/shared";
import {
  Cell,
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
// EMPTY-STATE PREVIEW ILLUSTRATIONS (faded mini SVG charts)
// ============================================================================

function StrikingDistancePreview() {
  // Three faded sample rows — query, position pill, impressions bar.
  const rows = [
    { q: "section 8 housing nyc", pos: 7, imps: 78 },
    { q: "tenant background check", pos: 11, imps: 56 },
    { q: "rental listing software", pos: 14, imps: 38 },
  ];
  return (
    <svg viewBox="0 0 160 92" className="w-full h-auto" role="img" aria-hidden="true">
      {rows.map((r, i) => {
        const y = 12 + i * 26;
        return (
          <g key={i} opacity="0.75">
            <text x="4" y={y + 4} fontSize="6" fontFamily="var(--font-mono)" fill={INK}>
              {r.q}
            </text>
            <rect x="92" y={y - 4} width="14" height="10" rx="2" fill={BRAND} fillOpacity="0.18" />
            <text x="99" y={y + 3} fontSize="6" fontFamily="var(--font-mono)" fill={BRAND} textAnchor="middle">
              #{r.pos}
            </text>
            <rect x="114" y={y - 3} width={r.imps * 0.5} height="8" rx="2" fill={BRAND_LIGHT} fillOpacity="0.65" />
            <rect x="114" y={y - 3} width="40" height="8" rx="2" fill="none" stroke={BORDER} />
          </g>
        );
      })}
      <line x1="0" y1="86" x2="160" y2="86" stroke={BORDER} strokeDasharray="2 3" />
    </svg>
  );
}

function ShareOfVoicePreview() {
  // Faded donut with five wedges in brand-blue ramp.
  const segments = [
    { dasharray: "120 380", color: BRAND, op: 0.85 },
    { dasharray: "85 380", color: BRAND, op: 0.55, offset: -120 },
    { dasharray: "60 380", color: BRAND_LIGHT, op: 0.75, offset: -205 },
    { dasharray: "45 380", color: BRAND_LIGHTER, op: 0.9, offset: -265 },
    { dasharray: "70 380", color: MUTED, op: 0.4, offset: -310 },
  ];
  const C = 2 * Math.PI * 30;
  return (
    <svg viewBox="0 0 96 96" className="w-full h-auto" role="img" aria-hidden="true">
      <circle cx="48" cy="48" r="30" fill="none" stroke={BORDER} strokeWidth="14" />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx="48"
          cy="48"
          r="30"
          fill="none"
          stroke={s.color}
          strokeOpacity={s.op}
          strokeWidth="14"
          strokeDasharray={s.dasharray}
          strokeDashoffset={s.offset ?? 0}
          transform="rotate(-90 48 48)"
        />
      ))}
      <text x="48" y="46" fontSize="6" fontFamily="var(--font-mono)" fill={BRAND} textAnchor="middle">
        YOU
      </text>
      <text x="48" y="55" fontSize="9" fontFamily="var(--font-display)" fill={INK} textAnchor="middle">
        28%
      </text>
      {void C}
    </svg>
  );
}

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
  /** Plain-English one-liner of what this number means, for non-SEO readers. */
  sublabel?: string;
  /** Benchmark state vs a sensible threshold; renders a good/ok/bad dot. */
  tone?: "good" | "ok" | "bad";
  /** When the source isn't connected, show this + a fix link instead of "—". */
  notConnected?: { label: string; href: string };
};

const TONE_DOT: Record<"good" | "ok" | "bad", string> = {
  good: "#10B981",
  ok: "#F59E0B",
  bad: "#EF4444",
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
          const isMissing = s.value === "—" && s.notConnected;
          return (
            <div key={s.label} className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                {s.tone ? (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: TONE_DOT[s.tone] }}
                    aria-hidden="true"
                  />
                ) : null}
                <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
                  {s.label}
                </p>
              </div>
              <p className="mt-0.5 text-[20px] font-display font-medium tabular-nums leading-none text-foreground">
                {s.value}
              </p>
              {isMissing ? (
                <a
                  href={s.notConnected!.href}
                  className="mt-1.5 inline-block text-[10px] font-medium text-primary hover:underline leading-tight"
                >
                  {s.notConnected!.label} →
                </a>
              ) : showDelta ? (
                <p
                  className="mt-1.5 text-[11px] font-medium tabular-nums leading-none"
                  style={{ color }}
                >
                  {flat ? "Flat" : `${sign}${s.deltaPct ? `${s.delta!.toFixed(1)}%` : s.delta!.toLocaleString()}`}
                </p>
              ) : null}
              {s.sublabel ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug">
                  {s.sublabel}
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
        <div className="px-5 py-5">
          <EmptyStateBody
            preview={<StrikingDistancePreview />}
            body="A ranked list of queries already showing in positions #4–20 with real impression volume — the closest-to-the-money keywords. Each row links to the URL ranking for it, so you know exactly which page to optimize first."
            example={`"section 8 housing nyc" at #7 with 4,200 monthly impressions and 1.4% CTR is a clean target — a meta refresh + one internal link is usually worth +2 positions and ~80 clicks/month.`}
          />
        </div>
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
          hint="% of total impressions across your tracked queries, you vs. top competitors."
        />
        <EmptyStateBody
          preview={<ShareOfVoicePreview />}
          body="A donut showing how the SERP-impression pie splits across you and your top five competitors for every keyword you track. Your slice is always brand-blue and labelled — competitors fade into the ramp behind."
          example={`If you sit at 28% and the next two competitors hold 22% and 18%, you'll see a chunky blue wedge against two lighter ones — the visual cue that you're leading but not running away with it.`}
        />
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
            <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground">
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
                    r.ourPosition === 1 ? "text-primary font-bold" : "text-primary"
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
