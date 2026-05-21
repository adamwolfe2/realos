import "server-only";

// ---------------------------------------------------------------------------
// SEO Agent Phase 2 — server-side aggregations that feed the /portal/seo/agent
// charts. Every function here is read-only against QueryLandingDaily,
// RankedKeyword, OnPageInstantAudit, LocalPackRanking, and
// KeywordIntersection. Returns ready-to-render data shapes for the
// components in components/portal/seo/seo-phase2-charts.tsx.
//
// All queries are Prisma + small in-memory transformations. No fan-out.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RangeKey = "7d" | "28d" | "90d" | "12mo";

function rangeToDays(r: RangeKey): number {
  return r === "7d" ? 7 : r === "28d" ? 28 : r === "90d" ? 90 : 365;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// ---------------------------------------------------------------------------
// Executive summary — 6 KPIs with delta vs prior period
// ---------------------------------------------------------------------------

export type ExecSummaryComputed = {
  totalClicks: { current: number; prior: number };
  totalImpressions: { current: number; prior: number };
  avgPosition: { current: number | null; prior: number | null };
  rankedKeywords: { current: number; prior: number };
  topTen: { current: number; prior: number };
  estTraffic: { current: number; prior: number };
};

export async function getExecSummary(input: {
  orgId: string;
  propertyId?: string;
  range: RangeKey;
}): Promise<ExecSummaryComputed> {
  const days = rangeToDays(input.range);
  const now = new Date();
  const periodStart = startOfUtcDay(new Date(now.getTime() - days * DAY_MS));
  const priorStart = startOfUtcDay(new Date(now.getTime() - 2 * days * DAY_MS));

  const baseWhere = {
    orgId: input.orgId,
    ...(input.propertyId ? { propertyId: input.propertyId } : {}),
  };

  const [currentAgg, priorAgg, currentRanked, priorRanked, currentTop, priorTop] =
    await Promise.all([
      prisma.queryLandingDaily.aggregate({
        where: { ...baseWhere, date: { gte: periodStart } },
        _sum: { gscClicks: true, gscImpressions: true },
        _avg: { gscPosition: true },
      }),
      prisma.queryLandingDaily.aggregate({
        where: {
          ...baseWhere,
          date: { gte: priorStart, lt: periodStart },
        },
        _sum: { gscClicks: true, gscImpressions: true },
        _avg: { gscPosition: true },
      }),
      prisma.rankedKeyword.count({
        where: { ...baseWhere, date: { gte: periodStart } },
      }),
      prisma.rankedKeyword.count({
        where: {
          ...baseWhere,
          date: { gte: priorStart, lt: periodStart },
        },
      }),
      prisma.rankedKeyword.count({
        where: {
          ...baseWhere,
          date: { gte: periodStart },
          position: { lte: 10 },
        },
      }),
      prisma.rankedKeyword.count({
        where: {
          ...baseWhere,
          date: { gte: priorStart, lt: periodStart },
          position: { lte: 10 },
        },
      }),
    ]);

  // Estimated traffic — sum of (searchVolume × CTR-at-position) for the
  // current ranked-keyword snapshot. Cheap, doesn't require GA4.
  const currentRankedRows = await prisma.rankedKeyword.findMany({
    where: { ...baseWhere, date: { gte: periodStart } },
    select: { position: true, searchVolume: true },
  });
  const priorRankedRows = await prisma.rankedKeyword.findMany({
    where: {
      ...baseWhere,
      date: { gte: priorStart, lt: periodStart },
    },
    select: { position: true, searchVolume: true },
  });
  const estCurrent = currentRankedRows.reduce(
    (sum, r) => sum + (r.searchVolume ?? 0) * expectedCtr(r.position),
    0,
  );
  const estPrior = priorRankedRows.reduce(
    (sum, r) => sum + (r.searchVolume ?? 0) * expectedCtr(r.position),
    0,
  );

  return {
    totalClicks: {
      current: currentAgg._sum.gscClicks ?? 0,
      prior: priorAgg._sum.gscClicks ?? 0,
    },
    totalImpressions: {
      current: currentAgg._sum.gscImpressions ?? 0,
      prior: priorAgg._sum.gscImpressions ?? 0,
    },
    avgPosition: {
      current: currentAgg._avg.gscPosition,
      prior: priorAgg._avg.gscPosition,
    },
    rankedKeywords: { current: currentRanked, prior: priorRanked },
    topTen: { current: currentTop, prior: priorTop },
    estTraffic: { current: Math.round(estCurrent), prior: Math.round(estPrior) },
  };
}

// AWR 2024-derived expected CTR by absolute SERP position.
function expectedCtr(position: number): number {
  if (position <= 1) return 0.39;
  if (position <= 2) return 0.18;
  if (position <= 3) return 0.1;
  if (position <= 4) return 0.075;
  if (position <= 5) return 0.055;
  if (position <= 6) return 0.04;
  if (position <= 7) return 0.032;
  if (position <= 8) return 0.026;
  if (position <= 9) return 0.021;
  if (position <= 10) return 0.018;
  if (position <= 15) return 0.01;
  if (position <= 20) return 0.006;
  if (position <= 50) return 0.002;
  return 0.0005;
}

// ---------------------------------------------------------------------------
// Position-bucket area chart — one row per day in the range
// ---------------------------------------------------------------------------

export async function getPositionBucketSeries(input: {
  orgId: string;
  propertyId?: string;
  range: RangeKey;
}) {
  const days = rangeToDays(input.range);
  const now = new Date();
  const start = startOfUtcDay(new Date(now.getTime() - days * DAY_MS));
  const rows = await prisma.rankedKeyword.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
    },
    select: { date: true, position: true },
  });

  type Bucket = {
    pos1: number;
    pos2to3: number;
    pos4to10: number;
    pos11to20: number;
    pos21to50: number;
    pos51to100: number;
  };
  const byDate = new Map<string, Bucket>();
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    const b = byDate.get(key) ?? {
      pos1: 0,
      pos2to3: 0,
      pos4to10: 0,
      pos11to20: 0,
      pos21to50: 0,
      pos51to100: 0,
    };
    if (r.position === 1) b.pos1 += 1;
    else if (r.position <= 3) b.pos2to3 += 1;
    else if (r.position <= 10) b.pos4to10 += 1;
    else if (r.position <= 20) b.pos11to20 += 1;
    else if (r.position <= 50) b.pos21to50 += 1;
    else b.pos51to100 += 1;
    byDate.set(key, b);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, b]) => ({ date, ...b }));
}

// ---------------------------------------------------------------------------
// CTR vs position scatter
// ---------------------------------------------------------------------------

export async function getCtrScatterPoints(input: {
  orgId: string;
  propertyId?: string;
  range: RangeKey;
}) {
  const days = rangeToDays(input.range);
  const start = startOfUtcDay(new Date(Date.now() - days * DAY_MS));
  const rows = await prisma.queryLandingDaily.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
      gscImpressions: { gte: 50 },
      gscPosition: { not: null },
    },
    select: {
      query: true,
      gscPosition: true,
      gscCtr: true,
      gscImpressions: true,
    },
    take: 500,
  });
  return rows
    .filter((r) => r.gscPosition != null && r.gscCtr != null)
    .map((r) => ({
      query: r.query,
      position: r.gscPosition!,
      ctr: r.gscCtr!,
      impressions: r.gscImpressions,
    }));
}

// ---------------------------------------------------------------------------
// Striking distance — positions 4–20 with high impressions
// ---------------------------------------------------------------------------

export async function getStrikingDistance(input: {
  orgId: string;
  propertyId?: string;
}) {
  const start = startOfUtcDay(new Date(Date.now() - 28 * DAY_MS));
  const rows = await prisma.queryLandingDaily.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
      gscPosition: { gte: 4, lte: 20 },
      gscImpressions: { gte: 50 },
    },
    orderBy: { gscImpressions: "desc" },
    take: 50,
    select: {
      query: true,
      url: true,
      gscPosition: true,
      gscImpressions: true,
      gscClicks: true,
      gscCtr: true,
    },
  });
  return rows.map((r) => ({
    query: r.query,
    url: r.url || null,
    position: Math.round(r.gscPosition!),
    impressions: r.gscImpressions,
    clicks: r.gscClicks,
    ctr: r.gscCtr ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Share of voice — % of total impressions across tracked queries
// ---------------------------------------------------------------------------

export async function getShareOfVoice(input: {
  orgId: string;
  propertyId?: string;
  ourDomain: string | null;
}) {
  const start = startOfUtcDay(new Date(Date.now() - 28 * DAY_MS));

  // Pull every SERP row for the period, sum impressions-weighted "presence"
  // by domain. Impressions weight each query by its potential reach so
  // a competitor that owns #1 on a low-volume query doesn't outweigh a
  // competitor that owns #3 on a high-volume one.
  const serpRows = await prisma.serpRanking.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
    },
    select: { query: true, topResults: true },
  });

  // Multiplier per position (rough AWR curve).
  const posWeight = (p: number): number => {
    if (p === 1) return 39;
    if (p <= 3) return 18;
    if (p <= 10) return 6;
    return 1;
  };

  const totals = new Map<string, number>();
  for (const row of serpRows) {
    const top = Array.isArray(row.topResults)
      ? (row.topResults as Array<{ rank?: number; domain?: string }>)
      : [];
    for (const r of top) {
      if (!r.domain || !r.rank) continue;
      const d = r.domain.replace(/^www\./, "");
      const w = posWeight(r.rank);
      totals.set(d, (totals.get(d) ?? 0) + w);
    }
  }
  const totalWeight = Array.from(totals.values()).reduce((s, x) => s + x, 0);
  if (totalWeight === 0) return [];

  const entries = Array.from(totals.entries())
    .map(([domain, w]) => ({
      domain,
      shareOfVoice: w / totalWeight,
      isUs: input.ourDomain != null && domain === input.ourDomain,
    }))
    .sort((a, b) => b.shareOfVoice - a.shareOfVoice);

  // Roll up the long tail under "Other" so the donut stays readable.
  const top = entries.slice(0, 5);
  const rest = entries.slice(5);
  if (rest.length > 0) {
    top.push({
      domain: `Other (${rest.length})`,
      shareOfVoice: rest.reduce((s, x) => s + x.shareOfVoice, 0),
      isUs: false,
    });
  }
  return top;
}

// ---------------------------------------------------------------------------
// Opportunity matrix — bubble: position × volume × conversion potential
// ---------------------------------------------------------------------------

const INTENT_WEIGHT: Record<string, number> = {
  transactional: 1.0,
  commercial: 0.7,
  navigational: 0.4,
  informational: 0.25,
};

export async function getOpportunityPoints(input: {
  orgId: string;
  propertyId?: string;
}) {
  const rows = await prisma.rankedKeyword.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      searchVolume: { gt: 0 },
      date: { gte: startOfUtcDay(new Date(Date.now() - 7 * DAY_MS)) },
    },
    orderBy: { searchVolume: "desc" },
    take: 100,
    select: {
      keyword: true,
      position: true,
      searchVolume: true,
      intent: true,
    },
  });
  return rows.map((r) => ({
    query: r.keyword,
    position: r.position,
    searchVolume: r.searchVolume ?? 0,
    conversionPotential:
      INTENT_WEIGHT[(r.intent ?? "informational").toLowerCase()] ?? 0.3,
  }));
}

// ---------------------------------------------------------------------------
// Content ROI treemap — per-URL composite score
// ---------------------------------------------------------------------------

export async function getContentRoiNodes(input: {
  orgId: string;
  propertyId?: string;
}) {
  const start = startOfUtcDay(new Date(Date.now() - 28 * DAY_MS));
  // Group QueryLandingDaily rows by URL and sum clicks / rank count.
  const rows = await prisma.queryLandingDaily.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
      url: { not: "" },
    },
    select: {
      url: true,
      gscClicks: true,
      ga4Conversions: true,
      serpPosition: true,
    },
  });

  type Agg = {
    clicks: number;
    rankCount: number;
    conversions: number;
    topRankSum: number;
  };
  const byUrl = new Map<string, Agg>();
  for (const r of rows) {
    const a = byUrl.get(r.url) ?? {
      clicks: 0,
      rankCount: 0,
      conversions: 0,
      topRankSum: 0,
    };
    a.clicks += r.gscClicks;
    a.conversions += r.ga4Conversions;
    if (r.serpPosition != null) {
      a.rankCount += 1;
      a.topRankSum += Math.max(0, 101 - r.serpPosition);
    }
    byUrl.set(r.url, a);
  }

  // Composite ROI: log(clicks) × intent-blind weight + conversion bonus.
  const maxClicks = Math.max(1, ...Array.from(byUrl.values()).map((a) => a.clicks));
  return Array.from(byUrl.entries())
    .map(([url, a]) => {
      const clicksScore = (Math.log(1 + a.clicks) / Math.log(1 + maxClicks)) * 70;
      const convBonus = Math.min(30, a.conversions * 3);
      const roiScore = Math.round(Math.max(0, Math.min(100, clicksScore + convBonus)));
      return {
        url,
        clicks: a.clicks,
        rankCount: a.rankCount,
        conversions: a.conversions,
        roiScore,
      };
    })
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 30);
}

// ---------------------------------------------------------------------------
// Pipeline funnel — impressions -> clicks -> sessions -> conversions
// ---------------------------------------------------------------------------

export async function getPipelineFunnel(input: {
  orgId: string;
  propertyId?: string;
  range: RangeKey;
}) {
  const days = rangeToDays(input.range);
  const start = startOfUtcDay(new Date(Date.now() - days * DAY_MS));
  const agg = await prisma.queryLandingDaily.aggregate({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
    },
    _sum: {
      gscImpressions: true,
      gscClicks: true,
      ga4Sessions: true,
      ga4Conversions: true,
    },
  });
  return [
    { label: "Impressions", value: agg._sum.gscImpressions ?? 0 },
    { label: "Clicks", value: agg._sum.gscClicks ?? 0 },
    { label: "Sessions", value: agg._sum.ga4Sessions ?? 0 },
    { label: "Conversions", value: agg._sum.ga4Conversions ?? 0 },
  ];
}

// ---------------------------------------------------------------------------
// Branded vs non-branded split
// ---------------------------------------------------------------------------

export async function getBrandedSplit(input: {
  orgId: string;
  propertyId?: string;
  range: RangeKey;
}) {
  const days = rangeToDays(input.range);
  const start = startOfUtcDay(new Date(Date.now() - days * DAY_MS));
  const [branded, nonBranded] = await Promise.all([
    prisma.queryLandingDaily.aggregate({
      where: {
        orgId: input.orgId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        date: { gte: start },
        isBranded: true,
      },
      _sum: { gscClicks: true, gscImpressions: true },
    }),
    prisma.queryLandingDaily.aggregate({
      where: {
        orgId: input.orgId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        date: { gte: start },
        isBranded: false,
      },
      _sum: { gscClicks: true, gscImpressions: true },
    }),
  ]);
  return {
    branded: {
      clicks: branded._sum.gscClicks ?? 0,
      impressions: branded._sum.gscImpressions ?? 0,
    },
    nonBranded: {
      clicks: nonBranded._sum.gscClicks ?? 0,
      impressions: nonBranded._sum.gscImpressions ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Site health score from on-page instant audit
// ---------------------------------------------------------------------------

export async function getSiteHealth(input: {
  orgId: string;
  propertyId?: string;
}) {
  const latest = await prisma.onPageInstantAudit.findFirst({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    },
    orderBy: { date: "desc" },
  });
  if (!latest) {
    return { score: 0, critical: 0, warning: 0, notice: 0 };
  }
  // Score = 100 − weighted penalty.
  const penalty = latest.issuesCritical * 8 + latest.issuesWarning * 3 + latest.issuesNotice * 1;
  return {
    score: Math.max(0, Math.min(100, 100 - penalty)),
    critical: latest.issuesCritical,
    warning: latest.issuesWarning,
    notice: latest.issuesNotice,
  };
}

// ---------------------------------------------------------------------------
// Local pack tracker
// ---------------------------------------------------------------------------

export async function getLocalPackRows(input: {
  orgId: string;
  propertyId?: string;
}) {
  const start = startOfUtcDay(new Date(Date.now() - 7 * DAY_MS));
  const rows = await prisma.localPackRanking.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
      date: { gte: start },
    },
    orderBy: { date: "desc" },
    take: 12,
  });
  // Dedupe by query (keep latest).
  const byQuery = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!byQuery.has(r.query)) byQuery.set(r.query, r);
  }
  return Array.from(byQuery.values()).map((r) => ({
    query: r.query,
    ourPosition: r.ourPosition,
    topResults: Array.isArray(r.topResults)
      ? (r.topResults as Array<{
          position: number;
          title: string;
          rating: { value: number | null; votes_count: number } | null;
        }>).map((t) => ({
          position: t.position,
          title: t.title,
          rating: t.rating?.value ?? null,
          reviewCount: t.rating?.votes_count ?? 0,
        }))
      : [],
  }));
}

// ---------------------------------------------------------------------------
// Weekly score history — feeds the ScoreHistoryChart on the agent dashboard.
// Returns up to 12 most recent weeks per (orgId, propertyId).
// ---------------------------------------------------------------------------
export type ScoreHistoryPoint = {
  weekOf: string;
  composite: number;
  technical: number;
  content: number;
  authority: number;
};

export async function getScoreHistory(input: {
  orgId: string;
  propertyId?: string;
  weeks?: number;
}): Promise<ScoreHistoryPoint[]> {
  const weeks = input.weeks ?? 12;
  const rows = await prisma.seoScoreHistory.findMany({
    where: {
      orgId: input.orgId,
      ...(input.propertyId ? { propertyId: input.propertyId } : {}),
    },
    orderBy: { weekOf: "desc" },
    take: weeks,
    select: {
      weekOf: true,
      compositeScore: true,
      technicalScore: true,
      contentScore: true,
      authorityScore: true,
    },
  });
  return rows
    .map((r) => ({
      weekOf: r.weekOf.toISOString().slice(0, 10),
      composite: r.compositeScore,
      technical: r.technicalScore,
      content: r.contentScore,
      authority: r.authorityScore,
    }))
    .reverse();
}
