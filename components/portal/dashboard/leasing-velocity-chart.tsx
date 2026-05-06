import * as React from "react";
import type { WeeklyVelocityPoint } from "@/lib/dashboard/queries";
import { CHART_SERIES_COLORS, CHART_NEUTRALS } from "@/lib/chart-palette";

const SERIES = [
  { key: "leads" as const, label: "Leads", color: CHART_SERIES_COLORS[0] },
  { key: "tours" as const, label: "Tours", color: CHART_SERIES_COLORS[1] },
  {
    key: "applications" as const,
    label: "Applications",
    color: CHART_SERIES_COLORS[2],
  },
];

// ---------------------------------------------------------------------------
// Leasing velocity — grouped bars per week.
//
// A line chart over sparse data shows spikes that look broken. Bars show
// each week honestly: empty weeks are empty, busy weeks are tall. The
// reader's eye still picks up momentum from the silhouette, without the
// misleading connected-line artifact.
// ---------------------------------------------------------------------------

export function LeasingVelocityChart({
  data,
}: {
  data: WeeklyVelocityPoint[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No leasing data yet. Leads, tours, and applications will appear here once activity starts.
      </p>
    );
  }

  const totalActivity = data.reduce(
    (acc, d) => acc + d.leads + d.tours + d.applications,
    0,
  );

  if (totalActivity === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Waiting on the first lead.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Once leads, tours, and applications start flowing, you&apos;ll see week-over-week momentum here.
        </p>
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.leads, d.tours, d.applications]),
  );

  const n = data.length;
  // viewBox units — SVG scales with the container.
  const W = 100;
  const H = 56;
  const chartH = H;
  const paddingTop = 2;
  const paddingBottom = 0;
  const plotH = chartH - paddingTop - paddingBottom;

  const groupWidth = W / n;
  const barsPerGroup = SERIES.length;
  const barGap = groupWidth * 0.08;
  const barWidth = Math.max(
    0.6,
    (groupWidth - barGap * (barsPerGroup + 1)) / barsPerGroup,
  );

  function barHeight(v: number): number {
    // Minimum 0.6 so any non-zero value is visible as a tick.
    if (v === 0) return 0;
    return Math.max(0.6, (v / maxVal) * (plotH - paddingTop));
  }

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-32"
        role="img"
        aria-label="Leasing velocity — leads, tours, applications by week"
      >
        {/* Gridlines at 25/50/75/100% of max */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = chartH - paddingBottom - frac * (plotH - paddingTop);
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={W}
              y2={y}
              stroke={CHART_NEUTRALS.grid}
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Grouped bars per week */}
        {data.map((d, i) => {
          const groupX = i * groupWidth;
          return (
            <g key={i}>
              {SERIES.map(({ key, color, label }, s) => {
                const val = d[key];
                const h = barHeight(val);
                const x = groupX + barGap + s * (barWidth + barGap);
                const y = chartH - paddingBottom - h;
                return (
                  <rect
                    key={key}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={color}
                    rx={0.3}
                  >
                    <title>{`${label}: ${val} · ${d.weekLabel}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={0}
          y1={chartH - paddingBottom}
          x2={W}
          y2={chartH - paddingBottom}
          stroke={CHART_NEUTRALS.reference}
          strokeWidth="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* X-axis labels — render every other week to avoid crowding, always include the last one */}
      <div className="relative h-4" aria-hidden="true">
        {data.map((d, i) => {
          if (i % 2 !== 0 && i !== n - 1) return null;
          const pct = ((i + 0.5) / n) * 100;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-[9px] text-muted-foreground tabular-nums"
              style={{ left: `${pct}%` }}
            >
              {d.weekLabel}
            </span>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        {SERIES.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          Peak week · {maxVal.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
