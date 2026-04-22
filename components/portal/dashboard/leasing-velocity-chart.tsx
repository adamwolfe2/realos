import * as React from "react";
import type { WeeklyVelocityPoint } from "@/lib/dashboard/queries";

const SERIES = [
  { key: "leads" as const, label: "Leads", color: "#2563EB" },
  { key: "tours" as const, label: "Tours", color: "#10b981" },
  { key: "applications" as const, label: "Applications", color: "#8b5cf6" },
];

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

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => [d.leads, d.tours, d.applications]),
  );

  const W = 100;
  const H = 56;
  const paddingLeft = 0;
  const paddingBottom = 0;
  const chartH = H - paddingBottom;
  const n = data.length;

  function toX(i: number): number {
    return paddingLeft + (i / Math.max(1, n - 1)) * (W - paddingLeft);
  }
  function toY(v: number): number {
    return chartH - (v / maxVal) * (chartH - 4) - 2;
  }

  function polyline(key: "leads" | "tours" | "applications"): string {
    return data
      .map((d, i) => `${toX(i).toFixed(2)},${toY(d[key]).toFixed(2)}`)
      .join(" ");
  }

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-28"
        style={{ overflow: "visible" }}
        aria-label="Leasing velocity — leads, tours, applications by week"
      >
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = toY(maxVal * frac);
          return (
            <line
              key={frac}
              x1={paddingLeft}
              y1={y}
              x2={W}
              y2={y}
              stroke="#E3E3E3"
              strokeWidth="0.5"
            />
          );
        })}

        {SERIES.map(({ key, label, color }) => (
          <polyline
            key={key}
            points={polyline(key)}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          >
            <title>{label}</title>
          </polyline>
        ))}

        {SERIES.map(({ key, color }) =>
          data.map((d, i) => (
            <circle
              key={`${key}-${i}`}
              cx={toX(i)}
              cy={toY(d[key])}
              r="1"
              fill={color}
              vectorEffect="non-scaling-stroke"
            >
              <title>{`${key}: ${d[key]} · ${d.weekLabel}`}</title>
            </circle>
          )),
        )}

      </svg>
      {/* x-axis labels rendered as HTML to avoid SVG clipping */}
      <div className="relative h-4" aria-hidden="true">
        {data.map((d, i) => {
          if (i % 2 !== 0 && i !== n - 1) return null;
          const pct = (i / Math.max(1, n - 1)) * 100;
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
              className="inline-block h-2 w-4 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
