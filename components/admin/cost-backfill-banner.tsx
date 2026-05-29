"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  History,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// CostBackfillBanner — sits at the top of /admin/costs.
//
// Two purposes:
//   1. Honest disclosure that per-call ApiUsage tracking started
//      2026-05-29 — pre-instrumentation spend lives in vendor consoles
//      and we link to each of them.
//   2. One-click button to synthesize historical ApiUsage rows from
//      ProspectAudit + DailySignalSnapshot tables using the pipeline
//      cost shape. Calls POST /api/admin/cost-backfill.
//
// The button is intentionally cautious — it shows the dollar shape of
// what will be inserted in the success state so the operator can
// verify before walking away.
// ---------------------------------------------------------------------------

interface VendorConsole {
  label: string;
  url: string;
}

interface Props {
  vendorConsoles: Record<string, VendorConsole>;
}

interface BackfillSummary {
  sinceDays: number;
  audits: number;
  tenantSnapshots: number;
  synthesizedRowsInserted: number;
  dataForSeoLifetimeSpentUsd: number | null;
  attributedToAuditsUsd: number;
  reconciliationDeltaUsd: number | null;
}

export function CostBackfillBanner({ vendorConsoles }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BackfillSummary | null>(null);

  async function runBackfill() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/cost-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sinceDays: 90 }),
      });
      const data = (await res.json()) as
        | { ok: true; summary: BackfillSummary }
        | { ok?: false; error?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setError(
          ("error" in data && data.error) ||
            `Backfill failed (HTTP ${res.status})`,
        );
        setBusy(false);
        return;
      }
      setResult(data.summary);
      setBusy(false);
      // Refresh the server-rendered rollups so the new synthesized
      // rows show up in the headline tiles + per-provider table.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setBusy(false);
    }
  }

  const vendorEntries = Object.entries(vendorConsoles);

  return (
    <section
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: "#E5E7EB" }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <span
          aria-hidden
          className="inline-flex items-center justify-center flex-shrink-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "rgba(37,99,235,0.10)",
            color: "#2563EB",
          }}
        >
          <History size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold"
            style={{ color: "#6B7280" }}
          >
            Tracking started 2026-05-29
          </p>
          <h2
            className="mt-1 text-base font-semibold"
            style={{ color: "#1E2A3A", letterSpacing: "-0.01em" }}
          >
            Per-call cost logging is forward-only.
          </h2>
          <p
            className="mt-1.5 text-sm"
            style={{ color: "#4B5563", lineHeight: 1.55 }}
          >
            Real per-call dollars for spend BEFORE 2026-05-29 lives in
            each vendor&apos;s billing console. Click any link below to
            jump to the source of truth. You can also{" "}
            <strong>synthesize</strong> historical ApiUsage rows from
            existing ProspectAudit + DailySignalSnapshot data — they
            won&apos;t be per-call exact but they&apos;ll give the
            dashboard a meaningful historical $ shape.
          </p>

          {/* Vendor console links */}
          <ul className="mt-3 flex flex-wrap gap-2">
            {vendorEntries.map(([key, vendor]) => (
              <li key={key}>
                <a
                  href={vendor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 h-7 text-xs font-medium"
                  style={{
                    borderColor: "#E5E7EB",
                    color: "#1E2A3A",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {vendor.label}
                  <ExternalLink size={11} strokeWidth={1.75} />
                </a>
              </li>
            ))}
          </ul>

          {/* Backfill action */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={runBackfill}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-semibold disabled:opacity-60"
              style={{
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                padding: "8px 16px",
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Synthesizing…
                </>
              ) : result ? (
                <>
                  <CheckCircle2 size={14} />
                  Re-run backfill
                </>
              ) : (
                <>
                  <History size={14} />
                  Synthesize last 90 days
                </>
              )}
            </button>
            <p className="text-[11px]" style={{ color: "#6B7280" }}>
              Inserts estimated ApiUsage rows. Safe to re-run — replaces
              prior synthesized rows with fresh estimates.
            </p>
          </div>

          {/* Success summary */}
          {result ? (
            <div
              className="mt-3 rounded-md p-3 text-xs"
              style={{
                backgroundColor: "rgba(22,163,74,0.06)",
                border: "1px solid rgba(22,163,74,0.2)",
                color: "#1E2A3A",
              }}
            >
              <p className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={12} style={{ color: "#15803D" }} />
                Synthesized {result.synthesizedRowsInserted.toLocaleString()}{" "}
                rows from {result.audits} audits +{" "}
                {result.tenantSnapshots} tenant snapshots.
              </p>
              {result.dataForSeoLifetimeSpentUsd != null ? (
                <p className="mt-1.5" style={{ color: "#4B5563" }}>
                  DataForSEO real lifetime spend:{" "}
                  <strong>
                    ${result.dataForSeoLifetimeSpentUsd.toFixed(2)}
                  </strong>{" "}
                  · attributed to audits via estimate:{" "}
                  <strong>${result.attributedToAuditsUsd.toFixed(2)}</strong>
                  {result.reconciliationDeltaUsd != null
                    ? ` · reconciliation delta logged as "leasestack-backfill" row: $${result.reconciliationDeltaUsd.toFixed(2)}.`
                    : "."}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Error */}
          {error ? (
            <div
              className="mt-3 rounded-md p-3 text-xs flex items-start gap-2"
              style={{
                backgroundColor: "rgba(185,28,28,0.06)",
                border: "1px solid rgba(185,28,28,0.2)",
                color: "#7F1D1D",
              }}
            >
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
