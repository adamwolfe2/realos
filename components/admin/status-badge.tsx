import * as React from "react";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "@/lib/format";

// ---------------------------------------------------------------------------
// StatusBadge — the SINGLE pill primitive every admin + portal surface uses.
//
// Geometry: rounded-full, gap-1.5, px-2 py-0.5, text-[11px], font-medium.
// Identical across every screen so the eye stops re-parsing the chip on
// every page transition.
//
// Tone scale is brand-aligned: info/success/warning stay inside the brand
// blue family (different intensities) so the admin doesn't fragment into
// a green/amber/blue rainbow. Danger uses destructive (the only red).
// `critical` is a real-fire variant for blocker-severity rows where the
// muted blue warning isn't loud enough.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// PlatformBadge — for "META", "GOOGLE ADS", "LINKEDIN", "TIKTOK", "REDDIT"
// style brand chips. Pre-fix every admin page invented its own (black META,
// gray GOOGLE ADS text label, etc.). This component renders all of them
// with the SAME geometry + a quiet brand-blue tint so the ad campaigns
// table reads as one product.
// ---------------------------------------------------------------------------
export function PlatformBadge({
  platform,
  className,
}: {
  platform: string;
  className?: string;
}) {
  // Friendly label: enum values like META / GOOGLE_ADS become "Meta" /
  // "Google Ads" but we keep ALL CAPS for brand intent. Strip underscores.
  const label = String(platform).replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// SeverityBadge — opinionated 4-tone pill for severity (low/medium/high/
// blocker). Used by bug reports + the insights queue. Unlike StatusBadge,
// severity gets a destructive variant for BLOCKER + amber for HIGH because
// these signal "stop everything" / "fix today" — collapsing them to brand
// blue washes out the actual urgency the operator needs to feel.
// ---------------------------------------------------------------------------
export type SeverityLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "BLOCKER"
  | "CRITICAL"
  | "WARNING"
  | "INFO";

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  LOW:      "bg-muted text-muted-foreground",
  MEDIUM:   "bg-primary/10 text-primary",
  HIGH:     "bg-amber-50 text-amber-700",
  WARNING:  "bg-amber-50 text-amber-700",
  BLOCKER:  "bg-destructive/10 text-destructive",
  CRITICAL: "bg-destructive/10 text-destructive",
  INFO:     "bg-primary/10 text-primary",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: SeverityLevel | string;
  className?: string;
}) {
  const key = (String(severity).toUpperCase() as SeverityLevel);
  const cls = SEVERITY_CLASS[key] ?? SEVERITY_CLASS.LOW;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap",
        cls,
        className,
      )}
    >
      {key}
    </span>
  );
}

// ---------------------------------------------------------------------------
// HealthBadge — for integration / system status (OPERATIONAL, DEGRADED,
// DOWN, OFF). Same geometry as StatusBadge; tone family is brand-blue OK
// + amber degraded + destructive down so a glance tells the on-call
// engineer the right thing.
// ---------------------------------------------------------------------------
export type HealthState = "OPERATIONAL" | "DEGRADED" | "DOWN" | "OFF" | "OK";

const HEALTH_CLASS: Record<HealthState, string> = {
  OPERATIONAL: "bg-primary/10 text-primary",
  OK:          "bg-primary/10 text-primary",
  DEGRADED:    "bg-amber-50 text-amber-700",
  DOWN:        "bg-destructive/10 text-destructive",
  OFF:         "bg-muted text-muted-foreground",
};

const HEALTH_DOT: Record<HealthState, string> = {
  OPERATIONAL: "bg-primary",
  OK:          "bg-primary",
  DEGRADED:    "bg-amber-500",
  DOWN:        "bg-destructive",
  OFF:         "bg-muted-foreground/50",
};

export function HealthBadge({
  state,
  className,
}: {
  state: HealthState | string;
  className?: string;
}) {
  const key = String(state).toUpperCase() as HealthState;
  const tint = HEALTH_CLASS[key] ?? HEALTH_CLASS.OFF;
  const dot = HEALTH_DOT[key] ?? HEALTH_DOT.OFF;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest whitespace-nowrap",
        tint,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />
      {key === "OK" ? "OPERATIONAL" : key}
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
