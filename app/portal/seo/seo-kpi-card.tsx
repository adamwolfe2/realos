"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// SeoKpiCard — one of the four hero metrics across the top of the SEO
// overview. Renders a small uppercase label, a large value, a delta pill,
// and a 30-day sparkline.
//
// The sparkline is hand-rolled SVG. Keeping it off recharts removes a
// not-insignificant amount of JS from the initial chunk (recharts is heavy)
// and gives us pixel-perfect control over how the line tucks into the card.
//
// Brand cohesion: positive movement uses `text-primary` (LeaseStack blue).
// Negative/flat movement uses `text-muted-foreground`. No green/red toning
// per the single-blue rule.
// ---------------------------------------------------------------------------

export type KpiDelta = {
  label: string;        // pre-formatted "+12%", "-3%", "+0.4", "—"
  positive: boolean;    // true => primary tone, false/flat => muted tone
};

export type SeoKpiCardProps = {
  label: string;
  value: string;
  delta: KpiDelta;
  /** 30 daily values, oldest first. Length must equal 30 (or 0 to skip). */
  sparkline: number[];
  /** Optional secondary value rendered under the label as small caption. */
  caption?: string;
  /** If `true`, lower-is-better metric (avg position) — sparkline flips. */
  invertSparkline?: boolean;
};

export function SeoKpiCard({
  label,
  value,
  delta,
  sparkline,
  caption,
  invertSparkline = false,
}: SeoKpiCardProps) {
  const toneClass = delta.positive
    ? "text-primary bg-primary/10"
    : "text-muted-foreground bg-muted/60";

  return (
    <div className="ls-card p-4 flex flex-col gap-2.5 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {label}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums ${toneClass}`}
        >
          {delta.label}
        </span>
      </div>
      <div className="min-w-0">
        <div
          className="text-[26px] md:text-[28px] font-semibold tracking-tight tabular-nums text-foreground leading-none"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {value}
        </div>
        {caption ? (
          <div className="mt-1 text-[11px] text-muted-foreground leading-tight">
            {caption}
          </div>
        ) : null}
      </div>
      <Sparkline points={sparkline} invert={invertSparkline} />
    </div>
  );
}

// Inline SVG sparkline. 30 points, height 32, width fills parent (uses
// viewBox so it scales). Draws a single soft line + a faint area fill below
// so the spark reads as a continuous gradient instead of a thin wire.
function Sparkline({ points, invert }: { points: number[]; invert: boolean }) {
  if (points.length < 2) {
    return <div className="h-8 w-full" aria-hidden="true" />;
  }

  const w = 100;
  const h = 32;
  const padding = 2;

  // Position is "lower is better". Flip the series so the visual climb still
  // reads as "things are improving".
  const series = invert ? points.map((p) => -p) : points;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const toX = (i: number) =>
    padding + ((w - padding * 2) * i) / Math.max(1, series.length - 1);
  const toY = (v: number) =>
    h - padding - ((v - min) / range) * (h - padding * 2);

  const path = series
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(2)},${toY(v).toFixed(2)}`)
    .join(" ");

  const areaPath =
    `M${toX(0).toFixed(2)},${h} ` +
    series.map((v, i) => `L${toX(i).toFixed(2)},${toY(v).toFixed(2)}`).join(" ") +
    ` L${toX(series.length - 1).toFixed(2)},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-8 text-primary"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kpi-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#kpi-spark-fill)" />
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
