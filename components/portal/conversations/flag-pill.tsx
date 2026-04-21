import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// FlagPill
//
// Single colored pill for a conversation flag. The operator applies these
// manually while reviewing transcripts. The visual signals the flag's meaning
// without forcing the operator to parse a label.
// ---------------------------------------------------------------------------

export const FLAG_TYPES = [
  "quality_good",
  "quality_bad",
  "needs_prompt_tuning",
  "lead_high_intent",
  "lead_low_intent",
  "followup_needed",
  "handoff_missed",
] as const;

export type FlagType = (typeof FLAG_TYPES)[number];

export const FLAG_LABEL: Record<FlagType, string> = {
  quality_good: "Quality good",
  quality_bad: "Quality bad",
  needs_prompt_tuning: "Needs prompt tuning",
  lead_high_intent: "High intent",
  lead_low_intent: "Low intent",
  followup_needed: "Follow-up needed",
  handoff_missed: "Handoff missed",
};

// Matrix of background + foreground classes. Each color aligns with the
// project palette: warm accents on parchment, cool surfaces on ivory.
export const FLAG_TONE: Record<
  FlagType,
  { bg: string; text: string; dot: string; ring: string }
> = {
  quality_good: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  quality_bad: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    dot: "bg-rose-500",
    ring: "ring-rose-200",
  },
  needs_prompt_tuning: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
  },
  lead_high_intent: {
    // Terracotta is the brand accent; use it for the high-intent signal so it
    // visually pops against the parchment page background. Opacity utilities
    // on the brand var give us a soft tint without authoring a new token.
    bg: "bg-[var(--terracotta)]/10",
    text: "text-[var(--terracotta)]",
    dot: "bg-[var(--terracotta)]",
    ring: "ring-[var(--terracotta)]/25",
  },
  lead_low_intent: {
    bg: "bg-[var(--warm-sand)]",
    text: "text-[var(--olive-gray)]",
    dot: "bg-[var(--stone-gray)]",
    ring: "ring-[var(--border-cream)]",
  },
  followup_needed: {
    bg: "bg-blue-50",
    text: "text-blue-800",
    dot: "bg-blue-500",
    ring: "ring-blue-200",
  },
  handoff_missed: {
    bg: "bg-rose-50",
    text: "text-rose-800",
    dot: "bg-rose-500",
    ring: "ring-rose-200",
  },
};

export function isFlagType(v: string): v is FlagType {
  return (FLAG_TYPES as readonly string[]).includes(v);
}

export function FlagPill({
  flag,
  size = "sm",
  withDot = false,
  className,
}: {
  flag: FlagType;
  size?: "sm" | "md";
  withDot?: boolean;
  className?: string;
}) {
  const tone = FLAG_TONE[flag];
  const label = FLAG_LABEL[flag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] font-semibold uppercase whitespace-nowrap",
        "tracking-[0.08em] ring-1 ring-inset",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        tone.bg,
        tone.text,
        tone.ring,
        className,
      )}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className={cn("inline-block h-1.5 w-1.5 rounded-full", tone.dot)}
        />
      ) : null}
      {label}
    </span>
  );
}
