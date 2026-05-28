"use client";

import * as React from "react";
import { Globe, Loader2, Sparkles, ExternalLink, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// ConnectWebsiteCard — the "feels like magic" entry point.
//
// Pre-state (no websiteUrl on Property): a prominent card with a single
// URL input + "Connect website" CTA. On submit, POST to
// /api/portal/seo/scan/[propertyId] — the route now returns 202 with
// { jobId } immediately and the orchestrator runs out-of-band via the
// seo-scan-worker cron. We poll /api/portal/seo/scan/[propertyId]/status
// every 3s; the response includes a `job` row with progressStage +
// progressPct so we render "Querying competitors… 55%" instead of an
// opaque spinner.
//
// Post-state (URL connected): a slim summary card showing the linked
// URL + a "Re-scan now" button that enqueues a fresh job.
//
// The async pattern matters because chained DataforSEO calls (Lighthouse
// alone is 30-40s) routinely blow past Vercel's 60s synchronous-route
// limit. Before: red "Scan is taking longer than expected" error. Now:
// the worker keeps running for up to 5 minutes per job, the UI shows
// honest progress, and we never time out.
// ---------------------------------------------------------------------------

type Coverage = {
  targetQueries: number;
  serpRankingsToday: number;
  auditsToday: number;
  backlinksToday: number;
  competitorsTotal: number;
  recommendationsTotal: number;
};

type JobInfo = {
  id: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  progressStage: string | null;
  progressPct: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
} | null;

type Props = {
  propertyId: string;
  initialWebsiteUrl: string | null;
  initialCoverage: Coverage;
};

const POLL_INTERVAL_MS = 3_000;
// 6 minutes — generous because a real DataforSEO scan can legitimately
// run 90-120s, and we want to leave headroom for the worker tick + an
// automatic retry under heavy load. Past this we surface a soft warning
// rather than killing the polling outright.
const MAX_POLL_DURATION_MS = 360_000;

export function ConnectWebsiteCard({
  propertyId,
  initialWebsiteUrl,
  initialCoverage,
}: Props) {
  const [url, setUrl] = React.useState(initialWebsiteUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = React.useState(initialWebsiteUrl);
  const [coverage, setCoverage] = React.useState<Coverage>(initialCoverage);
  const [job, setJob] = React.useState<JobInfo>(null);
  const [scanning, setScanning] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scanComplete, setScanComplete] = React.useState(false);

  const pollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = React.useRef<number>(0);

  // Poll the status endpoint. Sets coverage AND the latest job row.
  // Completion signal flips from coverage-stabilisation (brittle) to
  // job.status === DONE/FAILED (deterministic).
  const pollStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/seo/scan/${propertyId}/status`);
      if (!res.ok) return;
      const data = (await res.json()) as { coverage: Coverage; job: JobInfo };
      setCoverage(data.coverage);
      setJob(data.job);
      if (data.job?.status === "DONE") {
        setScanning(false);
        setScanComplete(true);
      } else if (data.job?.status === "FAILED") {
        setScanning(false);
        setScanError(
          data.job.error ??
            "Scan failed. Check the SEO Agent logs or retry in a moment.",
        );
      }
    } catch {
      // Swallow — we'll retry on the next poll cycle.
    }
  }, [propertyId]);

  // Polling loop. Activated only while `scanning` is true. The interval
  // stops automatically once pollStatus marks the scan complete/failed.
  React.useEffect(() => {
    if (!scanning) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      return;
    }
    pollStartRef.current = Date.now();
    const tick = async () => {
      if (Date.now() - pollStartRef.current > MAX_POLL_DURATION_MS) {
        setScanning(false);
        setScanError(
          "Scan is taking longer than expected. The worker may still finish in the background — refresh the page in a minute to check.",
        );
        return;
      }
      await pollStatus();
      pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    };
    pollTimeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [scanning, pollStatus]);

  async function startScan(targetUrl?: string) {
    setScanError(null);
    setScanComplete(false);
    setScanning(true);
    try {
      const res = await fetch(`/api/portal/seo/scan/${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: targetUrl ?? url ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        websiteUrl?: string;
        jobId?: string;
        status?: string;
        deduped?: boolean;
        error?: string;
      };
      // 202 Accepted is the happy path now — orchestrator runs out-of-band.
      if ((res.status !== 200 && res.status !== 202) || !data.ok) {
        throw new Error(data.error ?? `Scan failed (${res.status})`);
      }
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      // Immediately fetch status so the operator sees the job row in
      // the UI before the first 3s poll tick.
      await pollStatus();
      // The page parent listens for this event to refresh server data
      // when the polling effect later flips status to DONE.
      window.dispatchEvent(new CustomEvent("ls:seo-scan-complete"));
    } catch (err) {
      setScanning(false);
      setScanError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    void startScan();
  }

  // ─── Pre-state (no URL on file) ──────────────────────────────────────────
  if (!websiteUrl) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.04] via-card to-card p-5 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-1">
              Connect your website
            </p>
            <h2 className="text-lg font-semibold text-foreground leading-tight">
              Paste your URL. We&apos;ll scan it in about 90 seconds.
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1 max-w-xl">
              We pull live Google rankings for your target queries, run a Lighthouse audit, check backlinks, surface your top organic competitors, and ping AI search engines to see who they cite. Then the SEO Agent recommends specific actions.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourdomain.com"
              disabled={scanning}
              className="w-full h-10 pl-10 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              aria-label="Website URL"
            />
          </div>
          <button
            type="submit"
            disabled={scanning || !url.trim()}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                Connect &amp; scan
                <Sparkles className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {scanning ? <ScanProgress job={job} coverage={coverage} /> : null}
        {scanError ? (
          <p className="mt-3 text-[12px] text-destructive">{scanError}</p>
        ) : null}
      </section>
    );
  }

  // ─── Post-state (URL connected — slim summary + re-scan) ────────────────
  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Globe className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary mb-0.5">
              Connected
            </p>
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-semibold text-foreground hover:text-primary inline-flex items-center gap-1.5 truncate"
            >
              {websiteUrl.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void startScan()}
          disabled={scanning}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-[11.5px] font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all disabled:opacity-50"
        >
          {scanning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Re-scanning…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-scan now
            </>
          )}
        </button>
      </div>
      {scanning ? <ScanProgress job={job} coverage={coverage} /> : null}
      {scanComplete && !scanning ? (
        <p className="mt-3 text-[11.5px] text-primary inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          Scan complete. Refresh the page to see updated recommendations.
        </p>
      ) : null}
      {scanError ? (
        <p className="mt-3 text-[11.5px] text-destructive">{scanError}</p>
      ) : null}
    </section>
  );
}

function ScanProgress({
  job,
  coverage,
}: {
  job: JobInfo;
  coverage: Coverage;
}) {
  // Headline is the job's explicit progress stage when the worker has
  // actually picked the row up. While the job is still QUEUED ("waiting
  // for next worker tick") we show a soft pending label instead of the
  // misleading "Scanning…".
  const stageLabel =
    job?.status === "RUNNING"
      ? job.progressStage ?? "Scanning"
      : job?.status === "QUEUED"
        ? "Queued — worker will pick this up in under a minute"
        : "Scanning";
  const pct = job?.progressPct ?? 0;

  // Each pillar progress chip pulses while idle (zero), turns solid blue
  // once data lands. Gives a visible "things are happening" surface
  // alongside the explicit stage label.
  const pillars = [
    {
      label: "SERP rankings",
      value: coverage.serpRankingsToday,
      total: coverage.targetQueries || 4,
    },
    { label: "Lighthouse", value: coverage.auditsToday, total: 1 },
    { label: "Backlinks", value: coverage.backlinksToday, total: 1 },
    {
      label: "Competitors",
      value: coverage.competitorsTotal,
      total: 10,
    },
  ];

  return (
    <div className="mt-4 pt-3 border-t border-border/60 space-y-3">
      {/* Stage label + progress bar — the primary progress signal. */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[11.5px] font-medium text-foreground inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            {stageLabel}
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {pct}%
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
          />
        </div>
      </div>

      {/* Per-pillar pillbox — secondary signal, helps the operator see
          which stages have already landed real data without watching the
          progress bar. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        {pillars.map((p) => {
          const done = p.value >= p.total || p.value > 0;
          return (
            <div
              key={p.label}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
                done
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/60 bg-muted/30"
              }`}
            >
              {done ? (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                  ✓
                </span>
              ) : (
                <Loader2 className="h-3.5 w-3.5 text-primary/60 animate-spin" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-mono uppercase tracking-[0.08em] text-muted-foreground leading-tight">
                  {p.label}
                </p>
                <p className="text-[11.5px] font-semibold text-foreground tabular-nums leading-tight">
                  {p.value}
                  {p.total > 1 ? ` / ${p.total}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
