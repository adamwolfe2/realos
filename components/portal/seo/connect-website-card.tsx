"use client";

import * as React from "react";
import { Globe, Loader2, Sparkles, ExternalLink, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// ConnectWebsiteCard — the "feels like magic" entry point.
//
// Pre-state (no websiteUrl on Property): a prominent card with a single
// URL input + "Connect website" CTA. On submit, POST to
// /api/portal/seo/scan/[propertyId] with { websiteUrl }, then poll
// /api/portal/seo/scan/[propertyId]/status every 3 seconds so the UI
// can show "Scanning queries... Lighthouse running... Backlinks
// fetched..." in real time.
//
// Post-state (URL connected): a slim summary card showing the linked
// URL + a "Re-scan now" button.
//
// All data fetching downstream is server-side via the parent page. This
// component owns ONLY the connect + scan lifecycle.
// ---------------------------------------------------------------------------

type Coverage = {
  targetQueries: number;
  serpRankingsToday: number;
  auditsToday: number;
  backlinksToday: number;
  competitorsTotal: number;
  recommendationsTotal: number;
};

type Props = {
  propertyId: string;
  initialWebsiteUrl: string | null;
  initialCoverage: Coverage;
};

const POLL_INTERVAL_MS = 3_000;
// Time after which we give up polling — if the scan hasn't returned by
// then something's wrong (DataforSEO outage, missing keys, etc).
const MAX_POLL_DURATION_MS = 90_000;

export function ConnectWebsiteCard({
  propertyId,
  initialWebsiteUrl,
  initialCoverage,
}: Props) {
  const [url, setUrl] = React.useState(initialWebsiteUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = React.useState(initialWebsiteUrl);
  const [coverage, setCoverage] = React.useState<Coverage>(initialCoverage);
  const [scanning, setScanning] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [scanComplete, setScanComplete] = React.useState(false);

  const pollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pollStartRef = React.useRef<number>(0);

  // Schedule the next status poll. Stops when coverage hasn't changed
  // for 2 consecutive polls AND we have data, or when MAX_POLL_DURATION
  // is hit.
  const pollStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/seo/scan/${propertyId}/status`);
      if (!res.ok) return;
      const data = (await res.json()) as { coverage: Coverage };
      setCoverage((prev) => {
        const stable =
          prev.serpRankingsToday === data.coverage.serpRankingsToday &&
          prev.auditsToday === data.coverage.auditsToday &&
          prev.backlinksToday === data.coverage.backlinksToday &&
          prev.competitorsTotal === data.coverage.competitorsTotal;
        const hasData =
          data.coverage.serpRankingsToday > 0 ||
          data.coverage.auditsToday > 0 ||
          data.coverage.backlinksToday > 0;
        if (stable && hasData && scanning) {
          // Two stable polls + data present → assume scan is done.
          setScanning(false);
          setScanComplete(true);
        }
        return data.coverage;
      });
    } catch {
      /* swallow — we'll retry on the next poll */
    }
  }, [propertyId, scanning]);

  // Polling loop. Activated only while `scanning` is true.
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
          "Scan is taking longer than expected. Refresh the page to see partial results — or re-run to retry.",
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
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `Scan failed (${res.status})`);
      }
      if (data.websiteUrl) setWebsiteUrl(data.websiteUrl);
      // Immediately refresh status so the operator sees data populate
      // without waiting for the first poll interval.
      await pollStatus();
      // Refresh the rest of the page (server components) so freshly
      // ingested SerpRanking / OnPageAudit rows render in their cards.
      // We don't router.refresh() here because the polling effect
      // will trigger it once coverage stabilises (via the parent
      // listening for scanComplete via a Window event below).
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
              Paste your URL. We'll scan it in 30 seconds.
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

        {scanning ? <ScanProgress coverage={coverage} /> : null}
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
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
            <Globe className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-emerald-700 mb-0.5">
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
      {scanning ? <ScanProgress coverage={coverage} /> : null}
      {scanComplete && !scanning ? (
        <p className="mt-3 text-[11.5px] text-emerald-700 inline-flex items-center gap-1.5">
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

function ScanProgress({ coverage }: { coverage: Coverage }) {
  // Each pillar progress chip pulses while idle (zero), turns checked
  // once data lands. Gives the operator a visible "things are
  // happening" surface during the 10-20s scan window.
  const pillars = [
    {
      label: "SERP rankings",
      value: coverage.serpRankingsToday,
      total: coverage.targetQueries || 4,
    },
    {
      label: "Lighthouse",
      value: coverage.auditsToday,
      total: 1,
    },
    {
      label: "Backlinks",
      value: coverage.backlinksToday,
      total: 1,
    },
    {
      label: "Competitors",
      value: coverage.competitorsTotal,
      total: 10,
    },
  ];

  return (
    <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 md:grid-cols-4 gap-2">
      {pillars.map((p) => {
        const done = p.value >= p.total || p.value > 0;
        return (
          <div
            key={p.label}
            className={`flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-1.5 ${
              done ? "bg-emerald-50/50" : "bg-muted/30"
            }`}
          >
            {done ? (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px]">
                ✓
              </span>
            ) : (
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
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
  );
}
