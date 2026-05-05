import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Charts — pure SVG, server-rendered, token-themed. Donut, Sparkline,
// StatBar, and TrendLine shared across every dashboard surface so each
// chart looks the same regardless of which page it appears on.
// ---------------------------------------------------------------------------

// Brand-aligned palette — monochrome blue scale fading into neutral gray.
// Charts now read as one cohesive visualization rather than a SaaS rainbow.
// The dominant slice gets the deepest blue; secondary slices step down in
// saturation; remaining buckets fall back to gray so absent / "other"
// segments visually defer to the data that matters.
export const CHART_PALETTE = [
  "#1D4ED8", // blue-700 (dominant)
  "#2563EB", // blue-600 (brand)
  "#3B82F6", // blue-500
  "#60A5FA", // blue-400
  "#93C5FD", // blue-300
  "#9CA3AF", // gray-400
  "#D1D5DB", // gray-300
  "#E5E7EB", // gray-200 (other)
];

// ---------------------------------------------------------------------------
// Donut — used for occupancy, lead source mix, sentiment, etc.
// ---------------------------------------------------------------------------

export type DonutSlice = { label: string; value: number; color?: string };

export function Donut({
  slices,
  size = 120,
  strokeWidth = 18,
  centerPrimary,
  centerSecondary,
  /** When true, hides the center label so the donut can sit inline as a stat. */
  bare,
}: {
  slices: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerPrimary?: string;
  centerSecondary?: string;
  bare?: boolean;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circ = 2 * Math.PI * radius;
  if (total === 0) {
    return (
      <div
        className="relative shrink-0 grid place-items-center rounded-full"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={strokeWidth}
          />
        </svg>
        {!bare ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-base font-semibold leading-none text-muted-foreground">
              —
            </p>
          </div>
        ) : null}
      </div>
    );
  }
  let cumulative = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeWidth}
        />
        {slices.map((s, i) => {
          const frac = s.value / total;
          const dasharray = `${frac * circ} ${circ}`;
          const offset = -cumulative * circ;
          cumulative += frac;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color ?? CHART_PALETTE[i % CHART_PALETTE.length]}
              strokeWidth={strokeWidth}
              strokeDasharray={dasharray}
              strokeDashoffset={offset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {!bare ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {centerPrimary ? (
            <p className="text-lg font-semibold tabular-nums leading-none text-foreground">
              {centerPrimary}
            </p>
          ) : null}
          {centerSecondary ? (
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground mt-1 leading-tight">
              {centerSecondary}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DonutLegend — vertical legend pairing with Donut. Color dot + label +
// percentage + raw count.
// ---------------------------------------------------------------------------

export function DonutLegend({
  slices,
  total,
  limit = 6,
  className,
}: {
  slices: DonutSlice[];
  total?: number;
  limit?: number;
  className?: string;
}) {
  const sum = total ?? slices.reduce((s, x) => s + x.value, 0);
  if (sum === 0) {
    return (
      <p className={cn("text-[11px] text-muted-foreground", className)}>
        No data yet.
      </p>
    );
  }
  return (
    <ul className={cn("space-y-1 min-w-0", className)}>
      {slices.slice(0, limit).map((s, i) => {
        const pct = Math.round((s.value / sum) * 100);
        return (
          <li
            key={s.label}
            className="flex items-center justify-between gap-2 text-[11px] min-w-0"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: s.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
                }}
              />
              <span className="truncate text-foreground">{s.label}</span>
            </span>
            <span className="tabular-nums text-muted-foreground shrink-0">
              {pct}% <span className="text-foreground">({s.value.toLocaleString()})</span>
            </span>
          </li>
        );
      })}
      {slices.length > limit ? (
        <li className="text-[10px] text-muted-foreground italic pl-3.5">
          +{slices.length - limit} more
        </li>
      ) : null}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — single-series line, used inside KpiCard.
// ---------------------------------------------------------------------------

export function Sparkline({
  data,
  width = 100,
  height = 28,
  color = "var(--color-primary)",
  filled = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  filled?: boolean;
  className?: string;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" className={className} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = filled
    ? `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`
    : null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      {areaPath ? <path d={areaPath} fill={color} opacity="0.08" /> : null}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// StatBars — horizontal funnel/progress bars with optional drop-off labels.
// ---------------------------------------------------------------------------

export type StatBarRow = {
  label: string;
  value: number;
  /** Optional secondary count (e.g. previous period). */
  secondary?: number;
  color?: string;
};

export function StatBars({
  rows,
  showFunnelRate,
  className,
}: {
  rows: StatBarRow[];
  /** When true, shows "X% from prev" between adjacent bars. */
  showFunnelRate?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={cn("space-y-2", className)}>
      {rows.map((r, i) => {
        const widthPct = Math.max(4, Math.round((r.value / max) * 100));
        const dropPct =
          showFunnelRate && i > 0 && rows[i - 1].value > 0
            ? Math.round((r.value / rows[i - 1].value) * 100)
            : null;
        return (
          <li key={r.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-medium text-foreground">{r.label}</span>
              <span className="tabular-nums">
                <span className="text-foreground font-semibold">
                  {r.value.toLocaleString()}
                </span>
                {dropPct != null ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {dropPct}% from prev
                  </span>
                ) : null}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: r.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// VBarChart — vertical bar chart for renewals / occupancy / activity by day.
// ---------------------------------------------------------------------------

export type VBar = { label: string; value: number; sublabel?: string; color?: string };

export function VBarChart({
  bars,
  height = 96,
  className,
}: {
  bars: VBar[];
  height?: number;
  className?: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
    >
      {bars.map((b, i) => {
        const heightPct = b.value > 0 ? Math.max(8, (b.value / max) * 100) : 4;
        return (
          <div key={b.label} className="flex flex-col items-stretch gap-1.5">
            <div className="flex items-end" style={{ height }}>
              <div
                className="w-full rounded-md transition-all"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: b.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
                  opacity: b.value > 0 ? 1 : 0.18,
                }}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold tabular-nums leading-none text-foreground">
                {b.value.toLocaleString()}
              </p>
              <p className="text-[10px] tracking-wider uppercase text-muted-foreground mt-1">
                {b.label}
              </p>
              {b.sublabel ? (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  {b.sublabel}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
