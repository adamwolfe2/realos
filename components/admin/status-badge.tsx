import * as React from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/format";

// Compact status pill: filled tint + subtle dot. Consistent geometry so that
// every status across the product reads as the same component, whether it's
// a tenant lifecycle, a lead stage, a module on/off, or an audit event tone.

// Brand-aligned tone scale. Single LeaseStack accent (#2563EB / primary)
// signals every state — info/success/warning all use brand blue with
// different intensity. Danger uses the destructive token because true
// destructive states warrant alarm. Neutral + muted stay grayscale.
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-muted text-foreground",
  info:    "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  warning: "bg-primary/15 text-primary",
  danger:  "bg-destructive/10 text-destructive",
  muted:   "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground",
  info:    "bg-primary",
  success: "bg-primary",
  warning: "bg-primary",
  danger:  "bg-destructive",
  muted:   "bg-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "neutral",
  dot = true,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("inline-block h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

// For module/feature on-off lines: consistent dot + label.
// Brand-blue when enabled, muted when disabled — no green leak.
export function ToggleIndicator({
  on,
  className,
}: {
  on: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap",
        on ? "text-primary" : "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          on ? "bg-primary" : "bg-muted-foreground/40",
        )}
      />
      {on ? "Enabled" : "Disabled"}
    </span>
  );
}
