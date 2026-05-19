"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CircleDashed,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// CitationHealthPanel
//
// Renders inside the neighborhood-page editor (AI citations tab). Shows:
//   - KPI strip: per-engine citation rate + last-scan timestamp
//   - Per-claim table: claim | engines tested | last status | response excerpt
//   - "Run full scan" button → POST /api/portal/seo/neighborhoods/[id]/scan
//   - "Rescan claim" button per row (same endpoint — full scan, since the
//     orchestrator is page-level; surfaced per-row for ergonomics)
//
// Server feeds it the most-recent check per (claim, engine) so the table
// is one row per claim with per-engine status pills.
// ---------------------------------------------------------------------------

export type CitationStatus = "CITED" | "NOT_CITED" | "COMPETITOR_CITED";
export type EngineName = "CLAUDE" | "CHATGPT" | "PERPLEXITY" | "GEMINI";

export interface EngineCheck {
  engine: EngineName;
  status: CitationStatus;
  prompt: string;
  responseExcerpt: string;
  citedUrl: string | null;
  competitorsCited: string[];
  queryRunAt: string; // ISO
}

export interface ClaimRow {
  claim: string;
  prompts: string[];
  byEngine: EngineCheck[];
}

export interface CitationHealthData {
  pageId: string;
  enginesAvailable: EngineName[];
  lastScanAt: string | null;
  totalChecks: number;
  citedByEngine: Record<EngineName, { cited: number; total: number }>;
  rows: ClaimRow[];
}

const ENGINE_LABEL: Record<EngineName, string> = {
  CLAUDE: "Claude",
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  GEMINI: "Gemini",
};

export function CitationHealthPanel({ data }: { data: CitationHealthData }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<
    | { kind: "ok"; text: string }
    | { kind: "err"; text: string }
    | null
  >(null);

  async function runScan() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/portal/seo/neighborhoods/${data.pageId}/scan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        queriesRun?: number;
        citedCount?: number;
      };
      if (!res.ok) {
        setMessage({
          kind: "err",
          text:
            body.error ??
            (res.status === 429
              ? "Already scanned in the last hour."
              : `Scan failed (${res.status})`),
        });
        return;
      }
      setMessage({
        kind: "ok",
        text: `${body.queriesRun ?? 0} queries · ${body.citedCount ?? 0} cited`,
      });
      router.refresh();
    } catch (err) {
      setMessage({
        kind: "err",
        text: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* KPI strip + actions */}
      <div className="ls-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">AI citation health</h3>
            <p className="text-[12px] text-muted-foreground mt-1">
              How often each AI engine cites this page when asked about its
              claims.{" "}
              {data.lastScanAt ? (
                <>Last scan {formatTimestamp(data.lastScanAt)}.</>
              ) : (
                <>No scan recorded yet.</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {message ? (
              <span
                className={`inline-flex items-center gap-1 text-xs ${
                  message.kind === "ok"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {message.kind === "ok" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5" />
                )}
                {message.text}
              </span>
            ) : null}
            <Button
              size="sm"
              onClick={runScan}
              disabled={busy || data.rows.length === 0}
              className="inline-flex items-center gap-1.5"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
              />
              {busy ? "Scanning…" : "Run full scan"}
            </Button>
          </div>
        </div>

        {/* Per-engine KPI tiles */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.enginesAvailable.map((e) => {
            const stats = data.citedByEngine[e] ?? { cited: 0, total: 0 };
            const rate =
              stats.total > 0
                ? Math.round((stats.cited / stats.total) * 100)
                : null;
            return (
              <div
                key={e}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {ENGINE_LABEL[e]}
                </div>
                <div className="text-lg font-semibold leading-tight mt-0.5">
                  {rate === null ? "—" : `${rate}%`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {stats.cited}/{stats.total} cited
                </div>
              </div>
            );
          })}
          {data.enginesAvailable.length === 0 ? (
            <div className="col-span-full text-[12px] text-muted-foreground">
              No AI engines configured. Set ANTHROPIC_API_KEY (and
              OPENAI / PERPLEXITY / GOOGLE keys if available) to enable scans.
            </div>
          ) : null}
        </div>
      </div>

      {/* Per-claim table */}
      {data.rows.length === 0 ? (
        <div className="ls-card p-5 text-[12px] text-muted-foreground">
          Add at least one citation target above, save the page, then run a
          scan to populate this table.
        </div>
      ) : (
        <div className="ls-card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2 w-[45%]">
                  Claim
                </th>
                <th className="text-left font-medium px-4 py-2">
                  Engines tested
                </th>
                <th className="text-left font-medium px-4 py-2">Last status</th>
                <th className="text-right font-medium px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => (
                <ClaimRowItem key={idx} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ClaimRowItem({ row }: { row: ClaimRow }) {
  const [open, setOpen] = React.useState(false);

  const tested = uniqueEngines(row.byEngine);
  const worstStatus = pickWorstStatus(row.byEngine);
  const lastAt = pickLatestTimestamp(row.byEngine);

  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-start gap-1.5 text-left hover:text-foreground"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <span>{row.claim}</span>
          </button>
        </td>
        <td className="px-4 py-3">
          {tested.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tested.map((e) => (
                <span
                  key={e}
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted/40"
                >
                  {ENGINE_LABEL[e]}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <StatusPill status={worstStatus} />
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {lastAt ? formatTimestamp(lastAt) : "—"}
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={4} className="px-4 py-3">
            {row.byEngine.length === 0 ? (
              <p className="text-muted-foreground">
                No scan results yet. Run a scan to populate.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    Prompts derived from this claim
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {row.prompts.length === 0 ? (
                      <li className="text-muted-foreground">
                        (no cached prompts — first scan will generate them)
                      </li>
                    ) : (
                      row.prompts.map((p, i) => (
                        <li key={i} className="text-foreground/90">
                          {p}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="space-y-2">
                  {row.byEngine.map((c, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-border bg-background p-3"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {ENGINE_LABEL[c.engine]}
                          </span>
                          <StatusPill status={c.status} />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimestamp(c.queryRunAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1.5">
                        Prompt: {c.prompt}
                      </p>
                      <p className="text-[12px] mt-1.5 whitespace-pre-wrap">
                        {c.responseExcerpt}
                      </p>
                      {c.competitorsCited.length > 0 ? (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Competitors named: {c.competitorsCited.join(", ")}
                        </p>
                      ) : null}
                      {c.citedUrl ? (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Cited URL: {c.citedUrl}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StatusPill({ status }: { status: CitationStatus | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <CircleDashed className="h-3 w-3" />
        Not scanned
      </span>
    );
  }
  if (status === "CITED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-primary/40 text-primary">
        <CheckCircle2 className="h-3 w-3" />
        Cited
      </span>
    );
  }
  if (status === "COMPETITOR_CITED") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border text-foreground">
        <AlertCircle className="h-3 w-3" />
        Competitor cited
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded border border-border text-muted-foreground">
      Not cited
    </span>
  );
}

function uniqueEngines(checks: EngineCheck[]): EngineName[] {
  const seen = new Set<EngineName>();
  for (const c of checks) seen.add(c.engine);
  return Array.from(seen);
}

function pickWorstStatus(checks: EngineCheck[]): CitationStatus | null {
  if (checks.length === 0) return null;
  // CITED beats COMPETITOR_CITED beats NOT_CITED — but for the "last status"
  // column we want the BEST outcome to surface, so we prefer CITED first.
  if (checks.some((c) => c.status === "CITED")) return "CITED";
  if (checks.some((c) => c.status === "COMPETITOR_CITED"))
    return "COMPETITOR_CITED";
  return "NOT_CITED";
}

function pickLatestTimestamp(checks: EngineCheck[]): string | null {
  if (checks.length === 0) return null;
  return checks
    .map((c) => c.queryRunAt)
    .sort()
    .at(-1) ?? null;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 14) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
