import * as React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
};

export function KpiTile(props: KpiTileProps) {
  const inner = <KpiTileInner {...props} />;
  if (props.href) {
    return (
      <Link
        href={props.href}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-xl"
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
}: KpiTileProps) {
  // Pick the chart variant. Explicit `chart` prop wins; otherwise default
  // to sparkline whenever a spark array is supplied. A `gaugeValue` 0..1
  // automatically routes to the gauge dial even without an explicit prop.
  const variant: KpiChartVariant =
    chart ?? (gaugeValue != null ? "gauge" : "sparkline");

  return (
    <div
      className={cn(
        // Premium tile: white card, soft hairline border + tiny shadow on
        // hover so the surface reads as something floating instead of a
        // hairline-bordered box. Generous internal padding (p-4) per the
        // Mori / Emura / AeroStore inspiration set.
        "group relative h-full rounded-xl border border-border bg-card p-4 transition-all",
        "hover:border-primary/30 hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon ? (
            <span
              className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-primary/8 text-primary shrink-0"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground truncate">
            {label}
          </div>
        </div>
        {live && !locked ? (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-3 space-y-1.5">
          <div className="text-[11px] leading-snug text-muted-foreground line-clamp-2">
            {locked.reason}
          </div>
          <Link
            href={locked.href}
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
          >
            Connect <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Premium hierarchy: number is the hero (text-3xl ≈ 30px),
              delta pill sits to the right, hint sits below. Was text-xl
              which made every KPI feel like a sidebar metric. */}
          <div className="mt-3 flex items-baseline justify-between gap-2 min-w-0">
            <div
              className={cn(
                "text-3xl leading-none font-semibold tracking-tight tabular-nums text-foreground min-w-0 truncate",
                loading && "text-transparent bg-muted rounded animate-pulse",
              )}
            >
              {loading ? "0000" : value}
            </div>
            {delta && !loading ? <DeltaPill {...delta} /> : null}
          </div>

          {hint ? (
            <div className="mt-1 text-[11px] text-muted-foreground truncate">
              {hint}
            </div>
          ) : null}

          {!loading ? (
            <div className="mt-3">
              {variant === "gauge" && gaugeValue != null ? (
                <Gauge value={gaugeValue} />
              ) : variant === "bars" && spark && spark.length > 1 ? (
                <BarMini data={spark} />
              ) : spark && spark.length > 1 ? (
                <Sparkline data={spark} />
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function DeltaPill({ value, trend }: { value: string; trend: Trend }) {
  const tone =
    trend === "up"
      ? "text-primary bg-primary/10"
      : trend === "down"
        ? "text-destructive bg-destructive/10"
        : "text-muted-foreground bg-muted";
  const Icon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0",
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}

function Sparkline({ data, height = 36 }: { data: number[]; height?: number }) {
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

  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;
  // Last point gets a small accent dot, the dashboard inspiration set
  // (Emura, AeroStore) all do this — gives the sparkline a clear "this
  // is where we are today" anchor.
  const lastPoint = points.split(" ").pop()?.split(",");
  const lastX = lastPoint ? parseFloat(lastPoint[0]) : 0;
  const lastY = lastPoint ? parseFloat(lastPoint[1]) : 0;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ls-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#ls-spark-grad)" />
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.6" fill="#2563EB" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Bar histogram variant — used when the underlying data is daily totals
// rather than a cumulative trend (e.g. leads-per-day). Reads as a Mori
// fitness-tracker style mini chart inside the KPI card.
function BarMini({ data, height = 36 }: { data: number[]; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data);
  // Show the last 28 bars max; widen each bar when there are fewer.
  const slice = data.slice(-28);
  const gap = 1;
  const w = 100;
  const barW = (w - gap * (slice.length - 1)) / slice.length;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {slice.map((v, i) => {
        const barH = Math.max(1.5, (v / max) * (height - 2));
        const x = i * (barW + gap);
        const y = height - barH;
        // Most recent bar gets full brand blue, prior bars step down
        // through a muted tone so the eye lands on "today" first.
        const isLast = i === slice.length - 1;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={barH}
            rx="0.6"
            fill={isLast ? "#2563EB" : "#93C5FD"}
            opacity={isLast ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

// Radial gauge — used for capacity-style ratios like occupancy. Renders
// as a 180° arc from gray to brand blue with the percentage anchored at
// the center. Mirrors the AeroStore conversion-rate dial.
function Gauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const w = 100;
  const h = 36;
  const cx = w / 2;
  const cy = h - 2;
  const r = h - 6;
  const start = Math.PI; // left
  const end = 0; // right
  const angle = start + clamped * (end - start);

  const arcPath = (from: number, to: number) => {
    const x1 = cx + r * Math.cos(from);
    const y1 = cy + r * Math.sin(from);
    const x2 = cx + r * Math.cos(to);
    const y2 = cy + r * Math.sin(to);
    const largeArc = Math.abs(to - from) > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYEnd meet"
      className="w-full overflow-visible"
      style={{ height: `${h}px` }}
      aria-hidden="true"
    >
      <path
        d={arcPath(start, end)}
        fill="none"
        stroke="#E5E7EB"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d={arcPath(start, angle)}
        fill="none"
        stroke="#2563EB"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Tick at current value */}
      <circle
        cx={cx + r * Math.cos(angle)}
        cy={cy + r * Math.sin(angle)}
        r="2.4"
        fill="#FFFFFF"
        stroke="#2563EB"
        strokeWidth="1.4"
      />
    </svg>
  );
}
