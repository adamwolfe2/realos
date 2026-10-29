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
//   - Coloured dot + navy label, no filled background (premium restraint).
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
  /** dot color; the label stays navy so status reads calm */
  fg: string;
  /** true → dot pulses (in-progress states) */
  pulse?: boolean;
};

// Carbon tokens. Live=Green 50, in-progress=Blue 60, error=Red 60,
// stale=Yellow 30 (dark text), neutral=Gray.
const SPEC: Record<ConnectionStatus, StatusSpec> = {
  not_connected: { label: "Not connected", fg: "#94a0b8" },
  connecting: { label: "Connecting…", fg: "#0043ce", pulse: true },
  provisioning: { label: "Provisioning…", fg: "#0043ce", pulse: true },
  live: { label: "Live", fg: "#198038" },
  stale: { label: "Stale", fg: "#8a6d00" },
  error: { label: "Error", fg: "#da1e28" },
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
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        "text-[12px] font-medium leading-[1.4]",
        className,
      )}
      style={{ color: "var(--t-text, #36415c)" }}
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
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--gray-70)]",
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
