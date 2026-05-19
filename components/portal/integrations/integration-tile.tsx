"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";
import type { IntegrationState } from "@/lib/integrations/status";
import { IntegrationIcon } from "./integration-icon";

// Single marketplace tile. The full card is clickable; the state badge in
// the top-right and the "Manage"/"Connect"/"Request activation" CTA in the
// bottom-right tell the operator what'll happen when they click.

type StateStyle = {
  badgeLabel: string;
  badgeClass: string;
  cta: string;
  ctaClass: string;
};

const STATE_STYLES: Record<IntegrationState, StateStyle> = {
  connected: {
    badgeLabel: "Connected",
    badgeClass: "bg-primary/10 text-primary",
    cta: "Manage",
    ctaClass: "text-foreground hover:text-primary",
  },
  error: {
    // Connected, but the last sync attempt failed. Pre-fix this state
    // didn't exist — broken integrations rendered as green
    // "Connected" forever, and operators only discovered the failure
    // by clicking into the drawer (or noticing zero data on
    // dependent pages). Now the badge tells the truth.
    badgeLabel: "Sync error",
    badgeClass: "bg-rose-50 text-rose-700",
    cta: "Fix sync",
    ctaClass: "text-rose-700 hover:underline underline-offset-2",
  },
  stale: {
    // Connected with no errors, but the last successful sync is past the
    // freshness budget. Amber pill so operators see "data isn't current"
    // without being alarmed into thinking the integration is broken
    // (which is what a rose "Sync error" pill implies). Clicking the
    // tile lets them trigger a manual sync.
    badgeLabel: "Stale",
    badgeClass: "bg-amber-50 text-amber-800",
    cta: "Refresh",
    ctaClass: "text-amber-700 hover:underline underline-offset-2",
  },
  managed: {
    // 'managed' = on plan, awaiting agency provisioning. Was previously
    // labelled "Active" which lied — the integration wasn't actually
    // active yet, just provisioned. (audit BUG #1)
    badgeLabel: "Provisioning",
    badgeClass: "bg-amber-50 text-amber-800",
    cta: "View status",
    ctaClass: "text-foreground hover:text-primary",
  },
  plan_locked: {
    // New state when the org's plan doesn't include this module. Replaces
    // the previous mislabelled "Active" → "drawer says upgrade required"
    // dead-end so the badge tells the truth from the marketplace itself.
    badgeLabel: "Upgrade required",
    badgeClass: "bg-slate-100 text-slate-700",
    cta: "Talk to your AM",
    ctaClass: "text-primary hover:underline underline-offset-2",
  },
  available: {
    badgeLabel: "Available",
    badgeClass: "bg-slate-100 text-slate-700",
    cta: "Connect",
    ctaClass: "text-primary hover:underline underline-offset-2",
  },
  requested: {
    badgeLabel: "Requested",
    badgeClass: "bg-amber-50 text-amber-800",
    cta: "View request",
    ctaClass: "text-foreground hover:text-primary",
  },
  coming_soon: {
    badgeLabel: "Soon",
    badgeClass: "bg-slate-100 text-slate-500",
    cta: "Notify me",
    ctaClass: "text-muted-foreground",
  },
};

export function IntegrationTile({
  def,
  state,
  onOpen,
}: {
  def: IntegrationDefinition;
  state: IntegrationState;
  onOpen: (slug: string) => void;
}) {
  const style = STATE_STYLES[state];
  const disabled = state === "coming_soon";

  return (
    <button
      type="button"
      onClick={() => !disabled && onOpen(def.slug)}
      disabled={disabled}
      className={cn(
        "group text-left rounded-xl border border-border bg-card p-4 transition-all",
        "flex flex-col gap-3 min-h-[150px]",
        !disabled && "hover:border-foreground/20 hover:bg-accent/30 cursor-pointer",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <IntegrationIcon def={def} />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap",
            style.badgeClass,
          )}
        >
          {style.badgeLabel}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {def.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {def.tagline}
        </p>
      </div>

      <div className="flex items-center justify-end pt-1 -mb-0.5">
        <span
          className={cn(
            "text-[12px] font-medium inline-flex items-center gap-1",
            style.ctaClass,
          )}
        >
          {style.cta}
          <span aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform">
            →
          </span>
        </span>
      </div>
    </button>
  );
}
