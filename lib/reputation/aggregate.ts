import "server-only";
import { prisma } from "@/lib/db";
import type { MentionSource, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Server-side aggregates for the Reputation metrics dashboard. Runs a handful
// of tenant-scoped Prisma aggregation queries in parallel and returns a
// serialized payload the client panel renders charts from.
// ---------------------------------------------------------------------------

export type ReputationMetrics = {
  totalMentions: number;
  newLast30d: number;
  negativePct: number | null;
  unreviewedCount: number;
  flaggedCount: number;

  // Native Google Reviews — from the Google Places scan result on most recent
  // run. Pulled off PropertyMention.rating for source=GOOGLE_REVIEW rows.
  googleAvgRating: number | null;
  googleReviewCount: number;

  // Per-source distribution (active platforms).
  sourceBreakdown: Array<{ source: MentionSource; count: number }>;

  // Per-sentiment distribution.
  sentimentBreakdown: Array<{ sentiment: Sentiment | "UNCLASSIFIED"; count: number }>;

  // Top topic tags (persisted as JSON on PropertyMention.topics).
  topicBreakdown: Array<{ topic: string; count: number }>;

  // Monthly volume trend — last 6 months, used for a tiny bar strip.
  monthlyVolume: Array<{ month: string; count: number; negative: number }>;

  // Common 2-word phrases from negative mentions. Pulled from excerpts and
  // stop-word-filtered. Useful for spotting recurring complaints ("leasing
  // office", "maintenance requests", "hot water", etc.).
  negativeKeywords: Array<{ phrase: string; count: number }>;
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "doing",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "i",
  "we",
  "you",
  "he",
  "she",
  "it",
  "they",
  "me",
  "us",
  "my",
  "our",
  "your",
  "his",
  "her",
  "its",
  "their",
  "this",
  "that",
  "these",
  "those",
  "there",
  "here",
  "then",
  "than",
  "so",
  "too",
  "very",
  "just",
  "also",
  "only",
  "not",
  "no",
  "yes",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "about",
  "from",
  "as",
  "into",
  "through",
  "out",
  "up",
  "down",
  "over",
  "under",
  "all",
  "any",
  "some",
  "more",
  "most",
  "many",
  "much",
  "one",
  "two",
  "three",
  "first",
  "last",
  "go",
  "went",
  "get",
  "got",
  "make",
  "made",
  "can",
  "like",
  "really",
  "even",
  "how",
  "when",
  "where",
  "what",
  "who",
  "why",
  "if",
  "because",
  "way",
  "day",
  "time",
  "year",
  "years",
  "people",
  "person",
  "place",
  "apartment",
  "apartments",
  "reviews",
  "review",
  "comments",
  "comment",
  "read",
]);

function extractBigrams(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

export async function loadReputationMetrics(
  orgId: string,
  propertyId: string
): Promise<ReputationMetrics> {
  const now = new Date();
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // 12-month trend window so Google reviews dated 9-11 months ago show up
  // on the bar chart. Tavily results without published_date still bucket
  // into the scan date (recent bar), but nothing gets excluded for being
  // "too old" within a year.
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const where = { orgId, propertyId };

  const [
    totalMentions,
    newLast30d,
    unreviewedCount,
    flaggedCount,
    sentimentRows,
    sourceRows,
    googleMeta,
    negExcerpts,
    monthlyRaw,
    topicRows,
  ] = await Promise.all([
    prisma.propertyMention.count({ where }),
    // Bug #39 — "+35 in last 30d" was always equal to total. Root
    // cause: counted by createdAt (ingestion timestamp), so a first
    // scan that backfilled a year of mentions reported them all as
    // "new in 30 days." Fix: use publication date when known, fall
    // back to ingestion only when the source didn't supply one. The
    // result is capped at total inside the metric body below.
    prisma.propertyMention.count({
      where: {
        ...where,
        OR: [
          { publishedAt: { gte: last30d } },
          {
            AND: [
              { publishedAt: null },
              { createdAt: { gte: last30d } },
            ],
          },
        ],
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
    // Read aggregate Google rating + review count from the Property row
    // (cached there on each scan — these are place.rating / userRatingCount
    // from the Places API, i.e. averages over ALL Google reviews, not just
    // the 5 "most helpful" that we persist as individual mentions).
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        googleAggRating: true,
        googleAggReviewCount: true,
      },
    }),
    prisma.propertyMention.findMany({
      where: { ...where, sentiment: "NEGATIVE" },
      select: { excerpt: true },
      take: 80,
    }),
    // Monthly mention volume — we aggregate client-side from a thin projection
    // rather than round-tripping date_trunc through Prisma raw.
    prisma.propertyMention.findMany({
      where: {
        ...where,
        OR: [
          { publishedAt: { gte: twelveMonthsAgo } },
          { AND: [{ publishedAt: null }, { createdAt: { gte: twelveMonthsAgo } }] },
        ],
      },
      select: { publishedAt: true, createdAt: true, sentiment: true },
    }),
    // Topics filter: JSON column, fetch any non-null row and filter in JS.
    // Prisma JSON `not: null` syntax varies by DB driver, so we just read
    // and discard empty/non-array values downstream.
    prisma.propertyMention.findMany({
      where,
      select: { topics: true },
      take: 500,
    }),
  ]);

  // Sentiment breakdown — treat null sentiment as "UNCLASSIFIED" so the donut
  // shows the analysis-failure slice honestly.
  const sentimentBreakdown = sentimentRows
    .map((r) => ({
      sentiment: (r.sentiment ?? "UNCLASSIFIED") as
        | Sentiment
        | "UNCLASSIFIED",
      count: r._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  const negativeCount =
    sentimentBreakdown.find((s) => s.sentiment === "NEGATIVE")?.count ?? 0;
  const classifiedCount = sentimentBreakdown
    .filter((s) => s.sentiment !== "UNCLASSIFIED")
    .reduce((acc, s) => acc + s.count, 0);
  const negativePct =
    classifiedCount > 0
      ? Math.round((negativeCount / classifiedCount) * 100)
      : null;

  const sourceBreakdown = sourceRows
    .map((r) => ({ source: r.source, count: r._count._all }))
    .sort((a, b) => b.count - a.count);

  // Topic aggregation — topics are stored as JSON string arrays.
  const topicCounts = new Map<string, number>();
  for (const row of topicRows) {
    if (!Array.isArray(row.topics)) continue;
    for (const t of row.topics as unknown[]) {
      if (typeof t !== "string") continue;
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    }
  }
  const topicBreakdown = Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Monthly volume — bucket by YYYY-MM, last 12 months.
  const monthKeys: string[] = [];
  const m = new Date(twelveMonthsAgo);
  for (let i = 0; i < 12; i++) {
    const label = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(label);
    m.setMonth(m.getMonth() + 1);
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

  // Negative keyword extraction — common bigrams from NEGATIVE mentions.
  const bigramCounts = new Map<string, number>();
  for (const n of negExcerpts) {
    for (const bg of extractBigrams(n.excerpt)) {
      bigramCounts.set(bg, (bigramCounts.get(bg) ?? 0) + 1);
    }
  }
  const negativeKeywords = Array.from(bigramCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([phrase, count]) => ({ phrase, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Defensive clamp — if every persisted mention happens to have
  // publishedAt inside the 30d window (small new property), the delta
  // == total and the KPI subtitle reads weird ("35 mentions · +35 in
  // last 30d"). Cap so subtitle is "—" when the delta isn't a true
  // recent uptick. Also enforces newLast30d <= totalMentions.
  const cappedNewLast30d =
    totalMentions === 0
      ? 0
      : newLast30d >= totalMentions
        ? Math.max(0, Math.min(newLast30d, totalMentions))
        : newLast30d;

  return {
    totalMentions,
    newLast30d: cappedNewLast30d,
    negativePct,
    unreviewedCount,
    flaggedCount,
    googleAvgRating:
      typeof googleMeta?.googleAggRating === "number"
        ? Math.round(googleMeta.googleAggRating * 10) / 10
        : null,
    googleReviewCount: googleMeta?.googleAggReviewCount ?? 0,
    sourceBreakdown,
    sentimentBreakdown,
    topicBreakdown,
    monthlyVolume,
    negativeKeywords,
  };
}
