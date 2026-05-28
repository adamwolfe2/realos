import "server-only";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import type { MentionSource, Prisma, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Portfolio-level reputation aggregates. Mirrors lib/reputation/aggregate.ts
// but rolls up across every property in an org so the new /portal/reputation
// page can show a single Reputation health view.
//
// The per-property metrics view at /portal/properties/[id]?tab=reputation
// stays as the drill-down. This portfolio view gives operators a one-click
// answer to "how does my brand look across all properties?".
// ---------------------------------------------------------------------------

export type PortfolioReputationMetrics = {
  totalMentions: number;
  newLast30d: number;
  // Prior-period new-mention count (days 30-60 ago) so the dashboard can
  // render a "vs prior 30d" delta arrow next to newLast30d.
  newPrior30d: number;
  negativePct: number | null;
  unreviewedCount: number;
  flaggedCount: number;

  // Aggregate Google review across the portfolio. We treat each property as
  // a weighted average by its review count.
  googleAvgRating: number | null;
  googleReviewCount: number;

  sourceBreakdown: Array<{ source: MentionSource; count: number }>;
  sentimentBreakdown: Array<{ sentiment: Sentiment | "UNCLASSIFIED"; count: number }>;

  // Properties ranked by review health, so operators can see the worst
  // offenders at a glance.
  propertyHealth: Array<{
    propertyId: string;
    propertyName: string;
    googleRating: number | null;
    googleReviewCount: number;
    totalMentions: number;
    negativeCount: number;
    unreviewedCount: number;
  }>;

  // 6-month monthly volume across the whole portfolio.
  monthlyVolume: Array<{ month: string; count: number; negative: number }>;

  // 12-week sentiment trend, oldest → newest. Powers the
  // <SentimentSparkline /> in the unified inbox header.
  weeklySentiment: Array<{
    weekStart: string; // ISO date (Monday)
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  }>;
};

export async function loadPortfolioReputationMetrics(
  orgId: string,
  options: { propertyIds?: string[] | null } = {}
): Promise<PortfolioReputationMetrics> {
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prior30dStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  // 12-week trend window, anchored to the most recent Monday so the bars
  // line up to "this week" on the right.
  const twelveWeeksAgo = new Date(now);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 12 * 7);

  // Property gate, two layers:
  //   1. Marketable lifecycle filter — drops IMPORTED (curation queue),
  //      EXCLUDED (parking lots, storage, etc.), and ARCHIVED rows.
  //      Without this, SG Real Estate's 127 AppFolio rows ALL surfaced
  //      on the Reputation page even though only ACTIVE ones were
  //      operator-approved. Resolves the bug where the property-health
  //      table showed every imported sub-record with "—" Google rating
  //      and zeroed mention counts.
  //   2. If a restricted user (UserPropertyAccess) or a URL multi-select
  //      narrows the view further, propagate it through every count.
  //
  // We resolve the eligible property ids ONCE up top, then scope every
  // mention count + property findMany to that set. This means a mention
  // belonging to an IMPORTED property is excluded from the totals too —
  // those properties shouldn't contribute to brand-health KPIs until the
  // operator approves them.
  const eligibleProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(orgId),
    select: { id: true },
  });
  let eligibleIds = eligibleProperties.map((p) => p.id);
  if (options.propertyIds && options.propertyIds.length > 0) {
    const filter = new Set(options.propertyIds);
    eligibleIds = eligibleIds.filter((id) => filter.has(id));
  }
  // Defense: a fresh org with zero marketable properties shouldn't crash
  // the query. Use a sentinel that matches nothing.
  const propertyClause =
    eligibleIds.length > 0
      ? { propertyId: { in: eligibleIds } }
      : { propertyId: "__no_marketable_properties__" };
  const where = { orgId, ...propertyClause };

  const [
    totalMentions,
    newLast30d,
    newPrior30d,
    unreviewedCount,
    flaggedCount,
    sentimentRows,
    sourceRows,
    properties,
    propertyMentions,
    monthlyRaw,
    weeklyRaw,
  ] = await Promise.all([
    prisma.propertyMention.count({ where }),
    prisma.propertyMention.count({
      where: { ...where, createdAt: { gte: last30d } },
    }),
    prisma.propertyMention.count({
      where: {
        ...where,
        createdAt: { gte: prior30dStart, lt: last30d },
      },
    }),
    prisma.propertyMention.count({
      where: { ...where, reviewedByUserId: null },
    }),
    prisma.propertyMention.count({
      where: { ...where, flagged: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["sentiment"],
      where,
      _count: { _all: true },
    }),
    prisma.propertyMention.groupBy({
      by: ["source"],
      where,
      _count: { _all: true },
    }),
    prisma.property.findMany({
      // Property findMany now respects both the marketable lifecycle gate
      // (so we never list IMPORTED / EXCLUDED / ARCHIVED rows in the
      // property-health table) AND any optional propertyIds narrowing.
      // The eligibleIds set above already encodes both, so we just use it.
      where: {
        orgId,
        id: { in: eligibleIds.length > 0 ? eligibleIds : ["__none__"] },
      },
      select: {
        id: true,
        name: true,
        googleAggRating: true,
        googleAggReviewCount: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.propertyMention.groupBy({
      by: ["propertyId", "sentiment"],
      where,
      _count: { _all: true },
    }),
    prisma.propertyMention.findMany({
      where: {
        ...where,
        OR: [
          { publishedAt: { gte: sixMonthsAgo } },
          { publishedAt: null, createdAt: { gte: sixMonthsAgo } },
        ],
      },
      select: { publishedAt: true, createdAt: true, sentiment: true },
    }),
    // Sentiment trend — last 12 weeks. We pull the same shape as
    // monthlyRaw but with a tighter window so we can bucket by week.
    prisma.propertyMention.findMany({
      where: {
        ...where,
        OR: [
          { publishedAt: { gte: twelveWeeksAgo } },
          { publishedAt: null, createdAt: { gte: twelveWeeksAgo } },
        ],
      },
      select: { publishedAt: true, createdAt: true, sentiment: true },
    }),
  ]);

  // Sentiment breakdown
  const sentimentBreakdown = sentimentRows.map((s) => ({
    sentiment: s.sentiment ?? ("UNCLASSIFIED" as const),
    count: s._count._all,
  }));
  const negativeCount =
    sentimentBreakdown.find((s) => s.sentiment === "NEGATIVE")?.count ?? 0;
  const negativePct =
    totalMentions > 0
      ? Math.round((negativeCount / totalMentions) * 100)
      : null;

  // Source breakdown
  const sourceBreakdown = sourceRows.map((r) => ({
    source: r.source,
    count: r._count._all,
  }));

  // Weighted Google rating across portfolio
  let weightedSum = 0;
  let weightedCount = 0;
  for (const p of properties) {
    if (
      typeof p.googleAggRating === "number" &&
      typeof p.googleAggReviewCount === "number" &&
      p.googleAggReviewCount > 0
    ) {
      weightedSum += p.googleAggRating * p.googleAggReviewCount;
      weightedCount += p.googleAggReviewCount;
    }
  }
  const googleAvgRating =
    weightedCount > 0 ? Math.round((weightedSum / weightedCount) * 10) / 10 : null;
  const googleReviewCount = weightedCount;

  // Per-property health rollup
  const totalsByProperty = new Map<string, number>();
  const negativesByProperty = new Map<string, number>();
  for (const row of propertyMentions) {
    totalsByProperty.set(
      row.propertyId,
      (totalsByProperty.get(row.propertyId) ?? 0) + row._count._all
    );
    if (row.sentiment === "NEGATIVE") {
      negativesByProperty.set(
        row.propertyId,
        (negativesByProperty.get(row.propertyId) ?? 0) + row._count._all
      );
    }
  }

  const unreviewedByProperty = new Map<string, number>();
  if (totalsByProperty.size > 0) {
    const propIds = Array.from(totalsByProperty.keys());
    const unreviewed = await prisma.propertyMention.groupBy({
      by: ["propertyId"],
      where: { orgId, propertyId: { in: propIds }, reviewedByUserId: null },
      _count: { _all: true },
    });
    for (const u of unreviewed) {
      unreviewedByProperty.set(u.propertyId, u._count._all);
    }
  }

  const propertyHealth = properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    googleRating: typeof p.googleAggRating === "number" ? p.googleAggRating : null,
    googleReviewCount: p.googleAggReviewCount ?? 0,
    totalMentions: totalsByProperty.get(p.id) ?? 0,
    negativeCount: negativesByProperty.get(p.id) ?? 0,
    unreviewedCount: unreviewedByProperty.get(p.id) ?? 0,
  }));

  // Monthly volume — last 6 months
  const monthKeys: string[] = [];
  const cursor = new Date(sixMonthsAgo);
  for (let i = 0; i < 6; i++) {
    const label = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(label);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const monthMap = new Map<string, { count: number; negative: number }>();
  for (const k of monthKeys) monthMap.set(k, { count: 0, negative: 0 });
  for (const r of monthlyRaw) {
    const d = r.publishedAt ?? r.createdAt;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthMap.get(k);
    if (!bucket) continue;
    bucket.count++;
    if (r.sentiment === "NEGATIVE") bucket.negative++;
  }
  const monthlyVolume = monthKeys.map((k) => ({
    month: k,
    count: monthMap.get(k)?.count ?? 0,
    negative: monthMap.get(k)?.negative ?? 0,
  }));

  // Weekly sentiment trend — anchor 12 bars on the most recent Monday so
  // "this week" sits flush right. We bucket on publishedAt when known,
  // otherwise createdAt (matches the monthly volume logic above for
  // consistency).
  const weeklyBuckets = build12WeekBuckets(now);
  for (const r of weeklyRaw) {
    const d = r.publishedAt ?? r.createdAt;
    const key = mondayKey(d);
    const bucket = weeklyBuckets.get(key);
    if (!bucket) continue;
    switch (r.sentiment) {
      case "POSITIVE":
        bucket.positive++;
        break;
      case "NEGATIVE":
        bucket.negative++;
        break;
      case "MIXED":
        bucket.mixed++;
        break;
      case "NEUTRAL":
      default:
        // Unclassified rows (sentiment === null) get bucketed as neutral
        // for the visual — the inbox already exposes them by source.
        bucket.neutral++;
        break;
    }
  }
  const weeklySentiment = Array.from(weeklyBuckets.entries()).map(
    ([weekStart, b]) => ({ weekStart, ...b }),
  );

  return {
    totalMentions,
    newLast30d,
    newPrior30d,
    negativePct,
    unreviewedCount,
    flaggedCount,
    googleAvgRating,
    googleReviewCount,
    sourceBreakdown,
    sentimentBreakdown,
    propertyHealth,
    monthlyVolume,
    weeklySentiment,
  };
}

// ---------------------------------------------------------------------------
// Weekly bucket helpers.
// ---------------------------------------------------------------------------

function mondayKey(date: Date): string {
  // Convert any Date into the ISO date (YYYY-MM-DD) of the Monday of that
  // week. JS getDay returns 0 for Sunday, 1 for Monday, …, 6 for Saturday.
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // shift Sunday to be 6 days after Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  // ISO date — drop time + tz so the key is stable across timezones.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function build12WeekBuckets(
  now: Date,
): Map<string, { positive: number; neutral: number; negative: number; mixed: number }> {
  const buckets = new Map<
    string,
    { positive: number; neutral: number; negative: number; mixed: number }
  >();
  // Walk 12 Mondays backwards from the current week's Monday.
  const cursor = new Date(now);
  const day = cursor.getDay();
  cursor.setDate(cursor.getDate() - (day === 0 ? 6 : day - 1));
  cursor.setHours(0, 0, 0, 0);
  const keys: string[] = [];
  for (let i = 0; i < 12; i++) {
    keys.push(mondayKey(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }
  // Reverse so oldest is first, newest last (matches the sparkline order).
  keys.reverse();
  for (const k of keys) {
    buckets.set(k, { positive: 0, neutral: 0, negative: 0, mixed: 0 });
  }
  return buckets;
}

export type PortfolioReputationFeedItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  source: MentionSource;
  title: string | null;
  excerpt: string;
  authorName: string | null;
  publishedAt: Date | null;
  sentiment: Sentiment | null;
  sentimentConfidence: number | null;
  themes: string[]; // PropertyMention.topics surfaced for the UI
  rating: number | null;
  sourceUrl: string;
  flagged: boolean;
  reviewed: boolean;
};

// Default recency cutoff for the "Recent mentions" portfolio feed. Norman
// reported (#1) that a 4-year-old Yelp review from a closed business was
// surfacing as the 4th recent mention. The KPI strip already shows lifetime
// totals; the recent feed should be strictly recent. 12 months matches what
// surfaces in monthly reports and what owners think of as "recent".
const RECENT_FEED_DEFAULT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export async function loadPortfolioReputationFeed(
  orgId: string,
  limit = 30,
  options: {
    propertyIds?: string[] | null;
    source?: MentionSource | null;
    sentiment?: Sentiment | null;
    /** When true, ignore the default 12-month cutoff and surface older
     *  mentions. Wired to the "Show older" toggle on /portal/reputation. */
    includeOlder?: boolean;
  } = {}
): Promise<PortfolioReputationFeedItem[]> {
  // Same lifecycle gate as loadPortfolioReputationMetrics: skip mentions
  // attached to non-marketable properties so the feed doesn't surface
  // reviews for a property the operator hasn't approved yet.
  const eligibleProperties = await prisma.property.findMany({
    where: marketablePropertyWhere(orgId),
    select: { id: true },
  });
  let eligibleIds = eligibleProperties.map((p) => p.id);
  if (options.propertyIds && options.propertyIds.length > 0) {
    const filter = new Set(options.propertyIds);
    eligibleIds = eligibleIds.filter((id) => filter.has(id));
  }
  if (eligibleIds.length === 0) return [];

  const where: Prisma.PropertyMentionWhereInput = {
    orgId,
    propertyId: { in: eligibleIds },
  };
  if (options.source) where.source = options.source;
  if (options.sentiment) where.sentiment = options.sentiment;

  // Recency gate. Default: only mentions whose publishedAt (or
  // ingestion-time fallback) is within the last 12 months. The fallback
  // matters because some scraped sources (older Yelp pages, archived
  // Tavily hits) land without a publishedAt — without a fallback those
  // would be dropped entirely. Using createdAt as the fallback keeps
  // fresh-but-undated finds in the feed while still cutting off ancient
  // re-scrapes of dead pages.
  if (!options.includeOlder) {
    const cutoff = new Date(Date.now() - RECENT_FEED_DEFAULT_MAX_AGE_MS);
    where.OR = [
      { publishedAt: { gte: cutoff } },
      { AND: [{ publishedAt: null }, { createdAt: { gte: cutoff } }] },
    ];
  }

  // Order by publishedAt DESC, then createdAt DESC as the tie-breaker for
  // undated mentions. The previous tie-breaker (lastSeenAt) was the root
  // cause of #1 — a re-scrape of a closed Yelp page bumped lastSeenAt to
  // today and pushed 4-year-old reviews into the recent feed. createdAt
  // is the ingestion timestamp, which is the right "second sort" for
  // undated rows. id DESC stays as a final deterministic break.
  const rows = await prisma.propertyMention.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      propertyId: true,
      source: true,
      sourceUrl: true,
      title: true,
      excerpt: true,
      authorName: true,
      publishedAt: true,
      rating: true,
      sentiment: true,
      sentimentConfidence: true,
      topics: true,
      flagged: true,
      reviewedByUserId: true,
      property: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    propertyName: r.property?.name ?? "Property",
    source: r.source,
    sourceUrl: r.sourceUrl,
    title: r.title,
    excerpt: r.excerpt,
    authorName: r.authorName,
    publishedAt: r.publishedAt,
    sentiment: r.sentiment,
    sentimentConfidence: r.sentimentConfidence,
    themes: normalizeThemes(r.topics),
    rating: r.rating,
    flagged: r.flagged,
    reviewed: r.reviewedByUserId !== null,
  }));
}

// PropertyMention.topics is Json — at runtime it's always a string[] (set
// that way by lib/reputation/analyze.ts), but Prisma types it as JsonValue.
// This helper centralizes the narrowing + defensive caps so the dashboard
// never tries to render { foo: 'bar' } as a theme chip.
function normalizeThemes(topics: unknown): string[] {
  if (!Array.isArray(topics)) return [];
  return topics
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    .slice(0, 5);
}
