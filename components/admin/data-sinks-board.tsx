import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  LineChart,
  Search,
  Megaphone,
  Globe,
  Brain,
  Star,
  Radio,
  Crosshair,
} from "lucide-react";
import type { ComponentType } from "react";
import type {
  DataSinkSummary,
  SinkProvider,
  SinkStatus,
} from "@/lib/admin/data-sinks";
import { RunSyncButton } from "./run-sync-button";

// ---------------------------------------------------------------------------
// DataSinksBoard — single-pane-of-glass for every data sync. Renders one
// card per sink with a freshness pill, 24h throughput stats, and a
// "Run sync now" button that POSTs to /api/admin/data-sinks/[provider]/run.
//
// Design rules:
//   - Match app/admin/system/page.tsx visual language (rounded-lg, border,
//     bg-card, semantic color tones — no emoji).
//   - Status pill tones mirror the system page (fresh = primary, stale =
//     muted, erroring/dead = destructive).
//   - Long error messages clamp to 2 lines so the grid stays tidy.
//   - The "Run sync now" form posts to a server route which fires the cron
//     URL behind a CRON_SECRET header — the operator clicks once and the
//     cron runs the same way it does on schedule.
// ---------------------------------------------------------------------------

type Props = {
  sinks: DataSinkSummary[];
  scope: "platform" | "tenant";
  orgId?: string;
};

const ICON_BY_PROVIDER: Record<
  SinkProvider,
  ComponentType<{ className?: string }>
> = {
  appfolio: Building2,
  ga4: LineChart,
  gsc: Search,
  google_ads: Megaphone,
  meta_ads: Megaphone,
  dataforseo: Globe,
  aeo: Brain,
  reputation: Star,
  cursive_pixel: Radio,
  site_intelligence: Crosshair,
};

const STATUS_TONE: Record<SinkStatus, string> = {
  fresh: "bg-primary/5 text-primary border-primary/30",
  stale: "bg-secondary text-foreground border-border",
  erroring: "bg-secondary text-destructive border-destructive/30",
  // dead = the same red pill but with a slow pulse so the operator sees
  // it cross-room. Reserved for sinks that haven't succeeded in 7d or
  // have 3+ consecutive failed runs.
  dead: "bg-secondary text-destructive border-destructive/30 animate-pulse",
  missing: "bg-secondary text-muted-foreground border-border",
};

const STATUS_LABEL: Record<SinkStatus, string> = {
  fresh: "Fresh",
  stale: "Stale",
  erroring: "Erroring",
  dead: "Dead",
  missing: "Never run",
};

export function DataSinksBoard({ sinks, scope, orgId }: Props) {
  if (sinks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No data sinks configured.
      </div>
    );
  }

  // Sort so failing/missing sinks bubble to the top — the operator's eye
  // lands on what needs attention first.
  const order: Record<SinkStatus, number> = {
    dead: 0,
    erroring: 1,
    missing: 2,
    stale: 3,
    fresh: 4,
  };
  const sorted = [...sinks].sort((a, b) => {
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sorted.map((sink) => (
        <SinkCard key={sink.provider} sink={sink} scope={scope} orgId={orgId} />
      ))}
    </div>
  );
}

function SinkCard({
  sink,
  scope,
  orgId,
}: {
  sink: DataSinkSummary;
  scope: "platform" | "tenant";
  orgId?: string;
}) {
  const Icon = ICON_BY_PROVIDER[sink.provider];
  const lastRunLabel = sink.lastRunAt
    ? formatDistanceToNow(sink.lastRunAt, { addSuffix: true })
    : "never";
  const lastSuccessLabel = sink.lastSuccessAt
    ? formatDistanceToNow(sink.lastSuccessAt, { addSuffix: true })
    : null;
  const sameRunAndSuccess =
    sink.lastSuccessAt &&
    sink.lastRunAt &&
    sink.lastSuccessAt.getTime() === sink.lastRunAt.getTime();

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="text-sm font-medium text-foreground truncate">
            {sink.label}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest font-medium border rounded-full px-2 py-0.5 whitespace-nowrap ${STATUS_TONE[sink.status]}`}
        >
          {STATUS_LABEL[sink.status]}
        </span>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span>Last run</span>
          <span className="tabular-nums text-foreground">{lastRunLabel}</span>
        </div>
        {lastSuccessLabel && !sameRunAndSuccess ? (
          <div className="flex items-center justify-between gap-2">
            <span>Last success</span>
            <span className="tabular-nums text-foreground">
              {lastSuccessLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="text-[11px] text-muted-foreground tabular-nums">
        runs 24h: <span className="text-foreground">{sink.runsLast24h}</span>
        {" · "}errors:{" "}
        <span
          className={
            sink.errorsLast24h > 0
              ? "text-destructive"
              : "text-foreground"
          }
        >
          {sink.errorsLast24h}
        </span>
        {sink.rowsLast24h != null ? (
          <>
            {" · "}rows:{" "}
            <span className="text-foreground">{sink.rowsLast24h}</span>
          </>
        ) : null}
      </div>

      {sink.tenantsCovered != null ? (
        <div className="text-[11px]">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-2 py-0.5 text-muted-foreground">
            {sink.tenantsCovered} tenant{sink.tenantsCovered === 1 ? "" : "s"}{" "}
            covered
          </span>
        </div>
      ) : null}

      {sink.lastErrorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-secondary p-2 text-[11px] text-destructive">
          <div className="line-clamp-2 break-words">
            {sink.lastErrorMessage}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            View details
          </div>
        </div>
      ) : null}

      <div className="mt-auto pt-1">
        <RunSyncButton
          provider={sink.provider}
          cronJobName={sink.cronJobName}
          scope={scope}
          orgId={orgId}
        />
      </div>
    </div>
  );
}
