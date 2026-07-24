import * as React from "react";
import { ArrowUpRight, ArrowDownRight, ArrowRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  AnimatedKpiValue,
  AnimatedSparkline,
  AnimatedBarMini,
  AnimatedGauge,
} from "@/components/portal/dashboard/kpi-tile-visuals";

// Premium 2026 redesign: KPI tiles now feel like primary data anchors, not
// sidebar metrics. Mono numerics, optional brand-accent glow on the hero
// tile (variant="accent"), softer hairline borders, lift on hover with a
// real shadow. Sparklines + bars + gauge variants preserved.

export type Trend = "up" | "down" | "flat";

// Visual variant for the embedded micro-chart slot. Per the Premium
// dashboard pass: every KPI tile carries its own visualization (sparkline
// for cumulative trends, bars for daily totals, gauge for capacity-style
// ratios). Each ship the same SVG-only, server-renderable footprint so
// the dashboard can stream without a client hydration cost.
export type KpiChartVariant = "sparkline" | "bars" | "gauge";

export type KpiTileProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; trend: Trend };
  spark?: number[];
  /** 0..1 ratio for gauge variant (e.g. occupancy / capacity). */
  gaugeValue?: number;
  /** Forces the chart variant. Default: sparkline when `spark` present. */
  chart?: KpiChartVariant;
  icon?: React.ReactNode;
  loading?: boolean;
  href?: string;
  live?: boolean;
  locked?: { reason: string; href: string };
  /** "accent" marks the hero KPI (flat 2px blue left border post-Carbon). */
  variant?: "default" | "accent";
  /** "dense" tightens padding, value size, and chart height for the
   *  dashboard's 4-up strip. Default leaves every other caller unchanged. */
  density?: "default" | "dense";
};

export function KpiTile(props: KpiTileProps) {
  const inner = <KpiTileInner {...props} />;
  if (props.href) {
    return (
      <Link
        href={props.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-[2px]"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function KpiTileInner({
  label,
  value,
  hint,
  delta,
  spark,
  gaugeValue,
  chart,
  icon,
  loading,
  live,
  locked,
  variant = "default",
  density = "default",
}: KpiTileProps) {
  // Pick the chart variant. Explicit `chart` prop wins; otherwise default
  // to sparkline whenever a spark array is supplied. A `gaugeValue` 0..1
  // automatically routes to the gauge dial even without an explicit prop.
  const chartVariant: KpiChartVariant =
    chart ?? (gaugeValue != null ? "gauge" : "sparkline");
  const dense = density === "dense";
  const chartHeight = dense ? 28 : 36;

  return (
    <div
      className={cn(
        // Carbon-flat tile: border-first white card. The hero tile
        // (variant="accent") carries a flat 2px blue left border so the
        // eye lands on the headline metric first.
        "ls-card group relative h-full",
        dense ? "p-4" : "p-5",
        variant === "accent" && "ls-card-accent",
      )}
    >
      <div className="relative z-[1] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon ? (
            <span
              className="inline-flex items-center justify-center h-7 w-7 rounded-[2px] shrink-0 bg-[#edf5ff] text-[#0f62fe]"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <div className="ls-eyebrow truncate">{label}</div>
        </div>
        {live && !locked ? (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : null}
      </div>

      {locked ? (
        <div className="relative z-[1] mt-4 space-y-1.5">
          <div className="text-[12px] leading-snug text-muted-foreground line-clamp-2">
            {locked.reason}
          </div>
          <Link
            href={locked.href}
            className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary hover:underline"
          >
            Connect <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <>
          {/* Hero number: mono tabular figures, large, tightly tracked.
              Reads as a single anchored metric — the look of Linear /
              Vercel insights tiles. Counts up once on first view (motion
              pass 2026-07-24, ported from the marketing walkthrough's
              CountUp) — falls back to the static value when it isn't a
              plain formatted number (e.g. "—" locked/empty states). */}
          <div className="relative z-[1] mt-4 flex items-baseline justify-between gap-2 min-w-0">
            <div
              className={cn(
                "ls-metric min-w-0 truncate",
                dense ? "ls-metric-md" : "ls-metric-lg",
                loading && "text-transparent bg-muted rounded animate-pulse",
              )}
            >
              {loading ? "0000" : <AnimatedKpiValue value={value} />}
            </div>
            {delta && !loading ? <DeltaPill {...delta} /> : null}
          </div>

          {hint ? (
            <div className="relative z-[1] mt-1.5 text-[11px] text-muted-foreground truncate">
              {hint}
            </div>
          ) : null}

          {!loading ? (
            <div className="relative z-[1] mt-4">
              {chartVariant === "gauge" && gaugeValue != null ? (
                <AnimatedGauge value={gaugeValue} height={chartHeight} />
              ) : chartVariant === "bars" && spark && spark.length > 1 ? (
                <AnimatedBarMini data={spark} height={chartHeight} />
              ) : spark && spark.length > 1 ? (
                <AnimatedSparkline data={spark} height={chartHeight} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DeltaPill({ value, trend }: { value: string; trend: Trend }) {
  const klass =
    trend === "up" ? "ls-delta ls-delta-up"
    : trend === "down" ? "ls-delta ls-delta-down"
    : "ls-delta ls-delta-flat";
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <span className={cn("shrink-0", klass)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}

