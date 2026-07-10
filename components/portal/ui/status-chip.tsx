import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// StatusChip — the single connection/integration status primitive.
//
// Before this, ~12 surfaces hand-rolled their own "connected" pill with
// disagreeing vocabularies and colors (ConnectHub text chip, integrations
// Pill with a BLUE "success", audiences RunPill ×3, MetaChip, FlagPill,
// launch badge, marketplace tile badges, the SEO grammars). That made "what
// does connected look like?" unanswerable — the #1 onboarding-trust failure
// in the audit.
//
// Rules baked in:
//   - LIVE is GREEN (#24a148), never blue. Blue is reserved for in-progress.
//   - One vocabulary: not_connected · connecting · live · stale · error ·
//     provisioning. Everything maps onto these six.
//   - Carbon-forward: flat, 2px, no dot-glow, mono-adjacent label.
//
// Usage:
//   <StatusChip status="live" />                       // "Live"
//   <StatusChip status="live" label="AppFolio · Live" />
//   <StatusChip status="connecting" />                 // "Connecting…"
//   <StatusChip status="not_connected" />              // "Not connected"
// ---------------------------------------------------------------------------

export type ConnectionStatus =
  | "not_connected"
  | "connecting"
  | "live"
  | "stale"
  | "error"
  | "provisioning";

type StatusSpec = {
  label: string;
  /** dot + text color */
  fg: string;
  /** chip background */
  bg: string;
  /** true → dot pulses (in-progress states) */
  pulse?: boolean;
};

// Carbon tokens. Live=Green 50, in-progress=Blue 60, error=Red 60,
// stale=Yellow 30 (dark text), neutral=Gray.
const SPEC: Record<ConnectionStatus, StatusSpec> = {
  not_connected: { label: "Not connected", fg: "#6f6f6f", bg: "#e8e8e8" },
  connecting: { label: "Connecting…", fg: "#0043ce", bg: "#edf5ff", pulse: true },
  provisioning: { label: "Provisioning…", fg: "#0043ce", bg: "#edf5ff", pulse: true },
  live: { label: "Live", fg: "#24a148", bg: "rgba(36,161,72,0.10)" },
  stale: { label: "Stale", fg: "#8a6d00", bg: "rgba(241,194,27,0.16)" },
  error: { label: "Error", fg: "#da1e28", bg: "rgba(218,30,40,0.10)" },
};

export function StatusChip({
  status,
  label,
  className,
}: {
  status: ConnectionStatus;
  /** Override the default label (e.g. "AppFolio · Live · 3,007 residents"). */
  label?: string;
  className?: string;
}) {
  const spec = SPEC[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] px-2 py-0.5",
        "text-[11px] font-semibold leading-[1.4] tracking-[0.01em]",
        className,
      )}
      style={{ color: spec.fg, background: spec.bg }}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", spec.pulse && "animate-pulse")}
        style={{ background: spec.fg }}
      />
      {label ?? spec.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// VerificationRow — the "prove it worked" line mounted after every OAuth /
// credential bind. Kills the systemic silent-success anti-pattern: an
// evaluator connecting AppFolio should immediately see
// "AppFolio · Live · 3,007 residents · synced 2:04 PM", not a blank return.
// ---------------------------------------------------------------------------

export function VerificationRow({
  status = "live",
  accountLabel,
  recordSummary,
  lastSyncAt,
  className,
}: {
  status?: ConnectionStatus;
  /** e.g. "AppFolio · sgrealestate" */
  accountLabel: string;
  /** e.g. "3,007 residents" — the concrete proof of a successful first sync. */
  recordSummary?: string;
  /** Human "synced 2:04 PM" string (format upstream to avoid hydration drift). */
  lastSyncAt?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--olive-gray)]",
        className,
      )}
    >
      <StatusChip status={status} />
      <span className="font-medium text-foreground">{accountLabel}</span>
      {recordSummary ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{recordSummary}</span>
        </>
      ) : null}
      {lastSyncAt ? (
        <>
          <span aria-hidden="true">·</span>
          <span>synced {lastSyncAt}</span>
        </>
      ) : null}
    </div>
  );
}
