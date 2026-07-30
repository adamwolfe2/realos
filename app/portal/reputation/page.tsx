import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Star, Flag, MessageSquare, AlertCircle } from "lucide-react";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { requireModule } from "@/lib/portal/module-gate";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import {
  loadPortfolioReputationMetrics,
  loadPortfolioReputationFeed,
  type PortfolioReputationMetrics,
  type PortfolioReputationFeedItem,
} from "@/lib/reputation/portfolio";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { PageHeader } from "@/components/admin/page-header";
import { SourceLogo } from "@/components/portal/reputation/source-logo";
import { sourceLabel } from "@/components/portal/reputation/source-label";
import { SourceBars } from "@/components/portal/dashboard/source-bars";
import { ReputationFilters } from "@/components/portal/reputation/reputation-filters";
import { ReputationScanButton } from "@/components/portal/reputation/reputation-scan-button";
import { SentimentSparkline } from "@/components/portal/reputation/sentiment-sparkline";
import { MentionSource, Sentiment } from "@prisma/client";
import { safeNum, fmtInt, fmtRating } from "@/components/portal/reputation/reputation-utils";
import { PropertySummaryRow } from "@/components/portal/reputation/property-summary-row";
import { AnalyticsBlock, SentimentBar, MonthlyVolume } from "@/components/portal/reputation/analytics-blocks";
import { RatingStars } from "@/components/portal/reputation/rating-stars";
import { RecentToggleLink } from "@/components/portal/reputation/recent-toggle-link";
import { SentimentSplitBar } from "@/components/portal/reputation/sentiment-split-bar";
import { ReputationFallback } from "@/components/portal/reputation/reputation-fallback";
import { FeedRow } from "@/components/portal/reputation/feed-row";

export const metadata: Metadata = { title: "Reputation" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/reputation — Portfolio-wide brand health view.
//
// Until now the Reddit / Google / Yelp scanner was buried inside per-property
// detail tabs. This page surfaces the same data rolled up across every
// property in the org so operators get a one-click answer to "how is my
// brand looking right now?". Per-property drill-down stays at
// /portal/properties/[id]?tab=reputation.
// ---------------------------------------------------------------------------

const EMPTY_METRICS: PortfolioReputationMetrics = {
  totalMentions: 0,
  newLast30d: 0,
  newPrior30d: 0,
  negativePct: null,
  unreviewedCount: 0,
  flaggedCount: 0,
  googleAvgRating: null,
  googleReviewCount: 0,
  sourceBreakdown: [],
  sentimentBreakdown: [],
  propertyHealth: [],
  monthlyVolume: [],
  weeklySentiment: [],
};

// Whitelisted enum parsers — we never trust raw searchParams. Returning
// null for an unrecognized value means "treat as all".
function parseSourceFilter(v: string | undefined): MentionSource | null {
  if (!v || v === "all") return null;
  const allowed: MentionSource[] = [
    MentionSource.GOOGLE_REVIEW,
    MentionSource.REDDIT,
    MentionSource.YELP,
    MentionSource.TAVILY_WEB,
    MentionSource.FACEBOOK_PUBLIC,
    MentionSource.OTHER,
  ];
  return (allowed as string[]).includes(v) ? (v as MentionSource) : null;
}

function parseSentimentFilter(v: string | undefined): Sentiment | null {
  if (!v || v === "all") return null;
  const allowed: Sentiment[] = [
    Sentiment.POSITIVE,
    Sentiment.NEUTRAL,
    Sentiment.NEGATIVE,
    Sentiment.MIXED,
  ];
  return (allowed as string[]).includes(v) ? (v as Sentiment) : null;
}

// String-form hint for the "Total mentions" KPI. We render a 30-day count
// and (when there's a baseline) a percentage delta vs the prior 30 days.
// The arrow glyph is intentionally unicode rather than a Lucide icon —
// KpiTile.hint is typed as plain string.
function mentionsTrendHint(metrics: PortfolioReputationMetrics): string {
  const current = safeNum(metrics.newLast30d);
  const prior = safeNum(metrics.newPrior30d);
  const base = `${current.toLocaleString()} new in 30d`;
  let delta: number | null = null;
  if (prior > 0) {
    delta = Math.round(((current - prior) / prior) * 100);
  } else if (current > 0) {
    return `${base} · new (no prior data)`;
  }
  if (delta == null || delta === 0) return base;
  const arrow = delta > 0 ? "↑" : "↓";
  const sign = delta > 0 ? "+" : "";
  return `${base} · ${arrow} ${sign}${delta}% vs prior 30d`;
}

export default async function PortfolioReputationPage({
  searchParams,
}: {
  searchParams: Promise<{
    property?: string;
    properties?: string;
    source?: string;
    sentiment?: string;
    showOlder?: string;
  }>;
}) {
  const gate = await requireModule("moduleReputation");
  if (gate) return gate;

  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    // requireScope throws ForbiddenError when the session can't resolve a
    // tenant — render a friendly notice instead of bubbling to the global
    // error boundary which displays "Something went wrong".
    console.error("[reputation] requireScope failed:", err);
    return <ReputationFallback message="Sign in required." />;
  }

  const sp = await searchParams;
  const requestedIds = await parsePropertyFilter(sp, scope.orgId);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  const sourceFilter = parseSourceFilter(sp.source);
  const sentimentFilter = parseSentimentFilter(sp.sentiment);
  const showOlder = sp.showOlder === "1";

  let metrics: PortfolioReputationMetrics = EMPTY_METRICS;
  let feed: PortfolioReputationFeedItem[] = [];
  let loadError = false;
  // Track whether each sub-load failed so we can surface a real
  // "data load issue" banner. Previously the .catch wrappers swallowed
  // errors silently and the user saw the same "0 mentions" empty
  // state whether the data was genuinely empty or the loader crashed.
  let metricsFailed = false;
  let feedFailed = false;

  try {
    [metrics, feed] = await Promise.all([
      loadPortfolioReputationMetrics(scope.orgId, {
        propertyIds: effectiveIds,
      }).catch((err) => {
        console.error("[reputation] metrics load failed:", err);
        metricsFailed = true;
        return EMPTY_METRICS;
      }),
      loadPortfolioReputationFeed(scope.orgId, 50, {
        propertyIds: effectiveIds,
        source: sourceFilter,
        sentiment: sentimentFilter,
        includeOlder: showOlder,
      }).catch((err) => {
        console.error("[reputation] feed load failed:", err);
        feedFailed = true;
        return [] as PortfolioReputationFeedItem[];
      }),
    ]);
  } catch (err) {
    console.error("[reputation] Failed to load portfolio metrics:", err);
    loadError = true;
  }

  // Property list for the selector dropdown, gated to user's allowed set.
  const allProperties = await prisma.property
    .findMany({
      where: tenantWhere(scope),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
    .catch(() => [] as Array<{ id: string; name: string }>);
  const properties = visibleProperties(scope, allProperties);
  // Promote partial failures into the visible loadError flag so the
  // page header shows the data-issue banner instead of pretending
  // everything's fine.
  if (metricsFailed || feedFailed) loadError = true;

  const sentimentByKey = new Map(
    (metrics.sentimentBreakdown ?? []).map((s) => [s.sentiment, s.count]),
  );
  const positive = sentimentByKey.get("POSITIVE") ?? 0;
  const negative = sentimentByKey.get("NEGATIVE") ?? 0;
  const mixed = sentimentByKey.get("MIXED") ?? 0;
  const neutral = sentimentByKey.get("NEUTRAL") ?? 0;
  // Denominator for the sentiment split bar. Deliberately the sum of the
  // four classified buckets rather than metrics.totalMentions — a handful
  // of UNCLASSIFIED mentions (not yet scored) would otherwise leave a gap
  // in the bar that reads as a bug.
  const sentimentTotal = positive + negative + mixed + neutral;

  const propertyHealthSorted = [...(metrics.propertyHealth ?? [])].sort(
    (a, b) => {
      // Properties with negative mentions or low ratings first.
      const aRisk =
        a.negativeCount * 2 + (a.googleRating ? 5 - a.googleRating : 0);
      const bRisk =
        b.negativeCount * 2 + (b.googleRating ? 5 - b.googleRating : 0);
      return bRisk - aRisk;
    },
  );

  try {
    return (
      <div className="space-y-4">
        {accessDenied ? <PropertyAccessDeniedBanner /> : null}
        {loadError ? (
          <div className="rounded-[2px] border border-border bg-secondary px-4 py-3 text-sm text-foreground">
            <strong>Reputation data unavailable.</strong> The scanner tables may
            still be initializing — run a reputation scan from any property to
            seed the data. This page will display results once the first scan
            completes.
          </div>
        ) : null}

        <PageHeader
          eyebrow="Brand health"
          title="Reputation"
          description="Reviews and mentions across Google, Reddit, Yelp, and the open web — rolled up across every property."
          actions={
            <>
              {properties.length > 1 ? (
                <Suspense
                  fallback={
                    <div className="h-9 w-48 rounded-[2px] border border-border bg-secondary" />
                  }
                >
                  <PropertyMultiSelect
                    properties={properties}
                    orgId={scope.orgId}
                  />
                </Suspense>
              ) : null}
              <ReputationScanButton />
              <Link
                href="/portal/properties"
                className="text-xs font-medium text-foreground hover:text-primary"
              >
                Manage properties →
              </Link>
            </>
          }
        />

        {/* Unified inbox filter rail. Source + sentiment chips drive the
          server-side feed query via URL params, so views are bookmarkable
          (e.g. /portal/reputation?source=REDDIT&sentiment=NEGATIVE). */}
        <Suspense
          fallback={
            <div className="h-8 w-full rounded-[2px] bg-secondary animate-pulse" />
          }
        >
          <ReputationFilters
            sourceCounts={Object.fromEntries(
              (metrics.sourceBreakdown ?? []).map((s) => [s.source, s.count]),
            )}
            sentimentCounts={Object.fromEntries(
              (metrics.sentimentBreakdown ?? [])
                .filter((s) => s.sentiment !== "UNCLASSIFIED")
                .map((s) => [s.sentiment as Sentiment, s.count]),
            )}
          />
        </Suspense>

        {/* Compact metric strip — 4 essentials. Uses canonical KpiTile in
          its dense variant (same density used on the main portal + chatbot
          dashboards) instead of a bespoke half-weight tile, so this page
          stays visually consistent with the rest of the product. The audit
          called for dropping "Unreviewed" and "Properties tracked" tiles
          since they're secondary signals. */}
        <section
          aria-label="Reputation KPIs"
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
        >
          <KpiTile
            density="dense"
            label="Google rating"
            value={
              metrics.googleAvgRating != null &&
              safeNum(metrics.googleAvgRating) > 0 ? (
                <span className="inline-flex items-baseline gap-2">
                  <span className="font-semibold">
                    {fmtRating(metrics.googleAvgRating)}
                  </span>
                  <RatingStars rating={safeNum(metrics.googleAvgRating)} />
                </span>
              ) : (
                "—"
              )
            }
            hint={
              safeNum(metrics.googleReviewCount) > 0
                ? `${fmtInt(metrics.googleReviewCount)} reviews`
                : "No reviews yet"
            }
            icon={<Star className="h-3.5 w-3.5" />}
          />
          <KpiTile
            density="dense"
            label="Total mentions"
            value={fmtInt(metrics.totalMentions)}
            hint={mentionsTrendHint(metrics)}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          />
          <KpiTile
            density="dense"
            label="Negative share"
            value={
              metrics.negativePct != null
                ? `${safeNum(metrics.negativePct)}%`
                : "—"
            }
            hint={`${fmtInt(negative)} negative`}
            icon={<AlertCircle className="h-3.5 w-3.5" />}
          />
          <KpiTile
            density="dense"
            label="Flagged"
            value={fmtInt(metrics.flaggedCount)}
            hint="Marked for follow-up"
            icon={<Flag className="h-3.5 w-3.5" />}
          />
        </section>

        {/* Sentiment split — one glanceable bar showing how mentions break
          down by sentiment, so the page reads as "brand health" instead of
          a wall of neutral numbers. Legend doubles as a shortcut into the
          same ?sentiment= filter the chips above drive, so clicking
          "Negative" jumps straight to the negative feed. */}
        {sentimentTotal > 0 ? (
          <SentimentSplitBar
            positive={positive}
            neutral={neutral}
            mixed={mixed}
            negative={negative}
            total={sentimentTotal}
            activeSentiment={sentimentFilter}
            currentParams={{
              property: sp.property,
              properties: sp.properties,
              source: sp.source,
              showOlder: sp.showOlder,
            }}
          />
        ) : null}

        {/* Recent mentions — the centerpiece. Hoisted above the analytics
          drawer so the operator sees today's signal first. Sort order is
          publishedAt DESC in loadPortfolioReputationFeed. */}
        <DashboardSection
          title="Recent mentions"
          eyebrow={showOlder ? "All history" : "Last 90 days"}
          description={
            showOlder
              ? "All mentions across every property, newest first"
              : "Mentions from the last 90 days, newest first"
          }
          action={
            <RecentToggleLink
              showOlder={showOlder}
              currentParams={{
                property: sp.property,
                properties: sp.properties,
                source: sp.source,
                sentiment: sp.sentiment,
              }}
            />
          }
        >
          {feed.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {showOlder
                ? "No mentions yet. Run a scan from any property to seed the feed."
                : 'No mentions in the last 90 days. Use "Show older" to view archived mentions.'}
            </p>
          ) : (
            <ul className="divide-y divide-border -my-2">
              {feed.map((m) => (
                <FeedRow key={m.id} mention={m} />
              ))}
            </ul>
          )}
        </DashboardSection>

        {/* Analytics drawer — historical charts + property health table.
          Collapsed by default so Recent Mentions stays the focus. */}
        <details className="group rounded-[2px] border border-border bg-card">
          <summary className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[0.14em] uppercase font-semibold text-muted-foreground mb-0.5">
                Historical
              </div>
              <h2
                className="text-sm font-semibold tracking-tight text-foreground leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Show analytics
              </h2>
            </div>
            <span className="text-[11px] text-muted-foreground group-open:hidden">
              Trends, sources, properties →
            </span>
            <span className="text-[11px] text-muted-foreground hidden group-open:inline">
              Hide
            </span>
          </summary>

          <div className="border-t border-border px-5 py-4 space-y-4">
            {/* One-line property summary (single tenant common case). For
              multi-property tenants this renders one tight row per
              property — no header sprawl. */}
            {propertyHealthSorted.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No properties yet. Add one to start scanning reputation.
              </p>
            ) : (
              <ul className="space-y-1">
                {propertyHealthSorted.map((p) => (
                  <PropertySummaryRow key={p.propertyId} property={p} />
                ))}
              </ul>
            )}

            {/* 12-week sentiment trend — compact, header inline instead of
              wrapped in another Card to avoid double-nesting. */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Sentiment over time
                </h3>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Last 12 weeks
                </span>
              </div>
              <div className="h-20">
                <SentimentSparkline weeks={metrics.weeklySentiment ?? []} />
              </div>
            </div>

            {/* Sentiment + sources + monthly volume — tightened grid */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <AnalyticsBlock title="Sentiment" eyebrow="Across all mentions">
                {metrics.totalMentions === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No sentiment yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <SentimentBar
                      label="Positive"
                      count={positive}
                      total={metrics.totalMentions}
                      tone="bg-[#24a148]"
                    />
                    <SentimentBar
                      label="Negative"
                      count={negative}
                      total={metrics.totalMentions}
                      tone="bg-foreground"
                    />
                    <SentimentBar
                      label="Mixed"
                      count={mixed}
                      total={metrics.totalMentions}
                      tone="bg-muted-foreground/50"
                    />
                    <SentimentBar
                      label="Neutral"
                      count={neutral}
                      total={metrics.totalMentions}
                      tone="bg-muted-foreground/50"
                    />
                  </div>
                )}
              </AnalyticsBlock>

              <AnalyticsBlock title="By source" eyebrow="Volume by platform">
                <SourceBars
                  emptyMessage="No mentions yet."
                  limit={6}
                  rows={(metrics.sourceBreakdown ?? []).map((row) => ({
                    id: String(row.source),
                    label: sourceLabel(row.source as MentionSource, ""),
                    value: safeNum(row.count),
                    leading: (
                      <SourceLogo
                        source={row.source as MentionSource}
                        url=""
                        className="h-4 w-4"
                      />
                    ),
                  }))}
                />
              </AnalyticsBlock>

              <AnalyticsBlock title="Monthly volume" eyebrow="Last 6 months">
                <MonthlyVolume data={metrics.monthlyVolume} />
              </AnalyticsBlock>
            </section>
          </div>
        </details>
      </div>
    );
  } catch (err) {
    // Render-time crash — log full diagnostic info + surface the actual
    // error in the rendered fallback so we can identify the exact field
    // that broke without round-tripping through Vercel logs. Once the
    // page is reliably stable this can be reverted to the user-friendly
    // copy.
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const firstStackLine = stack?.split("\n").slice(0, 4).join("\n") ?? "";
    console.error("[reputation] render crashed:", {
      message,
      stack,
      orgId: scope.orgId,
      metricsShape: {
        totalMentions: typeof metrics?.totalMentions,
        sourceBreakdownCount: metrics?.sourceBreakdown?.length,
        sentimentBreakdownCount: metrics?.sentimentBreakdown?.length,
        propertyHealthCount: metrics?.propertyHealth?.length,
        monthlyVolumeCount: metrics?.monthlyVolume?.length,
        googleAvgRatingType: typeof metrics?.googleAvgRating,
        feedCount: feed?.length,
        firstFeedItem: feed?.[0],
        firstPropertyHealth: metrics?.propertyHealth?.[0],
      },
    });
    return (
      <ReputationFallback
        message="Reputation view ran into an issue rendering."
        diagnostic={{
          error: message,
          stack: firstStackLine,
          metricsCount: metrics?.totalMentions ?? 0,
          feedCount: feed?.length ?? 0,
        }}
      />
    );
  }
}
