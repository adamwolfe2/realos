import "server-only";
import { prisma } from "@/lib/db";
import { propertyIdsToWhere } from "@/lib/tenancy/property-filter";
import type { MentionSource, Sentiment } from "@prisma/client";

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
};

export async function loadPortfolioReputationMetrics(
  orgId: string,
  options: { propertyIds?: string[] | null } = {}
): Promise<PortfolioReputationMetrics> {
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  // Property gate: if a restricted user (UserPropertyAccess) or a URL
  // multi-select narrows the view, propagate it through every count.
  const propertyClause = propertyIdsToWhere(options.propertyIds ?? null);
  const where = { orgId, ...propertyClause };

  const [
    totalMentions,
    newLast30d,
    unreviewedCount,
    flaggedCount,
    sentimentRows,
    sourceRows,
    properties,
    propertyMentions,
    monthlyRaw,
  ] = await Promise.all([
    prisma.propertyMention.count({ where }),
    prisma.propertyMention.count({
      where: { ...where, createdAt: { gte: last30d } },
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
      // Property findMany also gates on the propertyIds filter so the
      // weighted Google rating reflects only the visible scope.
      where: {
        orgId,
        ...(options.propertyIds && options.propertyIds.length > 0
          ? { id: { in: options.propertyIds } }
          : {}),
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

  return {
    totalMentions,
    newLast30d,
    negativePct,
    unreviewedCount,
    flaggedCount,
    googleAvgRating,
    googleReviewCount,
    sourceBreakdown,
    sentimentBreakdown,
    propertyHealth,
    monthlyVolume,
  };
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
  rating: number | null;
  sourceUrl: string;
  flagged: boolean;
  reviewed: boolean;
};

export async function loadPortfolioReputationFeed(
  orgId: string,
  limit = 30,
  options: { propertyIds?: string[] | null } = {}
): Promise<PortfolioReputationFeedItem[]> {
  const rows = await prisma.propertyMention.findMany({
    where: { orgId, ...propertyIdsToWhere(options.propertyIds ?? null) },
    orderBy: [{ publishedAt: "desc" }, { lastSeenAt: "desc" }, { id: "desc" }],
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
    rating: r.rating,
    flagged: r.flagged,
    reviewed: r.reviewedByUserId !== null,
  }));
}
