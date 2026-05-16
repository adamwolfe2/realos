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

// Premium 2026 redesign: pills now carry their own tinted background AND a
// matching glowing dot. The tone is still semantic (intent, not color), but
// the visual signal is stronger so a quick scan picks "warning" vs "success"
// vs "danger" without rainbow-itis. Maps to .ls-pill-* in globals.css.
const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "ls-pill-neutral",
  info:    "ls-pill-info",
  active:  "ls-pill-active",
  success: "ls-pill-success",
  warning: "ls-pill-warning",
  danger:  "ls-pill-danger",
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
  // .ls-pill already includes the leading dot via ::before. When the caller
  // opts out of the dot we strip the class so the badge reads as a plain tag.
  return (
    <span
      className={cn(
        hideDot ? "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" : "ls-pill",
        TONE_CLASS[tone],
        className,
      )}
      style={hideDot ? { boxShadow: "none" } : undefined}
    >
      {label}
    </span>
  );
}
