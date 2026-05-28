import * as React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Stat — monochrome, typography-first stat tile. Replaces colored "KPI
// strips" with green/red/blue accent washes. The number does the heavy
// lifting: 3xl–5xl numeric display, small uppercase caption below, neutral
// text. Delta indicators (▲ / ▼) stay but render in subdued neutral tones,
// NEVER as colored badges.
//
// Use this for inline stat rows that previously rendered as colored cards.
// For KPI tiles with charts (sparkline / bars / gauge), keep using
// components/portal/dashboard/kpi-tile.tsx — that one is the primary
// dashboard hero metric with brand-glow on the accent variant.
//
// Sizing:
//   sm  → 24px number (compact rows inside cards)
//   md  → 32px number (default — table headers, page strip)
//   lg  → 40px number (hero stat strip on detail pages)
//   xl  → 48px number (single-stat callouts)
// ---------------------------------------------------------------------------

export type StatTrend = "up" | "down" | "flat";

export type StatProps = {
  /** Numeric or pre-formatted display value. */
  value: React.ReactNode;
  /** Small caption shown BELOW the number, e.g. "Active leads". */
  label: string;
  /** Optional one-line hint, even smaller, e.g. "28d rolling". */
  hint?: string;
  /** Subdued neutral delta (no colored badge). Direction sets the glyph. */
  delta?: { value: string; trend: StatTrend };
  size?: "sm" | "md" | "lg" | "xl";
  align?: "left" | "center";
  className?: string;
};

const SIZE: Record<NonNullable<StatProps["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
  xl: "text-5xl",
};

const ALIGN: Record<NonNullable<StatProps["align"]>, string> = {
  left: "items-start text-left",
  center: "items-center text-center",
};

export function Stat({
  value,
  label,
  hint,
  delta,
  size = "md",
  align = "left",
  className,
}: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1", ALIGN[align], className)}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-semibold tabular-nums tracking-tight text-foreground",
            "font-[var(--font-mono,inherit)]",
            SIZE[size],
          )}
        >
          {value}
        </span>
        {delta ? <DeltaInline {...delta} /> : null}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
        {label}
      </div>
      {hint ? (
        <div className="text-[11px] text-muted-foreground/80 leading-snug">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

// Inline delta — subdued neutral tone. The glyph carries direction, the
// color stays neutral. Reads as data, not as alarm.
function DeltaInline({ value, trend }: { value: string; trend: StatTrend }) {
  const Icon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
      <Icon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatStrip — horizontal row of Stat tiles separated by hairlines. Drops
// into any page header where you want a quiet "by the numbers" row above
// the main content. No colored backgrounds, no card chrome — just the
// numbers and a thin divider between them.
// ---------------------------------------------------------------------------

export function StatStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-stretch divide-x divide-border",
        "rounded-xl border border-border bg-card px-1 py-1",
        className,
      )}
    >
      {React.Children.map(children, (child, i) => (
        <div key={i} className="flex-1 min-w-[160px] px-5 py-4">
          {child}
        </div>
      ))}
    </div>
  );
}
