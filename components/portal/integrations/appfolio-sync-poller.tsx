"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, AlertTriangle } from "lucide-react";

// ---------------------------------------------------------------------------
// AppFolioSyncPoller — replaces the static "Sync in progress" banner with
// an active poller that:
//
//   1. Hits GET /api/tenant/appfolio every POLL_INTERVAL_MS while the
//      integration is in `syncStatus === "syncing"`.
//   2. Shows live elapsed time so the operator sees the sync hasn't stalled.
//   3. When status flips to idle/error, calls router.refresh() so the
//      banner + page data switch to the post-sync state in the same render.
//   4. Hard-stops after MAX_POLL_DURATION_MS to avoid infinite background
//      requests if the sync row gets stuck (the server-side cron will
//      auto-clear the stuck flag within 15 min anyway).
//
// Cost: one cheap DB read per 5s while a sync is mid-flight, only on
// pages an operator is actively watching. Naturally rate-limited; nobody
// pays for polling on a tab nobody opened.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 5 * 60_000;

// Compact one-line summary of which AppFolio entities the sync touched.
// Skips zero-count rows so the line stays scannable on small banners.
function formatStatsSummary(stats: SyncStats): string {
  const parts: string[] = [];
  const push = (n: number | undefined, label: string) => {
    if (n != null && n > 0) parts.push(`${n.toLocaleString()} ${label}`);
  };
  push(stats.residentsUpserted, "residents");
  push(stats.leasesUpserted, "leases");
  push(stats.workOrdersUpserted, "work orders");
  push(stats.listingsUpserted, "listings");
  push(stats.propertiesUpserted, "properties");
  push(stats.delinquenciesUpdated, "delinquency rows");
  if (parts.length === 0) {
    // 0 rows pulled across every phase — most likely either a permission
    // issue (Core plan can't access REST reports) or a genuinely empty
    // AppFolio account. Be honest about it.
    return "Sync ran but pulled 0 rows. Check warnings or AppFolio plan tier.";
  }
  return `Pulled ${parts.join(" · ")}.`;
}

type Status = "idle" | "syncing" | "error";

type SyncStats = {
  residentsUpserted?: number;
  leasesUpserted?: number;
  workOrdersUpserted?: number;
  listingsUpserted?: number;
  propertiesUpserted?: number;
  delinquenciesUpdated?: number;
  warnings?: string[];
  phasesCompleted?: number;
  totalPhases?: number;
};

type SyncStatePayload = {
  syncStatus: Status | string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  lastSyncStats?: SyncStats | null;
} | null;

export function AppFolioSyncPoller({
  startedAt,
}: {
  /** ISO date when the current sync row entered the "syncing" state. */
  startedAt: string | null;
}) {
  const router = useRouter();
  const [elapsedSec, setElapsedSec] = useState(() =>
    startedAt ? Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0
  );
  const [done, setDone] = useState<null | "ok" | "error">(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const stopAt = useRef(Date.now() + MAX_POLL_DURATION_MS);

  // Local elapsed-time ticker — independent of the network poll so the
  // operator sees seconds tick up smoothly even on a slow API response.
  useEffect(() => {
    const tick = setInterval(() => {
      if (startedAt) {
        setElapsedSec(
          Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))
        );
      } else {
        setElapsedSec((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [startedAt]);

  // Network poll — checks the integration row every 5s.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (cancelled) return;
      if (Date.now() > stopAt.current) return; // give up after 5 min
      try {
        const res = await fetch("/api/tenant/appfolio", { cache: "no-store" });
        if (!res.ok) {
          // Transient network error — keep polling, don't claim failure.
          timer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        const json = (await res.json()) as { integration: SyncStatePayload };
        const integ = json.integration;
        const status = (integ?.syncStatus ?? "").toLowerCase();
        if (status === "syncing") {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        // Sync completed (status === "idle" or "error"). Capture stats
        // first so the success banner can show what was actually pulled
        // — then schedule a refresh so the page data updates beneath it.
        if (integ?.lastSyncStats) {
          setStats(integ.lastSyncStats);
        }
        if (integ?.lastError) {
          setDone("error");
          setErrorMsg(integ.lastError);
        } else {
          setDone("ok");
        }
        // Slightly longer delay on success so the operator has a beat to
        // read the count summary before the page refresh swaps the
        // banner out for the synced state.
        setTimeout(() => {
          if (!cancelled) router.refresh();
        }, 2500);
      } catch {
        // Same as transient error — keep polling.
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  if (done === "ok") {
    const summary = stats ? formatStatsSummary(stats) : null;
    const warnings = stats?.warnings ?? [];
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            AppFolio sync complete.
          </p>
          {summary ? (
            <p className="text-xs mt-1 opacity-90">{summary}</p>
          ) : (
            <p className="text-xs mt-1 opacity-90">Loading fresh data…</p>
          )}
          {warnings.length > 0 ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-semibold">
                {warnings.length} warning{warnings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto pl-4 list-disc">
                {warnings.slice(0, 10).map((w, i) => (
                  <li key={i} className="break-all">{w}</li>
                ))}
                {warnings.length > 10 ? (
                  <li className="opacity-60">+{warnings.length - 10} more…</li>
                ) : null}
              </ul>
            </details>
          ) : null}
        </div>
      </div>
    );
  }

  if (done === "error") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            AppFolio sync failed.
          </p>
          <p className="text-xs mt-1 opacity-90 break-words">
            {errorMsg ?? "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // Still syncing — show elapsed time + cadence guidance so the operator
  // knows roughly when it should finish.
  const niceTime =
    elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900"
    >
      <Clock className="h-4 w-4 mt-0.5 shrink-0 animate-pulse" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">
          AppFolio sync running… {niceTime}
        </p>
        <p className="text-xs mt-1 opacity-90 leading-snug">
          First sync pulls 90 days of residents, leases, work orders, and
          rent roll. Typical: 30–90 seconds. The page refreshes
          automatically when it finishes — no need to reload.
        </p>
      </div>
    </div>
  );
}
