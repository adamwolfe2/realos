"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/marketplace/csv-client";
import type { CsvRow } from "@/lib/marketplace/csv-client";

// ---------------------------------------------------------------------------
// SellerImportTabs — two import paths for sellers:
//   1. CSV upload (parsed client-side, posted to /api/marketplace/seller/import-csv)
//   2. Cursive segment (posted to /api/marketplace/seller/import-cursive)
//
// Shows a clean tab UI so the seller picks one path at a time.
// ---------------------------------------------------------------------------

type Tab = "csv" | "cursive";

export function SellerImportTabs() {
  const [tab, setTab] = useState<Tab>("csv");
  return (
    <div>
      <div className="flex gap-2 border-b border-slate-200 mb-6">
        <TabButton active={tab === "csv"} onClick={() => setTab("csv")} label="CSV upload" />
        <TabButton active={tab === "cursive"} onClick={() => setTab("cursive")} label="Cursive segment" />
      </div>

      {tab === "csv" ? <CsvUploadTab /> : <CursiveImportTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 18px",
        borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
        marginBottom: "-1px",
        color: active ? "#2563EB" : "#64748B",
        fontFamily: "var(--font-sans)",
        fontSize: "13.5px",
        fontWeight: 600,
        background: "transparent",
        cursor: "pointer",
        transition: "color 180ms ease",
      }}
    >
      {label}
    </button>
  );
}

// ----- CSV ------------------------------------------------------------------

function CsvUploadTab() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ upserted: number; expired: number; skipped: number; errors: string[] } | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setParseError(null);
    setResult(null);
    try {
      const text = await f.text();
      const parsed = parseCsv(text);
      setRows(parsed);
    } catch (err) {
      setParseError((err as Error).message);
      setRows([]);
    }
  }

  async function handleSubmit() {
    if (rows.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace/seller/import-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data?.error ?? "Import failed");
        return;
      }
      setResult(data.summary);
      router.refresh();
    } catch (err) {
      setParseError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="p-6 md:p-8"
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0",
      }}
    >
      <h2
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          fontWeight: 500,
        }}
      >
        Upload a CSV
      </h2>
      <p
        className="mt-1 mb-4"
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.55,
        }}
      >
        Required columns: <code className="font-mono text-xs text-slate-700">email</code> or <code className="font-mono text-xs text-slate-700">phone</code>.
        Recognised columns: <code className="font-mono text-xs text-slate-700">firstName, lastName, email, phone, city, state, postalCode, propertyType, budgetMinCents, budgetMaxCents, signal, timeline, listingsViewed7d, hasMortgagePreApp, hasScheduledTour, hasCashBuyerSignal, isRelocating, isDistressed</code>.
        Max 5,000 rows per upload.
      </p>

      <label
        className="block w-full p-6 text-center cursor-pointer"
        style={{
          backgroundColor: "#F1F5F9",
          border: "2px dashed #CBD5E1",
          borderRadius: "12px",
        }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
        <p
          style={{
            color: "#1E2A3A",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          {file ? file.name : "Click to choose a CSV file"}
        </p>
        {rows.length > 0 && (
          <p
            className="mt-1"
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            {rows.length.toLocaleString()} rows parsed
          </p>
        )}
        {parseError && (
          <p
            className="mt-2"
            style={{ color: "#B91C1C", fontSize: "13px" }}
          >
            {parseError}
          </p>
        )}
      </label>

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={rows.length === 0 || submitting}
          style={{
            padding: "11px 18px",
            borderRadius: "10px",
            backgroundColor: "#2563EB",
            color: "#fff",
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            fontWeight: 600,
            border: "none",
            cursor: submitting || rows.length === 0 ? "not-allowed" : "pointer",
            opacity: submitting || rows.length === 0 ? 0.5 : 1,
          }}
        >
          {submitting ? "Importing…" : `Import ${rows.length.toLocaleString()} leads`}
        </button>
      </div>

      {result && (
        <div
          className="mt-5 p-4"
          style={{
            backgroundColor: "#F1F5F9",
            borderRadius: "10px",
          }}
        >
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Import result
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Upserted</p>
              <p className="text-xl font-medium text-blue-600">{result.upserted}</p>
            </li>
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Skipped</p>
              <p className="text-xl font-medium text-slate-900">{result.skipped}</p>
            </li>
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Expired</p>
              <p className="text-xl font-medium text-slate-900">{result.expired}</p>
            </li>
          </ul>
          {result.errors.length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-red-600 font-mono">
                {result.errors.length} errors
              </summary>
              <ul className="mt-2 space-y-1">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i} className="text-red-700 font-mono">
                    {e}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Cursive --------------------------------------------------------------

function CursiveImportTab() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [segmentId, setSegmentId] = useState("");
  const [kind, setKind] = useState<"CURSIVE_AUDIENCE" | "CURSIVE_SEGMENT">("CURSIVE_AUDIENCE");
  const [propertyType, setPropertyType] = useState("SALE");
  const [defaultMarket, setDefaultMarket] = useState("United States");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ fetchedCount: number; upsertedCount: number; newCount: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!segmentId || submitting) return;
    setSubmitting(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch("/api/marketplace/seller/import-cursive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || `Cursive · ${segmentId.slice(0, 8)}`,
          segmentId,
          kind,
          defaultPropertyType: propertyType,
          defaultMarket,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? data?.error ?? "Import failed");
        return;
      }
      setSummary(data.summary);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 md:p-8 space-y-4"
      style={{
        backgroundColor: "#fff",
        borderRadius: "16px",
        boxShadow: "0 0 0 1px #E2E8F0",
      }}
    >
      <h2
        style={{
          color: "#1E2A3A",
          fontFamily: "var(--font-display)",
          fontSize: "18px",
          fontWeight: 500,
        }}
      >
        Wire a Cursive segment
      </h2>
      <p
        style={{
          color: "#64748B",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          lineHeight: 1.55,
        }}
      >
        Paste your Cursive audience or segment ID. We'll pull every member,
        score them, and refresh weekly. Each lead is stamped to your account
        for revenue share.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Source name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NYC high-intent buyers"
            className="form-input"
          />
        </Field>
        <Field label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "CURSIVE_AUDIENCE" | "CURSIVE_SEGMENT")}
            className="form-input"
          >
            <option value="CURSIVE_AUDIENCE">Audience (UUID)</option>
            <option value="CURSIVE_SEGMENT">Segment (Studio)</option>
          </select>
        </Field>
      </div>

      <Field label="Segment / audience ID">
        <input
          value={segmentId}
          onChange={(e) => setSegmentId(e.target.value)}
          placeholder="ba8c9817-f91c-4955-b2b0-53b933a15f7d"
          className="form-input font-mono text-xs"
          required
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Default property type">
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="form-input"
          >
            <option value="SALE">Sale</option>
            <option value="RENTAL">Rental</option>
            <option value="INVESTMENT">Investment</option>
            <option value="COMMERCIAL">Commercial</option>
          </select>
        </Field>
        <Field label="Default market">
          <input
            value={defaultMarket}
            onChange={(e) => setDefaultMarket(e.target.value)}
            className="form-input"
            placeholder="United States"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting || !segmentId}
        style={{
          padding: "11px 18px",
          borderRadius: "10px",
          backgroundColor: "#2563EB",
          color: "#fff",
          fontFamily: "var(--font-sans)",
          fontSize: "14px",
          fontWeight: 600,
          border: "none",
          cursor: submitting || !segmentId ? "not-allowed" : "pointer",
          opacity: submitting || !segmentId ? 0.5 : 1,
        }}
      >
        {submitting ? "Importing…" : "Wire segment + sync now"}
      </button>

      {error && (
        <p style={{ color: "#B91C1C", fontSize: "13px" }}>{error}</p>
      )}

      {summary && (
        <div
          className="mt-3 p-4"
          style={{ backgroundColor: "#F1F5F9", borderRadius: "10px" }}
        >
          <p
            style={{
              color: "#2563EB",
              fontFamily: "var(--font-mono)",
              fontSize: "10.5px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Sync result
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-3 text-sm">
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Fetched</p>
              <p className="text-xl font-medium text-slate-900">{summary.fetchedCount}</p>
            </li>
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">New</p>
              <p className="text-xl font-medium text-blue-600">{summary.newCount}</p>
            </li>
            <li>
              <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Upserted</p>
              <p className="text-xl font-medium text-slate-900">{summary.upsertedCount}</p>
            </li>
          </ul>
        </div>
      )}

      <style jsx>{`
        .form-input {
          width: 100%;
          padding: 9px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background-color: white;
          font-size: 14px;
          color: #1e2a3a;
          font-family: var(--font-sans);
        }
        .form-input:focus {
          outline: none;
          border-color: #2563eb;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}
