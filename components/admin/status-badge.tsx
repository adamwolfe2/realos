import * as React from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/format";

// Compact status pill: filled tint + subtle dot. Consistent geometry so that
// every status across the product reads as the same component, whether it's
// a tenant lifecycle, a lead stage, a module on/off, or an audit event tone.

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  info:    "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger:  "bg-rose-50 text-rose-700",
  muted:   "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  info:    "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger:  "bg-rose-500",
  muted:   "bg-slate-400",
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
        on ? "text-emerald-700" : "text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          on ? "bg-emerald-500" : "bg-slate-300"
        )}
      />
      {on ? "Enabled" : "Disabled"}
    </span>
  );
}
