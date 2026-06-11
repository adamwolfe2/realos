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

  // Clicks/impressions/avg-position SUM/AVG over the window are correct (GSC
  // daily traffic). The ranked-keyword metrics are NOT: rankedKeyword is a
  // daily snapshot, so counting/summing every row over the window counted
  // keyword-DAYS — ~30× inflation in ranked-kw, top-10, AND estimated traffic.
  // All three are point-in-time, so derive them from the LATEST snapshot in
  // each period. (Codex.)
  const [currentAgg, priorAgg, curMax, priorMax] = await Promise.all([
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
    prisma.rankedKeyword.aggregate({
      where: { ...baseWhere, date: { gte: periodStart } },
      _max: { date: true },
    }),
    prisma.rankedKeyword.aggregate({
      where: { ...baseWhere, date: { gte: priorStart, lt: periodStart } },
      _max: { date: true },
    }),
  ]);

  const curSnap = curMax._max.date;
  const priorSnap = priorMax._max.date;
  const [currentRankedRows, priorRankedRows] = await Promise.all([
    curSnap
      ? prisma.rankedKeyword.findMany({
          where: { ...baseWhere, date: curSnap },
          select: { position: true, searchVolume: true },
        })
      : Promise.resolve([] as Array<{ position: number; searchVolume: number | null }>),
    priorSnap
      ? prisma.rankedKeyword.findMany({
          where: { ...baseWhere, date: priorSnap },
          select: { position: true, searchVolume: true },
        })
      : Promise.resolve([] as Array<{ position: number; searchVolume: number | null }>),
  ]);

  const currentRanked = currentRankedRows.length;
  const priorRanked = priorRankedRows.length;
  const currentTop = currentRankedRows.filter((r) => r.position <= 10).length;
  const priorTop = priorRankedRows.filter((r) => r.position <= 10).length;
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
// Week-over-week changes — surfaces the meaningful deltas operators
// actually want to see at a glance: queries that jumped into the top 10,
// queries that lost rank, new competitor citations, and new pages
// ranking. Drives the "What changed this week" panel on /portal/seo/agent.
// ---------------------------------------------------------------------------
export type WeeklyChange =
  | {
      kind: "rank_up";
      query: string;
      fromRank: number;
      toRank: number;
      change: number;
    }
  | {
      kind: "rank_down";
      query: string;
      fromRank: number;
      toRank: number;
      change: number;
    }
  | {
      kind: "entered_top_10";
      query: string;
      rank: number;
    }
  | {
      kind: "fell_out_top_10";
      query: string;
      lastRank: number;
    }
  | {
      kind: "new_competitor_citation";
      competitor: string;
      prompt: string;
    };

export async function getWeeklyChanges(input: {
  orgId: string;
  propertyId?: string;
}): Promise<WeeklyChange[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);

  // SERP ranking deltas: compare latest rank in the last 7d vs the
  // latest rank in the prior 7-14d window per query.
  const [thisWeekRanks, lastWeekRanks, newCompetitors] = await Promise.all([
    prisma.serpRanking.findMany({
      where: {
        orgId: input.orgId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        date: { gte: sevenDaysAgo },
        ourRank: { not: null },
      },
      orderBy: { date: "desc" },
      select: { query: true, ourRank: true, date: true },
    }),
    prisma.serpRanking.findMany({
      where: {
        orgId: input.orgId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        date: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        ourRank: { not: null },
      },
      orderBy: { date: "desc" },
      select: { query: true, ourRank: true, date: true },
    }),
    prisma.aeoCitationCheck.findMany({
      where: {
        orgId: input.orgId,
        ...(input.propertyId ? { propertyId: input.propertyId } : {}),
        queryRunAt: { gte: sevenDaysAgo },
        status: "COMPETITOR_CITED",
      },
      orderBy: { queryRunAt: "desc" },
      take: 30,
      select: { competitorsCited: true, prompt: true, queryRunAt: true },
    }),
  ]);

  // Keep only the latest rank per query in each window.
  function latestByQuery(rows: Array<{ query: string; ourRank: number | null; date: Date }>): Map<string, number> {
    const seen = new Map<string, number>();
    for (const r of rows) {
      if (r.ourRank == null) continue;
      if (!seen.has(r.query)) seen.set(r.query, r.ourRank);
    }
    return seen;
  }
  const cur = latestByQuery(thisWeekRanks);
  const pri = latestByQuery(lastWeekRanks);

  const changes: WeeklyChange[] = [];

  // Movements + entries
  for (const [q, curRank] of cur.entries()) {
    const priRank = pri.get(q);
    if (priRank == null) {
      // New ranking — only flag if it landed in top 10.
      if (curRank <= 10) {
        changes.push({ kind: "entered_top_10", query: q, rank: curRank });
      }
      continue;
    }
    const delta = priRank - curRank; // positive = improved
    if (delta >= 3 && curRank <= 30) {
      changes.push({
        kind: "rank_up",
        query: q,
        fromRank: priRank,
        toRank: curRank,
        change: delta,
      });
    } else if (delta <= -3) {
      changes.push({
        kind: "rank_down",
        query: q,
        fromRank: priRank,
        toRank: curRank,
        change: delta,
      });
    }
    if (priRank > 10 && curRank <= 10) {
      changes.push({ kind: "entered_top_10", query: q, rank: curRank });
    }
  }

  // Fell out of top 10
  for (const [q, priRank] of pri.entries()) {
    const curRank = cur.get(q);
    if (priRank <= 10 && (curRank == null || curRank > 10)) {
      changes.push({
        kind: "fell_out_top_10",
        query: q,
        lastRank: priRank,
      });
    }
  }

  // New competitor citations - flag the first time each competitor
  // is cited in this 7d window (best-effort dedupe by competitor name).
  const seenCompetitors = new Set<string>();
  for (const row of newCompetitors) {
    for (const c of row.competitorsCited) {
      const key = c.trim();
      if (!key || seenCompetitors.has(key)) continue;
      seenCompetitors.add(key);
      changes.push({
        kind: "new_competitor_citation",
        competitor: key,
        prompt: row.prompt.slice(0, 80),
      });
      if (seenCompetitors.size >= 5) break;
    }
    if (seenCompetitors.size >= 5) break;
  }

  // Cap total changes at 12 so the panel stays scannable.
  return changes.slice(0, 12);
}
