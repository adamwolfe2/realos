/**
 * AEO Opportunity Score compute pipeline.
 *
 * For each org with the SEO module enabled and the AEO source flipped
 * to DataForSEO, pulls:
 *   - top-20 GSC queries by impressions in last 28 days
 *   - DataForSEO AI search volume for each
 *   - AeoMentionSnapshot self/competitor counts for each
 *   - org-level latest OnPage SEO score
 * Computes the composite via `computeOpportunityScore`, upserts on
 * (orgId, keyword).
 *
 * Designed to be cheap to call from the weekly AEO cron — a single
 * batched DataForSEO `keywords_search_volume` call covers all 20
 * keywords for the org.
 *
 * Idempotency: the pipeline overwrites previous rows for the same
 * (orgId, keyword). Score history is intentionally not kept in W2 —
 * the denormalized inputs make any past score recomputable, and W3
 * adds versioning if we want a real chart.
 */

import "server-only";
import { prisma } from "@/lib/db";
import {
  fetchAiKeywordVolume,
  fetchSerpAiSummary,
} from "@/lib/seo/dataforseo";
import {
  computeOpportunityScore,
  type OpportunityInputs,
} from "./opportunity-score";
import { resolveEngineSource } from "./engines";
import type { Prisma } from "@prisma/client";

const TOP_QUERIES = 20;
const OVERVIEW_TOP_QUERIES = 5;
const GSC_WINDOW_DAYS = 28;
const MENTION_WINDOW_DAYS = 30;

export interface ScoreOpportunitiesResult {
  orgId: string;
  source: "direct" | "dataforseo";
  ranOpportunities: boolean;
  ranOverview: boolean;
  keywordsScored: number;
  overviewsCaptured: number;
  totalCostUsd: number;
  errors: string[];
}

/**
 * Top-of-pipeline entry. Cron and ad-hoc admin triggers call this.
 *
 * No-op (returns ranOpportunities=false) when AEO_ENGINE_SOURCE !== "dataforseo"
 * or when DataForSEO env is missing — keeps direct-mode cron cheap.
 */
export async function scoreOrgOpportunities(
  orgId: string,
): Promise<ScoreOpportunitiesResult> {
  const source = resolveEngineSource();
  const dataforseoConfigured =
    !!process.env.DATAFORSEO_LOGIN?.trim() &&
    !!process.env.DATAFORSEO_PASSWORD?.trim();

  const result: ScoreOpportunitiesResult = {
    orgId,
    source,
    ranOpportunities: false,
    ranOverview: false,
    keywordsScored: 0,
    overviewsCaptured: 0,
    totalCostUsd: 0,
    errors: [],
  };

  if (source !== "dataforseo" || !dataforseoConfigured) {
    return result;
  }

  try {
    const topQueries = await loadTopGscQueries(orgId, TOP_QUERIES);
    if (topQueries.length === 0) {
      return result;
    }

    const keywords = topQueries.map((q) => q.query);

    // Two DataForSEO calls per org per scan:
    //   1. ai_keyword_data — single batched call covering all top keywords
    //   2. ai_summary — one call per top-5 keyword for the AI Overview row
    const aiVolumeMap = await loadAiVolumes(keywords, orgId);
    const onPageSeoScore = await loadOnPageSeoScore(orgId);
    const mentionCounts = await loadMentionCounts(orgId, keywords);

    const scoreRows = topQueries.map((q) => {
      const ai = aiVolumeMap.get(q.query.toLowerCase()) ?? 0;
      const mentions = mentionCounts.get(q.query.toLowerCase()) ?? {
        self: 0,
        competitor: 0,
      };
      const inputs: OpportunityInputs = {
        gscClicks28d: q.clicks,
        gscImpressions28d: q.impressions,
        gscAvgPosition: q.position,
        aiSearchVolume: ai,
        yourMentionCount: mentions.self,
        competitorMentionCount: mentions.competitor,
        onPageSeoScore,
      };
      const { score } = computeOpportunityScore(inputs);
      return { keyword: q.query, inputs, score };
    });

    for (const row of scoreRows) {
      try {
        await prisma.aeoOpportunityScore.upsert({
          where: { orgId_keyword: { orgId, keyword: row.keyword } },
          create: {
            orgId,
            keyword: row.keyword,
            gscClicks28d: row.inputs.gscClicks28d,
            gscImpressions28d: row.inputs.gscImpressions28d,
            gscAvgPosition: row.inputs.gscAvgPosition,
            aiSearchVolume: row.inputs.aiSearchVolume,
            yourMentionCount: row.inputs.yourMentionCount,
            competitorMentionCount: row.inputs.competitorMentionCount,
            onPageSeoScore: row.inputs.onPageSeoScore,
            score: row.score,
          },
          update: {
            gscClicks28d: row.inputs.gscClicks28d,
            gscImpressions28d: row.inputs.gscImpressions28d,
            gscAvgPosition: row.inputs.gscAvgPosition,
            aiSearchVolume: row.inputs.aiSearchVolume,
            yourMentionCount: row.inputs.yourMentionCount,
            competitorMentionCount: row.inputs.competitorMentionCount,
            onPageSeoScore: row.inputs.onPageSeoScore,
            score: row.score,
            computedAt: new Date(),
          },
        });
        result.keywordsScored += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[score-opportunities] upsert failed for org ${orgId} / "${row.keyword}": ${message}`,
        );
        result.errors.push(`upsert:${row.keyword}:${message.slice(0, 80)}`);
      }
    }
    result.ranOpportunities = true;

    // Google AI Overview row — top-5 queries only to keep spend trivial.
    const primaryHost = await loadPrimaryHost(orgId);
    const overviewQueries = topQueries
      .slice(0, OVERVIEW_TOP_QUERIES)
      .map((q) => q.query);

    for (const query of overviewQueries) {
      try {
        const ai = await fetchSerpAiSummary(
          { query },
          { surface: "aeo", orgId, propertyId: null },
        );
        if (!("ok" in ai) || !ai.ok) {
          const msg =
            "skipped" in ai && ai.skipped
              ? `summary:${query}:skipped:${ai.reason.slice(0, 60)}`
              : `summary:${query}:error:${("error" in ai ? ai.error : "?").slice(0, 60)}`;
          result.errors.push(msg);
          continue;
        }
        const citedUrls = ai.data.citedUrls;
        const cited = primaryHost
          ? citedUrls.some((u) => citedUrlMatchesHost(u, primaryHost))
          : false;
        await prisma.aeoOverviewSnapshot.create({
          data: {
            orgId,
            query,
            summary: ai.data.summary,
            citedUrls,
            cited,
            costUsd: ai.costUsd,
          },
        });
        result.overviewsCaptured += 1;
        result.totalCostUsd += ai.costUsd;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[score-opportunities] overview failed for org ${orgId} / "${query}": ${message}`,
        );
        result.errors.push(`overview:${query}:${message.slice(0, 60)}`);
      }
    }
    result.ranOverview = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[score-opportunities] org ${orgId} top-level failure: ${message}`,
    );
    result.errors.push(`top:${message.slice(0, 200)}`);
  }
  return result;
}

interface TopGscQuery {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

async function loadTopGscQueries(
  orgId: string,
  limit: number,
): Promise<TopGscQuery[]> {
  const cutoff = new Date(Date.now() - GSC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  // Aggregate by query across the 28-day window. Prisma doesn't support
  // an easy multi-column aggregate, so we pull rows + reduce in memory.
  // 28d × ~100 queries/day = ~2800 rows ceiling, well below 10k.
  const rows = await prisma.seoQuery.findMany({
    where: { orgId, date: { gte: cutoff } },
    select: {
      query: true,
      clicks: true,
      impressions: true,
      position: true,
    },
    take: 5000,
  });
  const agg = new Map<
    string,
    { clicks: number; impressions: number; positionSum: number; count: number }
  >();
  for (const row of rows) {
    const key = row.query.trim().toLowerCase();
    if (!key) continue;
    const bucket = agg.get(key) ?? {
      clicks: 0,
      impressions: 0,
      positionSum: 0,
      count: 0,
    };
    bucket.clicks += row.clicks;
    bucket.impressions += row.impressions;
    bucket.positionSum += row.position;
    bucket.count += 1;
    agg.set(key, bucket);
  }
  return Array.from(agg.entries())
    .map(([query, b]) => ({
      query,
      clicks: b.clicks,
      impressions: b.impressions,
      position: b.count > 0 ? b.positionSum / b.count : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

async function loadAiVolumes(
  keywords: string[],
  orgId: string,
): Promise<Map<string, number>> {
  if (keywords.length === 0) return new Map();
  const result = await fetchAiKeywordVolume(
    { keywords },
    { surface: "aeo", orgId, propertyId: null },
  );
  if (!("ok" in result) || !result.ok) {
    return new Map(); // soft-fail: all volumes default to 0
  }
  const map = new Map<string, number>();
  for (const row of result.data) {
    if (!row.keyword) continue;
    map.set(row.keyword.toLowerCase(), row.aiSearchVolume);
  }
  return map;
}

async function loadMentionCounts(
  orgId: string,
  keywords: string[],
): Promise<Map<string, { self: number; competitor: number }>> {
  const map = new Map<string, { self: number; competitor: number }>();
  if (keywords.length === 0) return map;
  const cutoff = new Date(
    Date.now() - MENTION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  // Pull snapshots from the window and bucket by which keyword's prompt
  // contains them. Cheap because the cron already throttles per-org
  // snapshot count and 30d × N orgs is small.
  const snapshots = await prisma.aeoMentionSnapshot.findMany({
    where: { orgId, capturedAt: { gte: cutoff } },
    select: { prompt: true, mentions: true },
    take: 5000,
  });
  type Mention = {
    name: string;
    kind: "self" | "competitor" | "other";
  };
  for (const keyword of keywords) {
    map.set(keyword.toLowerCase(), { self: 0, competitor: 0 });
  }
  for (const snap of snapshots) {
    const promptLower = snap.prompt.toLowerCase();
    const matchedKeyword = keywords.find((k) =>
      promptLower.includes(k.toLowerCase()),
    );
    if (!matchedKeyword) continue;
    const raw = snap.mentions as unknown;
    if (!Array.isArray(raw)) continue;
    const bucket = map.get(matchedKeyword.toLowerCase());
    if (!bucket) continue;
    for (const m of raw as Partial<Mention>[]) {
      if (m?.kind === "self") bucket.self += 1;
      else if (m?.kind === "competitor") bucket.competitor += 1;
    }
  }
  return map;
}

async function loadOnPageSeoScore(orgId: string): Promise<number | null> {
  // Most recent OnPage audit per org, averaged across the rows from the
  // last 30 days (Lighthouse runs are cached, so this is usually 1-2 rows).
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.onPageAudit.findMany({
    where: { orgId, date: { gte: cutoff }, seo: { not: null } },
    select: { seo: true },
    orderBy: { date: "desc" },
    take: 25,
  });
  if (rows.length === 0) return null;
  const sum = rows.reduce((acc, r) => acc + (r.seo ?? 0), 0);
  return sum / rows.length;
}

async function loadPrimaryHost(orgId: string): Promise<string | null> {
  const domain = await prisma.domainBinding.findFirst({
    where: { orgId, isPrimary: true },
    select: { hostname: true },
  });
  if (!domain) return null;
  return domain.hostname.toLowerCase().replace(/^www\./, "");
}

function citedUrlMatchesHost(url: string, primaryHost: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return host === primaryHost || host.endsWith(`.${primaryHost}`);
  } catch {
    return false;
  }
}

// Type helper for Prisma JSON column casts inside scoreRows persistence —
// kept here for use sites that need to widen the inputs payload.
export type AeoOpportunityInputJson = Prisma.InputJsonValue;
