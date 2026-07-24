import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  StatusChip,
  type ConnectionStatus,
} from "@/components/portal/ui/status-chip";
import { RunSyncButton } from "@/components/admin/run-sync-button";
import type { DataSinkSummary, SinkStatus } from "@/lib/admin/data-sinks";

// ---------------------------------------------------------------------------
// SyncHealthTable — ONE consolidated table replacing the 10-card "Data
// sinks" grid on the client detail page. Same underlying DataSinkSummary[]
// as components/admin/data-sinks-board.tsx (unchanged, still used on
// /admin/system) — this is a table-shaped presentation of the identical
// data, scoped to a single tenant, using the StatusChip vocabulary instead
// of the board's bespoke pill classes so this page reads consistently with
// the rest of the Carbon-kit surfaces.
//
// Status translation (jargon → plain English):
//   DEAD / erroring → "Failing"     (error chip)
//   NEVER RUN       → "Not started" (neutral chip)
//   STALE           → "Stale"       (warning chip)
//   FRESH           → "Healthy"     (success/live chip)
// ---------------------------------------------------------------------------

const CHIP_BY_STATUS: Record<
  SinkStatus,
  { status: ConnectionStatus; label: string }
> = {
  fresh: { status: "live", label: "Healthy" },
  stale: { status: "stale", label: "Stale" },
  erroring: { status: "error", label: "Failing" },
  dead: { status: "error", label: "Failing" },
  missing: { status: "not_connected", label: "Not started" },
};

const SORT_ORDER: Record<SinkStatus, number> = {
  dead: 0,
  erroring: 1,
  missing: 2,
  stale: 3,
  fresh: 4,
};

export function SyncHealthTable({
  sinks,
  orgId,
}: {
  sinks: DataSinkSummary[];
  orgId: string;
}) {
  if (sinks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No data connections configured for this client.
      </p>
    );
  }

  // Failing/never-started rows bubble to the top so the operator's eye
  // lands on what needs attention first — same ordering the old card grid
  // used.
  const sorted = [...sinks].sort(
    (a, b) =>
      SORT_ORDER[a.status] - SORT_ORDER[b.status] ||
      a.label.localeCompare(b.label),
  );

  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full ls-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Last run</th>
            <th>Runs 24h</th>
            <th>Errors 24h</th>
            <th>Rows</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((sink) => {
            const chip = CHIP_BY_STATUS[sink.status];
            return (
              <tr key={sink.provider}>
                <td>
                  <div className="font-medium text-foreground">
                    {sink.label}
                  </div>
                  {sink.lastErrorMessage ? (
                    <div className="text-[11px] text-destructive mt-0.5 line-clamp-1 max-w-[260px]">
                      {sink.lastErrorMessage}
                    </div>
                  ) : null}
                </td>
                <td>
                  <StatusChip status={chip.status} label={chip.label} />
                </td>
                <td className="tabular-nums text-muted-foreground whitespace-nowrap">
                  {sink.lastRunAt
                    ? formatDistanceToNow(sink.lastRunAt, { addSuffix: true })
                    : "Never"}
                </td>
                <td className="tabular-nums">{sink.runsLast24h}</td>
                <td
                  className={cn(
                    "tabular-nums",
                    sink.errorsLast24h > 0
                      ? "text-destructive font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {sink.errorsLast24h}
                </td>
                <td className="tabular-nums text-muted-foreground">
                  {sink.rowsLast24h ?? "—"}
                </td>
                <td className="text-right">
                  <div className="inline-flex">
                    <RunSyncButton
                      provider={sink.provider}
                      cronJobName={sink.cronJobName}
                      scope="tenant"
                      orgId={orgId}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
