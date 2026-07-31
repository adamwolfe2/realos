import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { MentionSource } from "@prisma/client";
import { SourceLogo } from "@/components/portal/reputation/source-logo";
import { sourceLabel } from "@/components/portal/reputation/source-label";
import { AnimatedSparkline } from "@/components/portal/dashboard/kpi-tile-visuals";
import type { PortfolioReputationMetrics } from "@/lib/reputation/portfolio";

// ---------------------------------------------------------------------------
// Per-source scoreboard — AEO-tracker-style card row (one card per channel:
// logo + name, 12-week volume sparkline, mention count, positive share,
// last-scan recency). Cards double as source filters: clicking one sets
// ?source=, clicking the active card clears it.
// ---------------------------------------------------------------------------

// Fixed display order (dataviz rule: identity order never reshuffles).
// Core four always render — an empty Reddit card says "we scan Reddit"
// louder than its absence. Facebook/Other only appear once they have data.
const CORE_SOURCES: MentionSource[] = [
  "GOOGLE_REVIEW",
  "REDDIT",
  "YELP",
  "TAVILY_WEB",
];
const OPTIONAL_SOURCES: MentionSource[] = ["FACEBOOK_PUBLIC", "OTHER"];

type ScoreboardEntry = PortfolioReputationMetrics["sourceScoreboard"][number];

const EMPTY_ENTRY = (source: MentionSource): ScoreboardEntry => ({
  source,
  count: 0,
  positive: 0,
  classified: 0,
  weeklyCounts: [],
});

export function SourceScoreboard({
  scoreboard,
  lastScanAt,
  activeSource,
  currentParams,
}: {
  scoreboard: ScoreboardEntry[];
  lastScanAt: string | null;
  activeSource: MentionSource | null;
  currentParams: Record<string, string | undefined>;
}) {
  const bySource = new Map(scoreboard.map((s) => [s.source, s]));
  const entries: ScoreboardEntry[] = [
    ...CORE_SOURCES.map((s) => bySource.get(s) ?? EMPTY_ENTRY(s)),
    ...OPTIONAL_SOURCES.flatMap((s) => {
      const row = bySource.get(s);
      return row && row.count > 0 ? [row] : [];
    }),
  ];

  const lastScanLabel = lastScanAt
    ? `Last scan ${formatDistanceToNow(new Date(lastScanAt), { addSuffix: true })}`
    : "No scans yet";

  return (
    <section aria-label="Mentions by source" className="space-y-2">
      {/* Scan recency lives on the section, not each card — a portfolio-
          wide timestamp on an unconfigured source card implied that
          source was individually scanned (review 2026-07-31). */}
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
          Mentions by source
        </span>
        <span className="text-[11px] text-muted-foreground">
          {lastScanLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {entries.map((entry) => {
        const active = activeSource === entry.source;
        const positivePct =
          entry.classified > 0
            ? Math.round((entry.positive / entry.classified) * 100)
            : null;
        const href = buildHref(currentParams, active ? null : entry.source);
        return (
          <Link
            key={entry.source}
            href={href}
            aria-current={active ? "true" : undefined}
            className={`ls-card block p-4 transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              active ? "border-primary ring-1 ring-primary/40" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-[2px] bg-card border border-border shrink-0">
                  <SourceLogo
                    source={entry.source}
                    url=""
                    className="h-4 w-4"
                  />
                </span>
                <span className="text-sm font-semibold text-foreground truncate">
                  {cardLabel(entry.source)}
                </span>
              </div>
              <div className="w-16 shrink-0" aria-hidden="true">
                {entry.weeklyCounts.length > 1 &&
                entry.weeklyCounts.some((v) => v > 0) ? (
                  <AnimatedSparkline data={entry.weeklyCounts} height={20} />
                ) : null}
              </div>
            </div>

            <dl className="mt-3 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
                  Mentions
                </dt>
                <dd className="text-sm font-semibold text-foreground tabular-nums">
                  {entry.count.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground">
                  Positive
                </dt>
                <dd className="text-sm text-foreground tabular-nums">
                  {positivePct != null ? (
                    <>
                      <span className="text-muted-foreground text-xs">
                        {entry.positive}/{entry.classified}
                      </span>{" "}
                      <span className="font-semibold">{positivePct}%</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </div>
            </dl>

          </Link>
        );
      })}
      </div>
    </section>
  );
}

// sourceLabel("TAVILY_WEB", "") falls back to "Web" — the card deserves a
// clearer name; everything else reuses the shared label.
function cardLabel(source: MentionSource): string {
  if (source === "TAVILY_WEB") return "Open web";
  if (source === "OTHER") return "Other";
  return sourceLabel(source, "");
}

// Preserve the other filters (property multi-select, sentiment, showOlder)
// when toggling a source card. null source clears the filter.
function buildHref(
  currentParams: Record<string, string | undefined>,
  source: MentionSource | null,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(currentParams)) {
    if (v) params.set(k, v);
  }
  if (source) params.set("source", source);
  else params.delete("source");
  const qs = params.toString();
  return qs ? `/portal/reputation?${qs}` : "/portal/reputation";
}
