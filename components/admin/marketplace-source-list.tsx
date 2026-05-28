"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2 } from "lucide-react";

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
  requireFullEnrichment?: boolean;
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

  // Delta between current pool size and what the LAST sync upserted —
  // surfaces "leads disappeared" cases like the one Adam hit on May 26.
  // Negative delta = current pool smaller than last successful run's
  // upsertedCount, which usually means something nuked rows.
  const lastSuccessful = source.runs.find((r) => r.status === "SUCCESS");
  const expectedFloor = lastSuccessful?.upsertedCount ?? 0;
  const poolDelta = source.leadCount - expectedFloor;
  const showAlert = expectedFloor > 0 && source.leadCount < expectedFloor * 0.5;

  // Recency string for the header.
  const lastSyncAgo = lastRun?.ago ?? null;

  return (
    <li className="bg-white border border-slate-200 rounded-xl p-5">
      {showAlert ? (
        <div className="mb-4 -mt-1 flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs leading-relaxed">
          <AlertTriangle aria-hidden="true" className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-amber-800">
            <strong className="font-semibold">Pool dropped sharply.</strong>{" "}
            Last sync upserted {expectedFloor.toLocaleString()} leads but the
            current pool is {source.leadCount.toLocaleString()}{" "}
            ({poolDelta > 0 ? "+" : ""}{poolDelta.toLocaleString()}). If
            this wasn't expected, click <strong>Sync now</strong> to
            re-pull from upstream.
          </div>
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-medium text-slate-900">
              {source.name}
            </span>
            {lastSyncAgo ? (
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                last sync · {lastSyncAgo}
              </span>
            ) : (
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                never synced
              </span>
            )}
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
            {source.requireFullEnrichment && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                Premium · all fields
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-mono text-slate-500 break-all">
            {source.externalId}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ToggleEnrichmentButton source={source} />
          {/* Sync now: primary action — re-pulls upstream + repopulates
              leads. The "where did my leads go?" recovery path. */}
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <DeleteSourceButton sourceId={source.id} sourceName={source.name} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* Surface the "fetched but nothing landed" case, which almost always
          means the strict enrichment gate dropped every member because the
          source segment doesn't have all 12 required fields populated
          per-member. Operator can disable the gate to validate, or accept
          the trade-off. */}
      {source.requireFullEnrichment &&
        lastRun &&
        lastRun.fetchedCount > 0 &&
        lastRun.newCount === 0 &&
        lastRun.refreshedCount === 0 && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs leading-relaxed">
            <p className="font-semibold text-amber-800">
              Sync ran but 0 leads passed the strict enrichment gate.
            </p>
            <p className="text-amber-700 mt-1">
              Every fetched member is missing at least one of the 12
              required fields (firstName, lastName, email, phone, city,
              companyName, companyState, businessEmail, mobilePhone,
              linkedinUrl, incomeRange, gender). Either edit the source
              and uncheck <span className="font-mono">Premium · require
              full enrichment</span> to accept partially-enriched leads,
              or use a different upstream segment with denser per-member
              data.
            </p>
          </div>
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
                  {r.failedCount > 0 && (
                    <>
                      {" · "}
                      <span className="text-amber-700 font-medium">
                        {r.failedCount.toLocaleString()} dropped
                      </span>
                    </>
                  )}
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

function ToggleEnrichmentButton({ source }: { source: Source }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = !!source.requireFullEnrichment;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/marketplace/sources/${source.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requireFullEnrichment: !active }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={
        active
          ? "Currently: only ingest fully-enriched leads. Click to allow partial leads."
          : "Currently: ingest any verified lead. Click to require all 12 fields."
      }
      className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider font-bold border disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? "text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
          : "text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100"
      }`}
    >
      {busy ? "..." : active ? "Premium · ON" : "Premium · off"}
    </button>
  );
}

function DeleteSourceButton({
  sourceId,
  sourceName,
}: {
  sourceId: string;
  sourceName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !confirm(
        `Delete source "${sourceName}" and all of its leads + runs? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await fetch(`/api/admin/marketplace/sources/${sourceId}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      title="Delete source"
      className="px-2 py-1.5 rounded-md border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? "..." : <Trash2 className="w-4 h-4" strokeWidth={1.5} />}
    </button>
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
