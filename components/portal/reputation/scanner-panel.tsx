"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, Loader2, Filter } from "lucide-react";
import type {
  MentionSource,
  ReputationScanStatus,
  Sentiment,
} from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MentionCard, type MentionView } from "./mention-card";
import { SourceProgress, type SourceState } from "./source-progress";

// ---------------------------------------------------------------------------
// Reputation Scanner Panel — client component.
//
// Owns:
//   - "Scan Now" button + SSE consumer
//   - live per-source progress chips
//   - unified mention feed (initial rows seeded from server, appended via
//     stream, persisted via the mentions API)
//   - filter chips (sentiment / source / unreviewed)
//   - previous scans accordion
// ---------------------------------------------------------------------------

export type InitialScan = {
  id: string;
  status: ReputationScanStatus;
  createdAt: string;
  totalMentionCount: number;
  newMentionCount: number;
};

export type ScannerPanelProps = {
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
  initialMentions: MentionView[];
  initialScans: InitialScan[];
  initialNextCursor: string | null;
  lastScanAt: string | null;
};

type Filters = {
  sentiment: Sentiment | "ALL";
  source: MentionSource | "ALL";
  unreviewed: boolean;
  flagged: boolean;
};

type SourceMap = Record<string, SourceState>;

export function ScannerPanel({
  propertyId,
  propertyName,
  propertyAddress,
  initialMentions,
  initialScans,
  initialNextCursor,
  lastScanAt,
}: ScannerPanelProps) {
  const [mentions, setMentions] = React.useState<MentionView[]>(initialMentions);
  const [cursor, setCursor] = React.useState<string | null>(initialNextCursor);
  const [scans, setScans] = React.useState<InitialScan[]>(initialScans);
  const [scanning, setScanning] = React.useState(false);
  const [sources, setSources] = React.useState<SourceMap>({});
  const [analysisCount, setAnalysisCount] = React.useState<number | null>(null);
  const [latestScanAt, setLatestScanAt] = React.useState<string | null>(
    lastScanAt,
  );

  const [filters, setFilters] = React.useState<Filters>({
    sentiment: "ALL",
    source: "ALL",
    unreviewed: false,
    flagged: false,
  });

  // Sort priority (top to bottom):
  //   1. Flagged mentions — operator already marked these for follow-up
  //   2. Source rank — Reddit + forums first (raw organic discussion, the
  //      most-sought intent signal), then structured user reviews (Yelp,
  //      Google, ApartmentRatings, Niche, BBB), then everything else
  //   3. Sentiment — negative first within each source bucket (actionable)
  //   4. Newest first within sentiment bucket
  const sentimentRank = (s: Sentiment | null | undefined): number => {
    switch (s) {
      case "NEGATIVE":
        return 0;
      case "MIXED":
        return 1;
      case "NEUTRAL":
        return 2;
      case "POSITIVE":
        return 3;
      default:
        return 4;
    }
  };

  const sourceRank = (m: MentionView): number => {
    let host = "";
    try {
      host = new URL(m.sourceUrl).host.toLowerCase().replace(/^www\./, "");
    } catch {
      // fall through
    }
    // Tier 0: organic discussion (Reddit, College Confidential, Quora).
    if (m.source === "REDDIT" || /reddit\.com$/.test(host)) return 0;
    if (/collegeconfidential\.com$/.test(host)) return 0;
    if (/quora\.com$/.test(host)) return 0;
    // Tier 1: structured user reviews.
    if (m.source === "YELP" || /yelp\.com$/.test(host)) return 1;
    if (/apartmentratings\.com$/.test(host)) return 1;
    if (/niche\.com$/.test(host)) return 1;
    if (/bbb\.org$/.test(host)) return 1;
    if (/glassdoor\.com$/.test(host)) return 1;
    // Tier 2: Google Reviews (structured, responded to via Business Profile).
    if (m.source === "GOOGLE_REVIEW" || /google\.com$/.test(host)) return 2;
    // Tier 3: other social / web.
    return 3;
  };

  const filtered = React.useMemo(() => {
    const list = mentions.filter((m) => {
      if (filters.sentiment !== "ALL" && m.sentiment !== filters.sentiment) {
        return false;
      }
      if (filters.source !== "ALL" && m.source !== filters.source) {
        return false;
      }
      if (filters.unreviewed && m.reviewed) return false;
      if (filters.flagged && !m.flagged) return false;
      return true;
    });
    return list.sort((a, b) => {
      // Flagged first
      if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
      // Source tier (Reddit/forums first)
      const sa = sourceRank(a);
      const sb = sourceRank(b);
      if (sa !== sb) return sa - sb;
      // Sentiment (negative first)
      const rankA = sentimentRank(a.sentiment);
      const rankB = sentimentRank(b.sentiment);
      if (rankA !== rankB) return rankA - rankB;
      // Newest first within bucket
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [mentions, filters]);

  const upsertMention = React.useCallback((next: MentionView) => {
    setMentions((prev) => {
      const existing = prev.findIndex((m) => m.id === next.id);
      if (existing === -1) return [next, ...prev];
      const copy = [...prev];
      copy[existing] = { ...copy[existing], ...next };
      return copy;
    });
  }, []);

  const startScan = React.useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setSources({
      google: { status: "running" },
      tavily: { status: "running" },
    });
    setAnalysisCount(null);

    try {
      const res = await fetch("/api/tenant/reputation-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error ?? `Scan failed (${res.status})`);
        setScanning(false);
        setSources({});
        return;
      }

      if (!res.body) {
        toast.error("No response stream from server");
        setScanning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = "";

      // Minimal SSE parser: split on blank-line separator, pull `event:` and
      // `data:` fields off each block.
      const handleEvent = (block: string) => {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        if (dataLines.length === 0) return;
        let payload: unknown;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          return;
        }
        onEvent(eventName, payload);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffered.indexOf("\n\n")) !== -1) {
          const block = buffered.slice(0, sep);
          buffered = buffered.slice(sep + 2);
          if (block.trim().length > 0) handleEvent(block);
        }
      }
      if (buffered.trim().length > 0) handleEvent(buffered);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Scan failed unexpectedly",
      );
    } finally {
      setScanning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, scanning]);

  function onEvent(name: string, payload: unknown) {
    switch (name) {
      case "source_progress": {
        const p = payload as { source: string; status: "running" };
        setSources((prev) => ({ ...prev, [p.source]: { status: "running" } }));
        break;
      }
      case "source_complete": {
        const p = payload as {
          source: string;
          found: number;
          newCount: number;
        };
        setSources((prev) => ({
          ...prev,
          [p.source]: {
            status: "complete",
            found: p.found,
            newCount: p.newCount,
          },
        }));
        break;
      }
      case "source_failed": {
        const p = payload as { source: string; error: string };
        setSources((prev) => ({
          ...prev,
          [p.source]: { status: "failed", error: p.error },
        }));
        break;
      }
      case "analysis_started": {
        const p = payload as { toAnalyze: number };
        setAnalysisCount(p.toAnalyze);
        break;
      }
      case "mention": {
        const p = payload as {
          id: string;
          source: MentionSource;
          title: string | null;
          excerpt: string;
          sentiment: Sentiment | null;
          topics: string[];
          url: string;
          authorName: string | null;
          publishedAt: string | null;
          rating: number | null;
        };
        upsertMention({
          id: p.id,
          source: p.source,
          sourceUrl: p.url,
          title: p.title,
          excerpt: p.excerpt,
          authorName: p.authorName,
          publishedAt: p.publishedAt,
          rating: p.rating,
          sentiment: p.sentiment,
          topics: p.topics,
          reviewed: false,
          flagged: false,
          isNew: true,
        });
        break;
      }
      case "done": {
        const p = payload as {
          scanId: string;
          totalMentions: number;
          newMentions: number;
          durationMs: number;
          status: ReputationScanStatus;
        };
        setScans((prev) => [
          {
            id: p.scanId,
            status: p.status,
            createdAt: new Date().toISOString(),
            totalMentionCount: p.totalMentions,
            newMentionCount: p.newMentions,
          },
          ...prev,
        ]);
        setLatestScanAt(new Date().toISOString());
        setAnalysisCount(null);
        const secs = Math.round(p.durationMs / 100) / 10;
        if (p.newMentions > 0) {
          toast.success(
            `${p.newMentions} new mention${p.newMentions === 1 ? "" : "s"} found in ${secs}s`,
          );
        } else {
          toast.success(`Scan complete in ${secs}s — no new mentions`);
        }
        break;
      }
      case "error": {
        const p = payload as { message: string };
        toast.error(p.message || "Scan error");
        break;
      }
    }
  }

  const loadMore = async () => {
    if (!cursor) return;
    try {
      const url = new URL(
        "/api/tenant/reputation-mentions",
        window.location.origin,
      );
      url.searchParams.set("propertyId", propertyId);
      url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "20");
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const body = (await res.json()) as {
        items: MentionView[];
        nextCursor: string | null;
      };
      setMentions((prev) => [...prev, ...body.items]);
      setCursor(body.nextCursor);
    } catch {
      toast.error("Could not load more mentions");
    }
  };

  const hasAnyMentions = mentions.length > 0;

  return (
    <div className="space-y-6">
      {/* Scan controls */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              Reputation scanner
            </div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
              {propertyName}
            </h2>
            {propertyAddress ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                {propertyAddress}
              </p>
            ) : null}
            {latestScanAt ? (
              <p className="text-[11px] text-muted-foreground mt-2">
                Last scanned{" "}
                {formatDistanceToNow(new Date(latestScanAt), {
                  addSuffix: true,
                })}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-2">
                Never scanned — click Scan Now to search Google Reviews,
                Reddit, Facebook, and the open web.
              </p>
            )}
          </div>

          <Button onClick={startScan} disabled={scanning} className="gap-2">
            {scanning ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {scanning ? "Scanning…" : "Scan now"}
          </Button>
        </div>

        {scanning || Object.keys(sources).length > 0 ? (
          <div className="mt-4 space-y-2">
            <SourceProgress sources={sources} />
            {analysisCount !== null ? (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2
                  className={cn(
                    "h-3 w-3",
                    scanning && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                Classifying {analysisCount} new mention
                {analysisCount === 1 ? "" : "s"}…
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Filter chips */}
      {hasAnyMentions ? (
        <section className="flex items-center gap-2 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground pr-1">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            Filters:
          </span>
          <FilterChip
            label="All"
            active={
              filters.sentiment === "ALL" &&
              !filters.unreviewed &&
              !filters.flagged
            }
            onClick={() =>
              setFilters({
                sentiment: "ALL",
                source: filters.source,
                unreviewed: false,
                flagged: false,
              })
            }
          />
          <FilterChip
            label="Negative"
            active={filters.sentiment === "NEGATIVE"}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                sentiment: f.sentiment === "NEGATIVE" ? "ALL" : "NEGATIVE",
              }))
            }
          />
          <FilterChip
            label="Positive"
            active={filters.sentiment === "POSITIVE"}
            onClick={() =>
              setFilters((f) => ({
                ...f,
                sentiment: f.sentiment === "POSITIVE" ? "ALL" : "POSITIVE",
              }))
            }
          />
          <FilterChip
            label="Unreviewed"
            active={filters.unreviewed}
            onClick={() =>
              setFilters((f) => ({ ...f, unreviewed: !f.unreviewed }))
            }
          />
          <FilterChip
            label="Flagged"
            active={filters.flagged}
            onClick={() =>
              setFilters((f) => ({ ...f, flagged: !f.flagged }))
            }
          />
          <span className="w-2" />
          <SourceFilter
            value={filters.source}
            onChange={(source) => setFilters((f) => ({ ...f, source }))}
          />
        </section>
      ) : null}

      {/* Mention feed */}
      {filtered.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {hasAnyMentions
              ? "No mentions match the current filters."
              : "No mentions yet. Click Scan now to search the web."}
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-3">
          {filtered.map((m) => (
            <MentionCard key={m.id} mention={m} onUpdated={upsertMention} />
          ))}
          {cursor && filtered.length === mentions.length ? (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={loadMore}>
                Load more
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {/* Previous scans */}
      {scans.length > 0 ? (
        <section className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold tracking-tight text-foreground mb-3">
            Previous scans
          </h3>
          <ul className="divide-y divide-border">
            {scans.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div className="text-muted-foreground">
                  {formatDistanceToNow(new Date(s.createdAt), {
                    addSuffix: true,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/80">
                    {s.totalMentionCount} mentions
                  </span>
                  {s.newMentionCount > 0 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      +{s.newMentionCount} new
                    </Badge>
                  ) : null}
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SourceFilter({
  value,
  onChange,
}: {
  value: MentionSource | "ALL";
  onChange: (v: MentionSource | "ALL") => void;
}) {
  const options: Array<{ value: MentionSource | "ALL"; label: string }> = [
    { value: "ALL", label: "All sources" },
    { value: "GOOGLE_REVIEW", label: "Google" },
    { value: "REDDIT", label: "Reddit" },
    { value: "FACEBOOK_PUBLIC", label: "Facebook" },
    { value: "YELP", label: "Yelp" },
    { value: "TAVILY_WEB", label: "Web" },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MentionSource | "ALL")}
      className="h-7 rounded-md border border-border bg-card px-2 text-[11px] text-foreground"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StatusBadge({ status }: { status: ReputationScanStatus }) {
  if (status === "SUCCEEDED") {
    return (
      <Badge variant="outline" className="text-[10px]">
        ok
      </Badge>
    );
  }
  if (status === "PARTIAL") {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-600">
        partial
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        failed
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      running
    </Badge>
  );
}
