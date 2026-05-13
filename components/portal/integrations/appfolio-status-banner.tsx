import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Plug,
} from "lucide-react";
import type { AppFolioStatus } from "@/lib/integrations/appfolio-status";
import { RunAppFolioSyncButton } from "./run-appfolio-sync-button";
import { StaleOnLoadTrigger } from "@/components/portal/sync/stale-on-load-trigger";
import { AppFolioSyncPoller } from "./appfolio-sync-poller";
import { classifyFreshness } from "@/lib/sync/freshness";

// ---------------------------------------------------------------------------
// AppFolioStatusBanner — honest disclosure of the current AppFolio sync state
// at the top of every operations page (residents / renewals / work-orders).
// Distinguishes the four states that previously all looked like "no data"
// to operators:
//
//   not_connected → "Connect AppFolio to mirror residents…" + CTA
//   never_synced  → "Credentials saved. First sync hasn't run yet." + Run sync
//   syncing       → "Sync in progress."
//   synced        → "Last sync 5 min ago." (+ stale warning if > 24h)
//   failed        → Surfaces the error message + Run sync to retry
//
// Always emphasizes that AppFolio remains the source of truth. Never claims
// LeaseStack manages the underlying records.
// ---------------------------------------------------------------------------

type Tone = "info" | "ok" | "warn" | "error" | "muted";

const TONES: Record<Tone, string> = {
  info: "border-primary/30 bg-primary/10 text-primary",
  ok: "border-primary/30 bg-primary/10 text-primary",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted/30 text-foreground",
};

export function AppFolioStatusBanner({
  status,
  resourceLabel,
  orgId,
}: {
  status: AppFolioStatus;
  /** Plural noun for the resource displayed on the page (e.g. "residents"). */
  resourceLabel: string;
  /**
   * Tenant org id. When provided, enables the stale-on-load auto-sync
   * trigger so opening the page on stale data fires a background refresh
   * exactly once per tab session. Omit (or pass undefined) to disable.
   */
  orgId?: string;
}) {
  // Decide whether to drop in a StaleOnLoadTrigger. Skip when not
  // connected, syncing, or actively failing — auto-firing those just
  // burns invocations on a known-broken integration.
  const freshness = classifyFreshness("appfolio", status.lastSyncAt, {
    syncInProgress: status.state === "syncing",
    hasError: status.state === "failed",
  });
  const autoTrigger =
    orgId && (status.state === "synced" || status.state === "never_synced") &&
    freshness.shouldAutoTrigger;

  if (status.state === "not_connected") {
    return (
      <Banner
        tone="muted"
        icon={<Plug className="h-4 w-4" />}
        title={`Connect AppFolio to mirror ${resourceLabel}.`}
        body={`AppFolio remains your source of truth. Once connected, LeaseStack pulls ${resourceLabel} on an hourly schedule so you never have to leave AppFolio for routine reporting.`}
        action={
          <Link
            href="/portal/settings/integrations"
            className="inline-flex items-center rounded-md bg-primary text-primary-foreground hover:bg-primary-dark transition-colors px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Connect AppFolio
          </Link>
        }
      />
    );
  }

  if (status.state === "never_synced") {
    return (
      <>
        {orgId ? (
          <StaleOnLoadTrigger
            endpoint="/api/tenant/appfolio/sync"
            dedupeKey={`appfolio:${orgId}`}
          />
        ) : null}
        <Banner
          tone="info"
          icon={<CircleDashed className="h-4 w-4 animate-pulse" />}
          title="AppFolio is connected. Pulling first sync…"
          body={
            status.subdomain
              ? `Credentials saved for ${status.subdomain}.appfolio.com. Initial backfill running — ${resourceLabel} will appear shortly.`
              : `Credentials saved. Initial backfill running — ${resourceLabel} will appear shortly.`
          }
          action={<RunAppFolioSyncButton />}
        />
      </>
    );
  }

  if (status.state === "syncing") {
    // Active poller — checks every 5s and auto-refreshes the page when
    // the sync finishes. Now passes the real syncStartedAt timestamp
    // from the integration row so elapsed time persists across page
    // navigations (a previous local-only counter reset on every mount
    // and read like the sync had restarted).
    return (
      <AppFolioSyncPoller
        startedAt={status.syncStartedAt ? status.syncStartedAt.toISOString() : null}
      />
    );
  }

  if (status.state === "failed") {
    // Honest disclosure of the safe-fallback behavior: when a sync
    // fails we keep rendering whatever was last persisted to the DB
    // rather than blanking the page. Operators used to see "sync
    // failed" next to live-looking lease data and assume the numbers
    // were current — the line below makes the staleness explicit.
    //
    // We don't have a dedicated `lastSuccessfulSyncAt` column today;
    // `lastSyncAt` reflects the most recent attempt regardless of
    // outcome. We surface it here as "data was last refreshed before
    // this failure" — accurate as long as failures don't wipe rows
    // (which they don't; the sync writer is upsert-only).
    const fallbackPhrase = status.lastSyncAt
      ? `Showing the snapshot from before this failure (last refresh ${formatDistanceToNow(
          status.lastSyncAt,
          { addSuffix: true },
        )}).`
      : `No prior sync ever succeeded — ${resourceLabel} are not yet available.`;
    return (
      <Banner
        tone="error"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Most recent AppFolio sync failed."
        body={`${truncate(status.lastError ?? "Unknown error.", 200)} ${fallbackPhrase}`}
        meta={
          status.lastSyncAt
            ? `Last attempt ${formatDistanceToNow(status.lastSyncAt, {
                addSuffix: true,
              })}.`
            : undefined
        }
        action={<RunAppFolioSyncButton label="Retry sync" />}
      />
    );
  }

  // synced
  if (status.stale) {
    return (
      <>
        {autoTrigger ? (
          <StaleOnLoadTrigger
            endpoint="/api/tenant/appfolio/sync"
            dedupeKey={`appfolio:${orgId}`}
          />
        ) : null}
        <Banner
          tone="warn"
          icon={<Clock className="h-4 w-4 animate-pulse" />}
          title="Refreshing AppFolio data…"
          body={`Last sync ${formatDistanceToNow(status.lastSyncAt!, {
            addSuffix: true,
          })}. Auto-refresh kicked off — newer ${resourceLabel} will load momentarily.`}
          action={<RunAppFolioSyncButton />}
        />
      </>
    );
  }

  // Synced. Build the count summary from persisted stats so the operator
  // sees what was actually pulled — distinguishes "we synced 0 residents
  // because AppFolio is empty" from "we synced 0 residents because the
  // residents endpoint failed silently".
  const statsSummary = status.stats
    ? formatPulledCounts(status.stats)
    : null;
  const warnings = status.stats?.warnings ?? [];
  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-2">
      <Banner
        tone={hasWarnings ? "warn" : "ok"}
        icon={
          hasWarnings ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )
        }
        title={`Synced from AppFolio · ${formatDistanceToNow(
          status.lastSyncAt!,
          { addSuffix: true }
        )}`}
        body={
          statsSummary
            ? `${statsSummary} AppFolio remains the source of truth.`
            : `AppFolio remains the source of truth for ${resourceLabel}. This view is read-only.`
        }
        action={<RunAppFolioSyncButton label="Sync now" subtle />}
      />
      {hasWarnings ? (
        <details className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-900">
          <summary className="cursor-pointer font-semibold">
            {warnings.length} sync warning{warnings.length === 1 ? "" : "s"}
            {" · "}
            <span className="font-normal opacity-80">
              click to inspect
            </span>
          </summary>
          <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto pl-4 list-disc">
            {warnings.slice(0, 25).map((w, i) => (
              <li key={i} className="break-all">{w}</li>
            ))}
            {warnings.length > 25 ? (
              <li className="opacity-60">+{warnings.length - 25} more…</li>
            ) : null}
          </ul>
          <p className="mt-2 text-[11px] opacity-75">
            Warnings often mean an AppFolio plan limitation (Core can&apos;t
            access REST reports) or a permissions gap on the credentials.
          </p>
        </details>
      ) : null}
    </div>
  );
}

// Turn the persisted stats counts into a one-line summary phrase. Skips
// zeros so the line stays readable.
function formatPulledCounts(stats: NonNullable<AppFolioStatus["stats"]>): string {
  const parts: string[] = [];
  const push = (n: number, label: string) => {
    if (n > 0) parts.push(`${n.toLocaleString()} ${label}`);
  };
  push(stats.residentsUpserted, "residents");
  push(stats.leasesUpserted, "leases");
  push(stats.workOrdersUpserted, "work orders");
  push(stats.listingsUpserted, "listings");
  push(stats.delinquenciesUpdated, "delinquency rows");
  if (parts.length === 0) {
    return "Last sync pulled 0 rows from AppFolio.";
  }
  return `Last sync pulled ${parts.join(" · ")}.`;
}

function truncate(input: string, max: number): string {
  const s = input.trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function Banner({
  tone,
  icon,
  title,
  body,
  meta,
  action,
}: {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  body?: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-start gap-3 flex-wrap md:flex-nowrap ${TONES[tone]}`}
      role="status"
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        {body ? (
          <p className="text-xs mt-1 opacity-90 leading-snug">{body}</p>
        ) : null}
        {meta ? (
          <p className="text-[11px] mt-1 opacity-70">{meta}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
