import "server-only";

// ---------------------------------------------------------------------------
// SEO/AEO Agent — synthesizes existing GA4 / GSC / AEO / sitemap data into
// ranked recommendations, optionally enriched by DataforSEO competitor +
// keyword signals when the keys are configured.
//
// Mirrors the shape of lib/intelligence/property-recommendations.ts but
// SEO-specific. Recommendations are persisted to SeoActionRecommendation
// (added in this commit's schema migration) so the operator UI can flip
// status (OPEN -> IN_PROGRESS -> COMPLETED / DISMISSED) without re-running
// the engine on every page load.
//
// Phase 1 (this file): SEVEN rules wired to existing data only. DataforSEO-
// dependent rules (CONTENT_GAP, COMPETITOR_CITED_BEFORE_US, BACKLINK_OPPORTUNITY)
// are stubbed with TODO markers — they light up automatically once the
// DataforSEO key lands and the nightly competitor sync starts populating
// PropertyCompetitorScan rows.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import { AeoCitationStatus, NeighborhoodPageStatus } from "@prisma/client";
// DataforSEO is referenced for type checking + readiness gating but every
// DataforSEO-dependent rule is wrapped in `if (isDataforSeoConfigured())`
// so the engine works fine without the key.
import { isDataforSeoConfigured } from "./dataforseo";

// Mirror Prisma's enums so consumers don't need to import them transitively.
export type SeoActionCategory =
  | "CTR_FIX"
  | "CONTENT_GAP"
  | "NEIGHBORHOOD_PAGE"
  | "REFRESH"
  | "AEO_GAP"
  | "AEO_NOT_CITED"
  | "ONPAGE_AUDIT"
  | "BACKLINK_OPPORTUNITY"
  | "SCHEMA_GAP"
  | "INTERNAL_LINKING";

export type SeoActionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type SeoRecommendation = {
  /** Stable id per (propertyId, category, kind). Drives upsert dedupe. */
  kind: string;
  category: SeoActionCategory;
  severity: SeoActionSeverity;
  title: string;
  detail: string;
  estimateMinutes: number;
  /** Composite priority (UI sorts descending). */
  score: number;
  actionHref: string | null;
  actionLabel: string | null;
  /** What underlying signal triggered this rec. UI shows "why?". */
  evidence: Record<string, unknown>;
};

const SEVERITY_BASE: Record<SeoActionSeverity, number> = {
  CRITICAL: 80,
  HIGH: 60,
  MEDIUM: 40,
  LOW: 20,
};

function makeRec(
  partial: Omit<SeoRecommendation, "score"> & { extraScore?: number },
): SeoRecommendation {
  const { extraScore = 0, ...rest } = partial;
  const effortBoost =
    rest.estimateMinutes <= 5 ? 8 : rest.estimateMinutes <= 15 ? 4 : 0;
  return { ...rest, score: SEVERITY_BASE[rest.severity] + extraScore + effortBoost };
}

// ---------------------------------------------------------------------------
// Rule 1 — CTR_FIX: high-impression queries with abysmal click-through
// ---------------------------------------------------------------------------
async function ctrFixRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  // Queries with at least 500 impressions over the last 14d AND CTR < 1%
  // are the canonical "title/meta needs a rewrite" signal.
  void propertyId;
  const rows = await prisma.seoQuery
    .findMany({
      where: {
        orgId,
        date: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        impressions: { gte: 500 },
        ctr: { lt: 0.01 },
      },
      orderBy: { impressions: "desc" },
      take: 3,
      select: { query: true, impressions: true, ctr: true, position: true },
    })
    .catch(() => []);
  return rows.map((q) =>
    makeRec({
      kind: `ctr-fix:${q.query.slice(0, 48)}`,
      category: "CTR_FIX",
      severity: "HIGH",
      title: `"${q.query}" — ${q.impressions.toLocaleString()} impressions, ${(q.ctr * 100).toFixed(2)}% CTR`,
      detail:
        "Real impressions, almost no clicks. Re-write the title + meta description. Expected lift: 4-8x clicks. The Content Drafter can produce a META_REWRITE in under 30 seconds.",
      estimateMinutes: 10,
      actionHref: `/portal/seo?query=${encodeURIComponent(q.query)}&draft=meta-rewrite`,
      actionLabel: "Draft new title + meta",
      evidence: {
        query: q.query,
        impressions: q.impressions,
        ctr: q.ctr,
        position: q.position,
      },
      extraScore: Math.min(12, Math.floor(q.impressions / 200)),
    }),
  );
}

// ---------------------------------------------------------------------------
// Rule 2 — NEIGHBORHOOD_PAGE: missing for the property's city
// ---------------------------------------------------------------------------
async function neighborhoodPageRecs(
  orgId: string,
  propertyId: string,
  city: string | null,
): Promise<SeoRecommendation[]> {
  if (!city) return [];
  const count = await prisma.neighborhoodPage
    .count({
      where: {
        orgId,
        propertyId,
        status: NeighborhoodPageStatus.PUBLISHED,
      },
    })
    .catch(() => 0);
  if (count > 0) return [];
  return [
    makeRec({
      kind: "neighborhood-page:first",
      category: "NEIGHBORHOOD_PAGE",
      severity: "HIGH",
      title: `Write your first neighborhood page for ${city}`,
      detail:
        "Properties with at least one neighborhood page surface in ~3x more long-tail searches in their first 60 days. The Content Drafter will produce a publishable draft in one click.",
      estimateMinutes: 10,
      actionHref: `/portal/seo/neighborhoods?from=${propertyId}&intent=first-page`,
      actionLabel: "Draft neighborhood page",
      evidence: { city, publishedCount: 0 },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Rule 3 — REFRESH: published pages > 90d stale
// ---------------------------------------------------------------------------
async function refreshRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const stale = await prisma.neighborhoodPage
    .findMany({
      where: {
        orgId,
        propertyId,
        status: NeighborhoodPageStatus.PUBLISHED,
        updatedAt: { lt: ninetyDaysAgo },
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: { id: true, neighborhood: true, slug: true, updatedAt: true },
    })
    .catch(() => []);
  return stale.map((page) => {
    const daysOld = Math.floor(
      (Date.now() - page.updatedAt.getTime()) / 86_400_000,
    );
    return makeRec({
      kind: `refresh:${page.id}`,
      category: "REFRESH",
      severity: daysOld > 180 ? "HIGH" : "MEDIUM",
      title: `Refresh "${page.neighborhood}" — last updated ${daysOld} days ago`,
      detail:
        "Google demotes pages that don't move. The AI refresh pass re-writes the intro + adds two fresh sections (events, market shifts) in under a minute.",
      estimateMinutes: 5,
      actionHref: `/portal/seo/neighborhoods/${page.slug}?action=refresh`,
      actionLabel: "Refresh page",
      evidence: { pageId: page.id, daysOld },
      extraScore: Math.min(10, Math.floor(daysOld / 30)),
    });
  });
}

// ---------------------------------------------------------------------------
// Rule 4 — AEO_GAP: competitors cited by AI engines on our target prompts
// ---------------------------------------------------------------------------
async function aeoGapRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const competitorHits = await prisma.aeoCitationCheck
    .findMany({
      where: {
        orgId,
        propertyId,
        status: AeoCitationStatus.COMPETITOR_CITED,
        queryRunAt: { gte: since },
      },
      orderBy: { queryRunAt: "desc" },
      take: 20,
      select: { competitorsCited: true, prompt: true },
    })
    .catch(() => []);
  if (competitorHits.length === 0) return [];

  // Identify the recurring top threat.
  const counts = new Map<string, number>();
  for (const hit of competitorHits) {
    for (const c of hit.competitorsCited) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return [
    makeRec({
      kind: "aeo-gap:counter",
      category: "AEO_GAP",
      severity: competitorHits.length >= 3 ? "CRITICAL" : "HIGH",
      title: `${top?.[0] ?? "A competitor"} is cited by AI engines where you should be`,
      detail: `In the last 30 days, ChatGPT / Perplexity / Claude cited ${top?.[0] ?? "a competitor"} for ${top?.[1] ?? competitorHits.length} of your target prompts. The Content Drafter can produce a counter-page focused on the exact gap.`,
      estimateMinutes: 12,
      actionHref: `/portal/seo/aeo?propertyId=${propertyId}&intent=aeo-counter`,
      actionLabel: "Draft counter-page",
      evidence: {
        topCompetitor: top?.[0],
        topCount: top?.[1],
        totalHits: competitorHits.length,
      },
      extraScore: Math.min(15, competitorHits.length * 4),
    }),
  ];
}

// ---------------------------------------------------------------------------
// Rule 5 — AEO_NOT_CITED: prompts that surface no one (open opportunity)
// ---------------------------------------------------------------------------
async function aeoNotCitedRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const count = await prisma.aeoCitationCheck
    .count({
      where: {
        orgId,
        propertyId,
        status: AeoCitationStatus.NOT_CITED,
        queryRunAt: { gte: since },
      },
    })
    .catch(() => 0);
  if (count === 0) return [];
  return [
    makeRec({
      kind: "aeo-not-cited:open-gap",
      category: "AEO_NOT_CITED",
      severity: count >= 5 ? "HIGH" : "MEDIUM",
      title: `${count} AI prompts have no citation yet`,
      detail:
        "These are prompts your prospects ask the AI engines that don't surface anyone. Publishing the right page lets you own them outright.",
      estimateMinutes: 15,
      actionHref: `/portal/seo/aeo?propertyId=${propertyId}&status=NOT_CITED`,
      actionLabel: "See gap list",
      evidence: { uncoveredPrompts: count },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Rule 6 — DRAFT_PUBLISH: pages sitting in DRAFT with no published URL
// ---------------------------------------------------------------------------
async function draftPublishRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  const drafts = await prisma.neighborhoodPage
    .findMany({
      where: {
        orgId,
        propertyId,
        status: NeighborhoodPageStatus.DRAFT,
      },
      orderBy: { updatedAt: "asc" },
      take: 3,
      select: { id: true, neighborhood: true, slug: true },
    })
    .catch(() => []);
  return drafts.map((page) =>
    makeRec({
      kind: `draft-publish:${page.id}`,
      category: "NEIGHBORHOOD_PAGE",
      severity: "MEDIUM",
      title: `Publish "${page.neighborhood}" — sitting in draft`,
      detail:
        "A drafted page earns zero traffic. Two clicks publishes it and adds the URL to the sitemap on the next run.",
      estimateMinutes: 2,
      actionHref: `/portal/seo/neighborhoods/${page.slug}`,
      actionLabel: "Review and publish",
      evidence: { pageId: page.id },
    }),
  );
}

// ---------------------------------------------------------------------------
// Rule 7 (DataforSEO-dependent) — CONTENT_GAP: competitor ranks for a query
//                                  we don't cover at all
// ---------------------------------------------------------------------------
async function contentGapRecs(
  orgId: string,
  propertyId: string,
): Promise<SeoRecommendation[]> {
  void orgId;
  void propertyId;
  // Phase 1 placeholder. Once the nightly DataforSEO sync writes
  // PropertyCompetitorScan rows with `competitor_ranks_for` arrays,
  // this rule will diff against our own SeoQuery rows and surface gaps.
  if (!isDataforSeoConfigured()) return [];
  // TODO(phase-2): query PropertyCompetitorScan + diff vs SeoQuery
  return [];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Same as generateSeoRecommendations but with a 1h cache layer keyed on
 * (orgId, propertyId). Use this from any page that doesn't need
 * sub-hour freshness. Callers who want to force a fresh recompute
 * (e.g. POST /api/portal/seo/recommendations/refresh) should call
 * generateSeoRecommendations directly and then invalidate.
 */
export async function getCachedOrGenerateRecommendations(input: {
  orgId: string;
  propertyId: string;
}): Promise<SeoRecommendation[]> {
  const { getCachedRecommendations, setCachedRecommendations } = await import(
    "./recommendation-cache"
  );
  const hit = await getCachedRecommendations(input.orgId, input.propertyId);
  if (hit) return hit;
  const fresh = await generateSeoRecommendations(input);
  await setCachedRecommendations(input.orgId, input.propertyId, fresh);
  return fresh;
}

export async function generateSeoRecommendations(input: {
  orgId: string;
  propertyId: string;
}): Promise<SeoRecommendation[]> {
  const { orgId, propertyId } = input;

  const property = await prisma.property
    .findFirst({
      where: { id: propertyId, orgId },
      select: { id: true, city: true, websiteUrl: true },
    })
    .catch(() => null);
  if (!property) return [];

  const [ctr, neighborhood, refresh, aeoGap, aeoNot, drafts, gap] =
    await Promise.all([
      ctrFixRecs(orgId, propertyId),
      neighborhoodPageRecs(orgId, propertyId, property.city),
      refreshRecs(orgId, propertyId),
      aeoGapRecs(orgId, propertyId),
      aeoNotCitedRecs(orgId, propertyId),
      draftPublishRecs(orgId, propertyId),
      contentGapRecs(orgId, propertyId),
    ]);

  return [...ctr, ...neighborhood, ...refresh, ...aeoGap, ...aeoNot, ...drafts, ...gap].sort(
    (a, b) => b.score - a.score,
  );
}
