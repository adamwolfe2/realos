import * as React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// KpiTile
//
// The atomic dashboard tile. Designed for the top KPI strip on /portal.
// Renders: tiny eyebrow icon, label, big tabular number, trailing delta
// (up/down/flat), and an optional inline sparkline. Built to slot real
// data later without any markup churn — every dynamic field is a clean prop.
// ---------------------------------------------------------------------------

export type Trend = "up" | "down" | "flat";

export type KpiTileProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; trend: Trend };
  spark?: number[];
  icon?: React.ReactNode;
  // When data isn't wired yet, render a soft placeholder shimmer instead.
  loading?: boolean;
  // When clicking the tile should drill into a sub-page.
  href?: string;
  // Live mode: pulses a small dot to indicate realtime data.
  live?: boolean;
};

import Link from "next/link";

export function KpiTile(props: KpiTileProps) {
  const inner = <KpiTileInner {...props} />;
  if (props.href) {
    return (
      <Link
        href={props.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-blue)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--parchment)] rounded-xl"
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
  icon,
  loading,
  live,
}: KpiTileProps) {
  return (
    <div
      className={cn(
        "group relative h-full rounded-xl border border-[var(--border-cream)] bg-[var(--ivory)] p-4 transition-shadow duration-150",
        "hover:shadow-[0_4px_24px_rgba(0,0,0,0.05)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon ? (
            <span className="text-[var(--stone-gray)] shrink-0" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="text-[10px] tracking-widest uppercase font-semibold text-[var(--stone-gray)] truncate">
            {label}
          </div>
        </div>
        {live ? (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div
          className={cn(
            "text-[26px] leading-none font-semibold tracking-tight tabular-nums text-[var(--near-black)]",
            loading && "text-transparent bg-[var(--warm-sand)] rounded animate-pulse",
          )}
        >
          {loading ? "0000" : value}
        </div>
        {delta && !loading ? <DeltaPill {...delta} /> : null}
      </div>

      {hint ? (
        <div className="mt-1 text-[11px] text-[var(--stone-gray)]">{hint}</div>
      ) : null}

      {spark && spark.length > 1 && !loading ? (
        <div className="mt-3 -mx-1">
          <Sparkline data={spark} />
        </div>
      ) : null}
    </div>
  );
}

function DeltaPill({ value, trend }: { value: string; trend: Trend }) {
  const tone =
    trend === "up"
      ? "text-emerald-700 bg-emerald-50"
      : trend === "down"
        ? "text-rose-700 bg-rose-50"
        : "text-[var(--olive-gray)] bg-[var(--warm-sand)]";
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}

// Inline sparkline — pure SVG, no client JS, no dependency. Accepts any
// numeric series; auto-scales to the tile height (~28px). Designed to read
// at a glance, not to be precise.
function Sparkline({ data, height = 28 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const stepX = w / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  // Build a closed area path by extending the line down to the baseline.
  const areaPath = `M0,${h} L${points
    .split(" ")
    .map((p) => p)
    .join(" L")} L${w},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-7 overflow-visible"
      aria-hidden="true"
    >
      <path d={areaPath} fill="var(--terracotta)" opacity="0.10" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
