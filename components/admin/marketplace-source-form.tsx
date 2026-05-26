"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// MarketplaceSourceForm — admin form to register a new MarketplaceSyncSource.
//
// On submit, hits POST /api/admin/marketplace/sources with runImmediately=true
// so the operator sees an immediate sync result. The page refreshes on
// success so the new source shows up in the list below.
// ---------------------------------------------------------------------------

type PropertyType = "RENTAL" | "SALE" | "INVESTMENT" | "COMMERCIAL";
type SourceKind = "CURSIVE_SEGMENT" | "CURSIVE_AUDIENCE";

type SyncSummary = {
  status?: string;
  fetchedCount?: number;
  upsertedCount?: number;
  newCount?: number;
  refreshedCount?: number;
  expiredCount?: number;
  failedCount?: number;
  errorMessage?: string;
  // Background-sync mode response
  backgroundStarted?: boolean;
  note?: string;
};

export function MarketplaceSourceForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncSummary | null>(null);

  const [name, setName] = useState("Real Estate · Fully enriched");
  const [kind, setKind] = useState<SourceKind>("CURSIVE_AUDIENCE");
  const [externalId, setExternalId] = useState("");
  const [defaultPropertyType, setDefaultPropertyType] = useState<PropertyType>("SALE");
  const [defaultMarket, setDefaultMarket] = useState("United States");
  const [minScoreFloor, setMinScoreFloor] = useState(60);
  const [baselineScore, setBaselineScore] = useState(80);
  const [defaultPriceCents, setDefaultPriceCents] = useState(7500);
  const [requireFullEnrichment, setRequireFullEnrichment] = useState(false);
  const [runImmediately, setRunImmediately] = useState(true);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/marketplace/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          externalId,
          defaultPropertyType,
          defaultMarket: defaultMarket || null,
          minScoreFloor,
          baselineScore,
          defaultPriceCents,
          requireFullEnrichment,
          runImmediately,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not create source");
        return;
      }
      // Source was created. If the user opted into immediate sync, the
      // server fired it in the background via after() and returned with
      // syncStarted=true + a note. Show that as the "result tile" until
      // the run actually completes (operator refreshes to see counts).
      if (data.syncStarted) {
        setResult({
          backgroundStarted: true,
          note:
            data.note ??
            "Sync running in background. Refresh in 1-3 minutes to see results.",
        });
      } else {
        setResult(data.syncSummary ?? null);
      }
      // Soft refresh so the new source appears in the list below
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Source name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            placeholder="Real Estate · High-intent buyers"
            required
          />
        </Field>
        <Field label="Cursive kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SourceKind)}
            className="form-input"
          >
            <option value="CURSIVE_AUDIENCE">Cursive Audience (UUID)</option>
            <option value="CURSIVE_SEGMENT">Cursive Segment (Studio)</option>
          </select>
        </Field>
      </div>

      <Field label="Cursive ID (audience or segment)">
        <div className="flex gap-2">
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            className="form-input font-mono text-xs flex-1"
            placeholder="ba8c9817-f91c-4955-b2b0-53b933a15f7d"
            required
          />
          <DiagnoseButton externalId={externalId} onResult={setDiagnosis} />
        </div>
        {diagnosis && <DiagnosisDisplay diagnosis={diagnosis} />}
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Default property type">
          <select
            value={defaultPropertyType}
            onChange={(e) => setDefaultPropertyType(e.target.value as PropertyType)}
            className="form-input"
          >
            <option value="SALE">Sale</option>
            <option value="RENTAL">Rental</option>
            <option value="INVESTMENT">Investment</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </Field>
        <Field label="Default market (when no city)">
          <input
            value={defaultMarket}
            onChange={(e) => setDefaultMarket(e.target.value)}
            className="form-input"
            placeholder="United States"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label={`Score floor (${minScoreFloor})`}
          hint="Below this → flipped to EXPIRED"
        >
          <input
            type="range"
            min={0}
            max={100}
            value={minScoreFloor}
            onChange={(e) => setMinScoreFloor(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
        <Field
          label={`Baseline score (${baselineScore})`}
          hint="Minimum score for any verified member"
        >
          <input
            type="range"
            min={0}
            max={100}
            value={baselineScore}
            onChange={(e) => setBaselineScore(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
        <Field
          label={`Base price ($${(defaultPriceCents / 100).toFixed(0)})`}
          hint="Tiered up for higher intent"
        >
          <input
            type="range"
            min={1000}
            max={20000}
            step={500}
            value={defaultPriceCents}
            onChange={(e) => setDefaultPriceCents(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </Field>
      </div>

      <div
        className="p-4 rounded-lg space-y-3"
        style={{
          backgroundColor: requireFullEnrichment ? "rgba(37,99,235,0.06)" : "#F8FAFC",
          border: `1px solid ${requireFullEnrichment ? "rgba(37,99,235,0.18)" : "#E2E8F0"}`,
        }}
      >
        <label className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={requireFullEnrichment}
            onChange={(e) => setRequireFullEnrichment(e.target.checked)}
            className="accent-blue-600 mt-0.5"
          />
          <span>
            <span className="font-semibold">Premium · require full enrichment</span>
            <span className="block text-xs text-slate-500 mt-1 leading-relaxed">
              Drop any member missing <em>any</em> of: first name, last name,
              personal email, personal phone, mobile phone, business email,
              company name, company state, city, LinkedIn URL, income range,
              gender. The marketplace pool stays premium — only complete
              records ever appear in browse.
            </span>
          </span>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={runImmediately}
          onChange={(e) => setRunImmediately(e.target.checked)}
          className="accent-blue-600"
        />
        Run an immediate sync after creating
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !externalId}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating + syncing…" : "Create source"}
        </button>
        {error && (
          <span className="text-sm text-red-600 font-medium">
            {error}
          </span>
        )}
      </div>

      {result && (
        <div
          className="mt-4 rounded-lg p-4"
          style={{
            backgroundColor: result.backgroundStarted
              ? "rgba(37,99,235,0.06)"
              : "#F8FAFC",
            border: `1px solid ${result.backgroundStarted ? "rgba(37,99,235,0.20)" : "#E2E8F0"}`,
          }}
        >
          <p className="text-xs font-mono uppercase tracking-wider text-blue-600 mb-2 font-bold">
            {result.backgroundStarted ? "Sync started" : "Sync result"}
          </p>
          {result.status === "FAILED" ? (
            <p className="text-sm text-red-600 font-medium">
              Failed: {result.errorMessage ?? "unknown error"}
            </p>
          ) : result.backgroundStarted ? (
            <p className="text-sm text-slate-700 leading-relaxed">
              {result.note}
              <br />
              <span className="text-slate-500 text-xs">
                The source appears below immediately. Lead counts will update
                as the background sync ingests the audience.
              </span>
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <ResultStat label="Fetched" value={result.fetchedCount ?? 0} />
              <ResultStat label="Upserted" value={result.upsertedCount ?? 0} />
              <ResultStat label="New" value={result.newCount ?? 0} accent />
              <ResultStat label="Refreshed" value={result.refreshedCount ?? 0} />
              <ResultStat label="Expired" value={result.expiredCount ?? 0} />
              <ResultStat label="Failed" value={result.failedCount ?? 0} />
            </ul>
          )}
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background-color: white;
          font-size: 13.5px;
          color: #1e2a3a;
          font-family: var(--font-sans);
          transition: border-color 180ms ease;
        }
        .form-input:focus {
          outline: none;
          border-color: #2563eb;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 block">
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-[11px] text-slate-400 mt-1 block">{hint}</span>
      )}
    </label>
  );
}

type SurfaceProbe =
  | { ok: false; status: number; message: string }
  | { ok: true; memberCount: number; hasMore: boolean; sampleKeys: string[]; sampleProfileId: string | null };

type DiagnosisResult = {
  env: { CURSIVE_API_KEY: string; CURSIVE_API_URL: string };
  segmentId: string;
  audiences: SurfaceProbe;
  segments: SurfaceProbe;
  recommendation: string;
};

function DiagnoseButton({
  externalId,
  onResult,
}: {
  externalId: string;
  onResult: (r: DiagnosisResult | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={!externalId || loading}
      onClick={async () => {
        if (!externalId) return;
        setLoading(true);
        onResult(null);
        try {
          const res = await fetch(
            `/api/admin/marketplace/diagnose?id=${encodeURIComponent(externalId)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as DiagnosisResult;
            onResult(data);
          }
        } finally {
          setLoading(false);
        }
      }}
      className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
    >
      {loading ? "Probing…" : "Diagnose"}
    </button>
  );
}

function DiagnosisDisplay({ diagnosis }: { diagnosis: DiagnosisResult }) {
  return (
    <div className="mt-2 p-3 rounded-md bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider">
        <span className="text-slate-500">CURSIVE_API_KEY:</span>
        <span
          className={
            diagnosis.env.CURSIVE_API_KEY === "SET"
              ? "text-emerald-600 font-bold"
              : "text-red-600 font-bold"
          }
        >
          {diagnosis.env.CURSIVE_API_KEY}
        </span>
      </div>
      <ProbeRow label="audiences" probe={diagnosis.audiences} />
      <ProbeRow label="segments" probe={diagnosis.segments} />
      <p className="text-xs text-blue-700 font-medium pt-1 border-t border-slate-200">
        {diagnosis.recommendation}
      </p>
    </div>
  );
}

function ProbeRow({ label, probe }: { label: string; probe: SurfaceProbe }) {
  return (
    <div className="text-[11px] font-mono">
      <div className="flex items-center justify-between">
        <span className="uppercase tracking-wider text-slate-500">{label}</span>
        {probe.ok ? (
          <span className="text-emerald-600 font-bold">
            {probe.memberCount.toLocaleString()} members
          </span>
        ) : (
          <span className="text-red-600 font-bold">
            {probe.status} · failed
          </span>
        )}
      </div>
      {!probe.ok && (
        <p className="text-red-700 mt-1 break-all">{probe.message}</p>
      )}
      {probe.ok && probe.sampleKeys.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-slate-500">
            sample fields ({probe.sampleKeys.length})
          </summary>
          <p className="mt-1 text-slate-700 break-all">
            {probe.sampleKeys.join(", ")}
          </p>
        </details>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <li>
      <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p
        className={`text-xl font-medium ${accent ? "text-blue-600" : "text-slate-900"}`}
      >
        {value.toLocaleString()}
      </p>
    </li>
  );
}
