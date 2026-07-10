import * as React from "react";
import { ShieldCheck, Lock, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/components/portal/ui/status-chip";

// ---------------------------------------------------------------------------
// TrustFooter — the shared trust strip for every credential / OAuth drawer.
//
// Wording is verified claim-by-claim against code (2026-07-09 connect-hub
// spec): AES-256-GCM at rest in lib/crypto.ts; disconnect affordances exist
// for every connected account under Settings → Integrations.
//
// The middle line is a per-surface `scopeNote` — NOT a blanket "read-only
// scopes" claim. Google Ads (`adwords`) and Meta (`ads_read` +
// `ads_management`) are write-capable scopes, so ads drawers must pass their
// honest scope wording (see connect-hub.tsx SCOPE_NOTES) and write-path
// integrations (Funnel) pass none. Do not re-broaden this into "read-only".
// ---------------------------------------------------------------------------

export function TrustFooter({
  scopeNote,
  className,
}: {
  /** Honest per-surface access note. Omit when no read-only-style claim is
      verifiable for the surface (the line is skipped entirely). */
  scopeNote?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-t border-[#e0e0e0] pt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#525252]",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
        Credentials encrypted at rest (AES-256)
      </span>
      {scopeNote ? (
        <span className="inline-flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          {scopeNote}
        </span>
      ) : null}
      <span className="inline-flex items-center gap-1.5">
        <Unplug className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
        Disconnect anytime in Settings → Integrations
      </span>
    </div>
  );
}

/**
 * PrerequisiteLine — the "what you'll need · how long" line rendered at the
 * top of every connect drawer, mirroring the hub cards' prerequisite copy.
 */
export function PrerequisiteLine({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-[11px] text-[#525252] leading-snug", className)}>
      {children}
    </p>
  );
}

/**
 * deriveSyncChip — shared status ladder for connected-integration manage
 * rows. Same vocabulary as the Connect hub: error beats everything, a bound
 * source that has never synced is honestly "Connected — first sync running"
 * (not a silent blank), then live/stale by age.
 */
export function deriveSyncChip({
  lastSyncAt,
  error,
  staleAfterHours = 48,
}: {
  lastSyncAt: Date | string | null;
  error?: string | null;
  staleAfterHours?: number;
}): { status: ConnectionStatus; label?: string } {
  if (error) {
    return { status: "error" };
  }
  if (!lastSyncAt) {
    return { status: "connecting", label: "Connected — first sync running" };
  }
  const ageHours =
    (Date.now() - new Date(lastSyncAt).getTime()) / 3_600_000;
  if (ageHours > staleAfterHours) {
    return { status: "stale" };
  }
  return { status: "live" };
}
