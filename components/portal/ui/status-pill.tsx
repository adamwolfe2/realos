import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// StatusPill — single neutral status badge used across every list/table/kanban
// surface in the portal. Replaces the previous per-page `STATUS_TONE` maps
// that painted the UI with amber/blue/emerald/rose chips and made the product
// read like a Jira clone.
//
// All pills share the same muted background, border, and label typography.
// The only color signal is a 6px dot whose hue maps to a small set of intent
// tokens — so a fast scan still tells you "in progress" vs "done" vs
// "attention" without the rainbow.
//
// Tokens map to product semantics, not to specific status names. Per-page
// status helpers translate their enums (TourStatus, ResidentStatus, etc.)
// into one of these tokens.
// ---------------------------------------------------------------------------

export type StatusTone =
  | "neutral" // e.g. cancelled, archived, past — no action expected
  | "info" // pending operator action — requested, draft
  | "active" // in flight — scheduled, in progress
  | "success" // resolved positively — completed, signed
  | "warning" // attention — notice given, expiring, past-due
  | "danger"; // negative outcome — no-show, evicted, failed

// Status dots used to span emerald / blue / amber / rose. Collapsed to a
// minimal palette: neutral grays for "no action needed" states, brand blue
// for in-flight + success, and a single red for genuine alarm. Warning still
// uses amber because demoting expiring/past-due to gray loses real signal —
// but we now only reach for it on truly time-sensitive states.
const DOT_TONE: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground/40",
  info: "bg-muted-foreground/70",
  active: "bg-primary",
  success: "bg-primary",
  warning: "bg-amber-500",
  danger: "bg-destructive",
};

type Props = {
  /** Visible label. Should already be Title Case. */
  label: string;
  /** Intent token. Defaults to neutral so an unknown status fades into the UI. */
  tone?: StatusTone;
  /** Hide the leading dot when the surrounding context already conveys color. */
  hideDot?: boolean;
  className?: string;
};

export function StatusPill({
  label,
  tone = "neutral",
  hideDot,
  className,
}: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-foreground whitespace-nowrap",
        className,
      )}
    >
      {hideDot ? null : (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_TONE[tone])}
        />
      )}
      {label}
    </span>
  );
}
