import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { ScoreRing } from "./score-ring";

// ----------------------------------------------------------------------------
// SignalCard — the hero strip's atomic unit. Six of these line up at the top
// of /portal/insights. Each shows a big number, a tiny label, a WoW delta
// chip, and a 14-day sparkline. The whole card is a Link to its detail page.
//
// Kept server-component so the hero strip streams without client hydration.
// The "live" feel comes from the daily snapshot pipeline — every render is
// fresh data straight from DailySignalSnapshot.
// ----------------------------------------------------------------------------

export type SignalCardProps = {
  label: string;
  value: string;
  /** Week-over-week % change. Drives the delta chip color + arrow. */
  deltaPct: number | null;
  /** 14-day series for the sparkline footer. */
  series: number[];
  href: string;
  /** Optional tone override — defaults to inferred from the delta. */
  tone?: "positive" | "negative" | "neutral";
  /** Optional one-line caption rendered under the value. */
  caption?: string;
  /** Renders `value` as a filled donut ring instead of bare digits — the
   *  page's one hero tile (Overall score) gets a visual anchor the other
   *  five signal cards don't need. */
  ring?: boolean;
};

export function SignalCard({
  label,
  value,
  deltaPct,
  series,
  href,
  tone,
  caption,
  ring,
}: SignalCardProps) {
  const inferredTone: "positive" | "negative" | "neutral" =
    tone ??
    (deltaPct == null
      ? "neutral"
      : deltaPct > 1
        ? "positive"
        : deltaPct < -1
          ? "negative"
          : "neutral");

  return (
    <Link
      href={href}
      className={cn(
        "group relative block rounded-[2px] border border-border bg-card",
        "px-4 pt-3 pb-2 transition-all overflow-hidden",
        "hover:shadow-[0_2px_12px_rgba(15,23,42,0.06)] hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      )}
    >
      <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 flex gap-2",
          ring ? "items-center justify-between" : "items-baseline justify-between",
        )}
      >
        {ring && Number.isFinite(Number.parseFloat(value)) ? (
          <ScoreRing value={Number.parseFloat(value)} />
        ) : (
          <div className="font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-foreground leading-none">
            {value}
          </div>
        )}
        <DeltaChip deltaPct={deltaPct} tone={inferredTone} />
      </div>
      {caption ? (
        <div className="mt-1 text-[11px] text-muted-foreground truncate">
          {caption}
        </div>
      ) : null}
      <div className="mt-2 -mx-1">
        {series.length > 0 ? (
          <Sparkline points={series} tone={inferredTone} />
        ) : (
          <div className="flex h-6 items-center px-1 text-[10px] text-muted-foreground">
            No history yet
          </div>
        )}
      </div>
    </Link>
  );
}

function DeltaChip({
  deltaPct,
  tone,
}: {
  deltaPct: number | null;
  tone: "positive" | "negative" | "neutral";
}) {
  if (deltaPct == null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
        <Minus className="h-3 w-3" />—
      </span>
    );
  }
  const rounded = Math.abs(deltaPct) >= 10
    ? Math.round(deltaPct)
    : Math.round(deltaPct * 10) / 10;
  const Icon =
    tone === "positive"
      ? ArrowUpRight
      : tone === "negative"
        ? ArrowDownRight
        : Minus;
  const color =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums",
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(rounded)}%
    </span>
  );
}
