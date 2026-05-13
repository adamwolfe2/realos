import type { Metadata } from "next";
import Link from "next/link";
import { Star, AlertTriangle, MessageCircle, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
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
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { PageHeader } from "@/components/admin/page-header";
import { SourceLogo } from "@/components/portal/reputation/source-logo";
import { sourceLabel } from "@/components/portal/reputation/source-label";
import type { MentionSource, Sentiment } from "@prisma/client";

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

const SENTIMENT_TONE: Record<Sentiment, string> = {
  POSITIVE: "bg-primary/10 text-primary border-primary/30",
  NEUTRAL: "bg-muted text-muted-foreground border-border",
  NEGATIVE: "bg-muted text-muted-foreground border-border",
  MIXED: "bg-muted/40 text-foreground border-border",
};

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: "Positive",
  NEUTRAL: "Neutral",
  NEGATIVE: "Negative",
  MIXED: "Mixed",
};

function truncate(input: string | null | undefined, max = 220): string {
  if (!input) return "";
  const s = String(input).trim().replace(/\s+/g, " ");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Defensive number → display helper. Catches Decimal-typed values from
// Prisma (which lack `.toLocaleString` formatting consistent with Number)
// and stray nulls so a single bad row can't blank the whole page.
function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v && typeof v === "object" && "toString" in v) {
    const n = Number((v as { toString: () => string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function fmtInt(v: unknown): string {
  return safeNum(v).toLocaleString();
}

function fmtRating(v: unknown): string {
  if (v == null) return "—";
  const n = safeNum(v);
  return n > 0 ? n.toFixed(1) : "—";
}

const EMPTY_METRICS: PortfolioReputationMetrics = {
  totalMentions: 0,
  newLast30d: 0,
  negativePct: null,
  unreviewedCount: 0,
  flaggedCount: 0,
  googleAvgRating: null,
  googleReviewCount: 0,
  sourceBreakdown: [],
  sentimentBreakdown: [],
  propertyHealth: [],
  monthlyVolume: [],
};

export default async function PortfolioReputationPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; properties?: string }>;
}) {
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
  const requestedIds = parsePropertyFilter(sp);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);

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
      loadPortfolioReputationFeed(scope.orgId, 30, {
        propertyIds: effectiveIds,
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
    (metrics.sentimentBreakdown ?? []).map((s) => [s.sentiment, s.count])
  );
  const positive = sentimentByKey.get("POSITIVE") ?? 0;
  const negative = sentimentByKey.get("NEGATIVE") ?? 0;
  const mixed = sentimentByKey.get("MIXED") ?? 0;
  const neutral = sentimentByKey.get("NEUTRAL") ?? 0;

  const propertyHealthSorted = [...(metrics.propertyHealth ?? [])].sort(
    (a, b) => {
      // Properties with negative mentions or low ratings first.
      const aRisk =
        a.negativeCount * 2 + (a.googleRating ? 5 - a.googleRating : 0);
      const bRisk =
        b.negativeCount * 2 + (b.googleRating ? 5 - b.googleRating : 0);
      return bRisk - aRisk;
    }
  );

  try {
    return (
    <div className="space-y-4">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      {loadError ? (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          <strong>Reputation data unavailable.</strong> The scanner tables may still be
          initializing — run a reputation scan from any property to seed the data. This
          page will display results once the first scan completes.
        </div>
      ) : null}

      <PageHeader
        eyebrow="Brand health"
        title="Reputation"
        description="Reviews and mentions across Google, Reddit, Yelp, and the open web — rolled up across every property."
        actions={
          <>
            {properties.length > 1 ? (
              <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
            ) : null}
            <Link
              href="/portal/properties"
              className="text-xs font-medium text-foreground hover:text-primary"
            >
              Manage properties →
            </Link>
          </>
        }
      />


      {/* Top KPIs */}
      <section
        aria-label="Reputation KPIs"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <KpiTile
          label="Avg Google rating"
          value={fmtRating(metrics.googleAvgRating)}
          hint={
            safeNum(metrics.googleReviewCount) > 0
              ? `${fmtInt(metrics.googleReviewCount)} reviews`
              : "No reviews yet"
          }
          icon={<Star className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Total mentions"
          value={fmtInt(metrics.totalMentions)}
          hint={`${fmtInt(metrics.newLast30d)} new in 30d`}
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Negative share"
          value={metrics.negativePct != null ? `${safeNum(metrics.negativePct)}%` : "—"}
          hint={`${fmtInt(negative)} negative mentions`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Unreviewed"
          value={fmtInt(metrics.unreviewedCount)}
          hint="Need your attention"
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Flagged"
          value={fmtInt(metrics.flaggedCount)}
          hint="Marked for follow-up"
          icon={<Flag className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Properties tracked"
          value={fmtInt(metrics.propertyHealth?.length ?? 0)}
          hint="Each scanned independently"
          icon={<Star className="h-3.5 w-3.5" />}
        />
      </section>

      {/* Sentiment + sources + monthly volume */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DashboardSection
          title="Sentiment"
          eyebrow="Across all mentions"
          description="What people actually feel"
        >
          <div className="space-y-1.5">
            <SentimentBar
              label="Positive"
              count={positive}
              total={metrics.totalMentions}
              tone="bg-primary"
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
              tone="bg-primary/50"
            />
            <SentimentBar
              label="Neutral"
              count={neutral}
              total={metrics.totalMentions}
              tone="bg-muted-foreground/50"
            />
          </div>
        </DashboardSection>

        <DashboardSection
          title="By source"
          eyebrow="Where the chatter lives"
          description="Volume by platform"
        >
          {(metrics.sourceBreakdown ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No mentions yet. Run a scan from any property.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(metrics.sourceBreakdown ?? [])
                .slice()
                .sort((a, b) => safeNum(b.count) - safeNum(a.count))
                .map((row) => (
                  <li
                    key={String(row.source)}
                    className="flex items-center justify-between gap-2 py-1"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <SourceLogo
                        source={row.source as MentionSource}
                        url=""
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {sourceLabel(row.source as MentionSource, "")}
                      </span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {fmtInt(row.count)}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title="Monthly volume"
          eyebrow="Last 6 months"
          description="Mentions per month, with negative shaded"
        >
          <MonthlyVolume data={metrics.monthlyVolume} />
        </DashboardSection>
      </section>

      {/* Property health table */}
      <DashboardSection
        title="Property health"
        eyebrow="Risk-sorted"
        description="Worst signals at the top so you know where to focus"
      >
        {propertyHealthSorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No properties yet. Add one to start scanning reputation.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-[640px]">
              <thead className="text-left text-[10px] tracking-widest uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 md:px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium text-right">Google</th>
                  <th className="px-2 py-2 font-medium text-right">Reviews</th>
                  <th className="px-2 py-2 font-medium text-right">Mentions</th>
                  <th className="px-2 py-2 font-medium text-right">Negative</th>
                  <th className="px-2 py-2 font-medium text-right">Unreviewed</th>
                  <th className="px-2 py-2 font-medium text-right" />
                </tr>
              </thead>
              <tbody>
                {propertyHealthSorted.map((p) => (
                  <tr
                    key={p.propertyId}
                    className="border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 md:px-2 py-2.5 font-medium text-foreground">
                      {p.propertyName ?? "Property"}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {p.googleRating != null && safeNum(p.googleRating) > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current text-primary" />
                          {fmtRating(p.googleRating)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">
                      {fmtInt(p.googleReviewCount)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {fmtInt(p.totalMentions)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {safeNum(p.negativeCount) > 0 ? (
                        <span className="text-muted-foreground font-medium">
                          {fmtInt(p.negativeCount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {safeNum(p.unreviewedCount) > 0 ? (
                        <span className="font-medium">
                          {fmtInt(p.unreviewedCount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link
                        href={`/portal/properties/${p.propertyId}?tab=reputation`}
                        className="text-xs font-medium text-foreground hover:text-primary whitespace-nowrap"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>

      {/* Recent mentions feed */}
      <DashboardSection
        title="Recent mentions"
        eyebrow="Latest 30"
        description="The latest 30 across every property"
      >
        {feed.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No mentions yet. Run a scan from any property to seed the feed.
          </p>
        ) : (
          <ul className="divide-y divide-border -my-2">
            {feed.map((m) => (
              <FeedRow key={m.id} mention={m} />
            ))}
          </ul>
        )}
      </DashboardSection>
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

function SentimentBar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-foreground">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {count.toLocaleString()} · {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ReputationFallback({
  message,
  diagnostic,
}: {
  message: string;
  diagnostic?: {
    error: string;
    stack: string;
    metricsCount: number;
    feedCount: number;
  };
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Brand health" title="Reputation" />
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
        <p className="font-semibold">Reputation view temporarily unavailable.</p>
        <p className="mt-1 text-xs leading-snug">{message}</p>
        <p className="mt-2 text-xs">
          You can still drill into reviews per property at{" "}
          <Link
            href="/portal/properties"
            className="underline font-medium"
          >
            Properties
          </Link>{" "}
          → choose a property → Reputation tab.
        </p>
      </div>

      {/* Diagnostic block — surfaces the actual error so we can debug from
          a screenshot instead of round-tripping through Vercel logs. Drop
          this once the page is reliably stable for two consecutive deploys. */}
      {diagnostic ? (
        <details
          open
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"
        >
          <summary className="cursor-pointer font-semibold">
            Diagnostic — share with engineering
          </summary>
          <div className="mt-2 space-y-2">
            <div>
              <span className="font-semibold">Error: </span>
              <code className="font-mono break-all">{diagnostic.error}</code>
            </div>
            <div>
              <span className="font-semibold">Data: </span>
              <code className="font-mono">
                {diagnostic.metricsCount} mentions · {diagnostic.feedCount}{" "}
                feed items
              </code>
            </div>
            {diagnostic.stack ? (
              <div>
                <span className="font-semibold">Stack: </span>
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] font-mono opacity-80">
                  {diagnostic.stack}
                </pre>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function MonthlyVolume({
  data,
}: {
  data: Array<{ month: string; count: number; negative: number }>;
}) {
  const safeData = (data ?? []).map((d) => ({
    month: String(d?.month ?? ""),
    count: safeNum(d?.count),
    negative: safeNum(d?.negative),
  }));
  const max = Math.max(1, ...safeData.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d) => {
        const height = (d.count / max) * 100;
        const negPct = d.count > 0 ? (d.negative / d.count) * 100 : 0;
        return (
          <div
            key={d.month}
            className="flex-1 flex flex-col items-center gap-1 group"
            title={`${d.month}: ${d.count} (${d.negative} negative)`}
          >
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-slate-200 group-hover:bg-slate-300 rounded-t-sm relative transition-colors"
                style={{ height: `${Math.max(height, 4)}%` }}
              >
                {d.negative > 0 ? (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-muted-foreground/70 rounded-t-sm"
                    style={{ height: `${negPct}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {d.month.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FeedRow({ mention }: { mention: PortfolioReputationFeedItem }) {
  // Defensive normalization. Audit found this row was the most likely
  // crash site — a single malformed mention should NOT take down the
  // whole page. Coerce every field to a safe type before rendering.
  const safeUrl = typeof mention.sourceUrl === "string" ? mention.sourceUrl : "";
  const propertyName = mention.propertyName ?? "Property";
  const propertyId = mention.propertyId ?? "";
  const sentiment = mention.sentiment;
  const sentimentTone = sentiment ? SENTIMENT_TONE[sentiment] : "";
  const sentimentLabel = sentiment ? SENTIMENT_LABEL[sentiment] : "";
  const ratingNum = mention.rating != null ? safeNum(mention.rating) : null;
  const when = mention.publishedAt instanceof Date ? mention.publishedAt : null;

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <SourceLogo source={mention.source} url={safeUrl} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5 flex-wrap">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
                {sourceLabel(mention.source, safeUrl)}
              </span>
              <span aria-hidden="true" className="text-muted-foreground">·</span>
              {propertyId ? (
                <Link
                  href={`/portal/properties/${propertyId}?tab=reputation`}
                  className="text-xs font-medium text-foreground hover:text-primary truncate"
                >
                  {propertyName}
                </Link>
              ) : (
                <span className="text-xs font-medium text-foreground truncate">
                  {propertyName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {ratingNum != null && ratingNum > 0 ? (
                <span className="inline-flex items-center gap-0.5 text-xs text-foreground">
                  <Star className="h-3 w-3 fill-current text-primary" />
                  {ratingNum.toFixed(1)}
                </span>
              ) : null}
              {sentiment && sentimentTone ? (
                <span
                  className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${sentimentTone}`}
                >
                  {sentimentLabel}
                </span>
              ) : null}
              {mention.flagged ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-foreground">
                  <Flag className="h-3 w-3" />
                </span>
              ) : null}
            </div>
          </div>
          {mention.title ? (
            <p className="text-xs font-medium text-foreground mb-0.5">
              {String(mention.title)}
            </p>
          ) : null}
          {/* Full mention body. Was truncate(220) + line-clamp-2 which
              hid most of the actual review/post — operators couldn't
              read what visitors were saying without clicking through.
              whitespace-pre-line preserves Reddit-style paragraph
              breaks. line-clamp-6 caps very long Reddit threads while
              still showing 5-6x more content than the old snippet. */}
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-6">
            {String(mention.excerpt ?? "")}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {mention.authorName ? (
              <>
                <span className="truncate max-w-[120px]">{String(mention.authorName)}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {when ? (
              <span>{formatDistanceToNow(when, { addSuffix: true })}</span>
            ) : null}
            {safeUrl ? (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground underline-offset-2 hover:underline"
                >
                  View source
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
