import * as React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export type Trend = "up" | "down" | "flat";

export type KpiTileProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: { value: string; trend: Trend };
  spark?: number[];
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
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 rounded-lg"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function KpiTileInner({ label, value, hint, delta, spark, icon, loading, live, locked }: KpiTileProps) {
  return (
    <div
      className={cn(
        "relative h-full rounded-lg border border-border bg-card p-3 ls-hover-lift",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon ? (
            <span className="text-muted-foreground shrink-0" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground truncate">
            {label}
          </div>
        </div>
        {live && !locked ? (
          <span className="relative inline-flex h-2 w-2 shrink-0" aria-label="Live">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl leading-none font-semibold tracking-tight text-muted-foreground/50">
            —
          </span>
          <Link
            href={locked.href}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Connect →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-1.5 flex items-baseline justify-between gap-2 min-w-0">
            <div
              className={cn(
                "text-xl leading-none font-semibold tracking-tight tabular-nums text-foreground min-w-0 truncate",
                loading && "text-transparent bg-muted rounded animate-pulse",
              )}
            >
              {loading ? "0000" : value}
            </div>
            {delta && !loading ? <DeltaPill {...delta} /> : null}
          </div>

          {hint ? (
            <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{hint}</div>
          ) : null}

          {spark && spark.length > 1 && !loading ? (
            <div className="mt-3 -mx-1">
              <Sparkline data={spark} />
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
      ? "text-emerald-700 bg-emerald-50"
      : trend === "down"
        ? "text-rose-700 bg-rose-50"
        : "text-muted-foreground bg-muted";
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

  const areaPath = `M0,${h} L${points.split(" ").join(" L")} L${w},${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-7 overflow-visible"
      aria-hidden="true"
    >
      <path d={areaPath} fill="#2563EB" opacity="0.08" />
      <polyline
        points={points}
        fill="none"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
