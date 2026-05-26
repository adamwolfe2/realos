"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// MarketplaceSourceList — admin list of every configured MarketplaceSyncSource.
//
// Each row shows the source name, kind, lead counts, last-run summary, and
// a "Sync now" button that hits POST /api/admin/marketplace/sync-now with
// the sourceId — useful when you want to refresh a single segment without
// waiting for the weekly cron.
// ---------------------------------------------------------------------------

type RunSummary = {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  fetchedCount: number;
  upsertedCount: number;
  newCount: number;
  refreshedCount: number;
  expiredCount: number;
  failedCount: number;
  errorMessage: string | null;
  ago: string;
};

type Source = {
  id: string;
  name: string;
  kind: string;
  externalId: string;
  defaultPropertyType: string;
  defaultMarket: string | null;
  minScoreFloor: number;
  baselineScore: number;
  defaultPriceCents: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastIngestedCount: number;
  lastEnrichedCount: number;
  lastExpiredCount: number;
  leadCount: number;
  runs: RunSummary[];
};

export function MarketplaceSourceList({ sources }: { sources: Source[] }) {
  return (
    <ul className="space-y-3">
      {sources.map((s) => (
        <SourceRow key={s.id} source={s} />
      ))}
    </ul>
  );
}

function SourceRow({ source }: { source: Source }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/marketplace/sync-now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: source.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Sync failed");
        return;
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const lastRun = source.runs[0];

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-medium text-slate-900">
              {source.name}
            </span>
            {!source.enabled && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                Paused
              </span>
            )}
            <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
              {source.kind.replace("CURSIVE_", "")}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              {source.defaultPropertyType}
            </span>
          </div>
          <p className="mt-1 text-xs font-mono text-slate-500 break-all">
            {source.externalId}
          </p>
        </div>
        <button
          type="button"
          onClick={syncNow}
          disabled={syncing}
          className="px-3.5 py-1.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Pool size" value={source.leadCount.toLocaleString()} accent />
        <Tile
          label="Last fetched"
          value={source.lastIngestedCount.toLocaleString()}
        />
        <Tile
          label="Score floor"
          value={`${source.minScoreFloor} / ${source.baselineScore}`}
          hint="floor / baseline"
        />
        <Tile
          label="Base price"
          value={`$${(source.defaultPriceCents / 100).toFixed(0)}`}
        />
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {lastRun && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Recent runs
            </span>
            <RunStatus status={lastRun.status} />
          </div>
          <ul className="space-y-1.5">
            {source.runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-slate-500 font-mono">{r.ago}</span>
                <span className="text-slate-700">
                  {r.fetchedCount.toLocaleString()} fetched · {r.newCount.toLocaleString()} new · {r.refreshedCount.toLocaleString()} refreshed · {r.expiredCount.toLocaleString()} expired
                </span>
                <RunStatus status={r.status} small />
              </li>
            ))}
          </ul>
          {lastRun.errorMessage && (
            <p className="mt-2 text-xs text-red-600 font-mono">
              {lastRun.errorMessage}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Tile({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-medium ${accent ? "text-blue-600" : "text-slate-900"}`}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function RunStatus({ status, small = false }: { status: string; small?: boolean }) {
  const palette = (() => {
    switch (status) {
      case "SUCCESS":
        return { bg: "bg-emerald-50", border: "border-emerald-200", fg: "text-emerald-700" };
      case "RUNNING":
        return { bg: "bg-blue-50", border: "border-blue-200", fg: "text-blue-700" };
      case "FAILED":
        return { bg: "bg-red-50", border: "border-red-200", fg: "text-red-700" };
      default:
        return { bg: "bg-slate-100", border: "border-slate-200", fg: "text-slate-600" };
    }
  })();
  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wider border rounded ${palette.bg} ${palette.border} ${palette.fg}`}
      style={{
        fontSize: small ? "9px" : "10px",
        padding: small ? "1px 5px" : "2px 7px",
        letterSpacing: "0.1em",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}
