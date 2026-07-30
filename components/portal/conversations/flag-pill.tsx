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
    bg: "bg-[rgba(36,161,72,0.10)]",
    text: "text-[#24a148]",
    dot: "bg-[#24a148]",
    ring: "ring-[#24a148]/30",
  },
  quality_bad: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
    ring: "ring-destructive/30",
  },
  needs_prompt_tuning: {
    bg: "bg-amber-50",
    text: "text-amber-900",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
  },
  lead_high_intent: {
    // High-intent is a success signal, not a brand/neutral one — green
    // family, same as quality_good, so the operator reads both as "good".
    bg: "bg-[rgba(36,161,72,0.10)]",
    text: "text-[#24a148]",
    dot: "bg-[#24a148]",
    ring: "ring-[#24a148]/25",
  },
  lead_low_intent: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    ring: "ring-border",
  },
  followup_needed: {
    bg: "bg-primary/10",
    text: "text-primary",
    dot: "bg-primary",
    ring: "ring-primary/30",
  },
  handoff_missed: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    dot: "bg-destructive",
    ring: "ring-destructive/30",
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
        "inline-flex items-center gap-1.5 rounded-[2px] font-semibold uppercase whitespace-nowrap",
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
