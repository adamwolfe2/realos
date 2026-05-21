import "server-only";

// ---------------------------------------------------------------------------
// DataforSEO sync orchestrator.
//
// Per-property scan that pulls live data from DataforSEO and caches it
// in our DB. Designed to be called from:
//
//   /api/cron/dataforseo-sync     — daily 04:00 UTC, all LIVE properties
//   /api/portal/seo/recommendations/refresh — operator on-demand refresh
//
// Per property the scan runs:
//
//   1. SERP rankings — for each active SeoTargetQuery (capped at 4),
//      one organic SERP call. Writes SerpRanking.
//   2. On-page Lighthouse — one call against the property's homepage.
//      Writes OnPageAudit.
//   3. Backlinks summary — one call against the property's domain.
//      Writes BacklinkSummary.
//   4. DataforSEO Labs competitors — one call to enrich
//      PropertyCompetitorScan with organic-rank competitors.
//
// Cost guard: ~$0.05 per property per day. The cron caps batch size at
// 50 properties so per-run cost is bounded at ~$2.50 / day.
//
// Auto-derivation: if a property has no active SeoTargetQuery rows,
// we generate 2-4 starter queries from its facts (city + subtype +
// branded) before the first SERP call.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import {
  fetchSerpOrganic,
  fetchLighthouseScores,
  fetchBacklinksSummary,
  fetchCompetitorDomains,
  isDataforSeoConfigured,
} from "./dataforseo";
import { deriveStarterQueries } from "./derive-queries";
import { CompetitorScanSource } from "@prisma/client";

const MAX_QUERIES_PER_PROPERTY = 4;

export type SyncStats = {
  serpQueriesScanned: number;
  lighthouseAudits: number;
  backlinkSummaries: number;
  competitorRows: number;
  errors: Array<{ stage: string; propertyId: string; error: string }>;
  costEstimateUsd: number;
};

function todayUtcStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function deriveDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Run a full DataforSEO scan against a single property. Returns the
 * stats so the cron handler can aggregate + log.
 *
 * Safe to call without DataforSEO keys configured — every fetch falls
 * through with { skipped: true } and we just return zero stats.
 */
export async function syncPropertyFromDataforSeo(input: {
  orgId: string;
  propertyId: string;
}): Promise<SyncStats> {
  const stats: SyncStats = {
    serpQueriesScanned: 0,
    lighthouseAudits: 0,
    backlinkSummaries: 0,
    competitorRows: 0,
    errors: [],
    costEstimateUsd: 0,
  };

  if (!isDataforSeoConfigured()) return stats;

  const property = await prisma.property.findFirst({
    where: { id: input.propertyId, orgId: input.orgId },
    select: {
      id: true,
      orgId: true,
      name: true,
      city: true,
      state: true,
      addressLine1: true,
      websiteUrl: true,
      residentialSubtype: true,
      commercialSubtype: true,
      propertyType: true,
    },
  });
  if (!property) return stats;

  const today = todayUtcStart();

  // -------------------------------------------------------------------------
  // Step 0 — ensure the property has at least 1 target query (auto-derive).
  // -------------------------------------------------------------------------
  let targetQueries = await prisma.seoTargetQuery.findMany({
    where: { orgId: property.orgId, propertyId: property.id, active: true },
    take: MAX_QUERIES_PER_PROPERTY,
    orderBy: { createdAt: "asc" },
  });

  if (targetQueries.length === 0) {
    const derived = deriveStarterQueries(property);
    for (const d of derived) {
      try {
        await prisma.seoTargetQuery.upsert({
          where: {
            orgId_propertyId_query: {
              orgId: property.orgId,
              propertyId: property.id,
              query: d.query,
            },
          },
          create: {
            orgId: property.orgId,
            propertyId: property.id,
            query: d.query,
            intent: d.intent,
            addedBy: null,
            active: true,
          },
          update: {},
        });
      } catch (err) {
        stats.errors.push({
          stage: "derive-query",
          propertyId: property.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    targetQueries = await prisma.seoTargetQuery.findMany({
      where: { orgId: property.orgId, propertyId: property.id, active: true },
      take: MAX_QUERIES_PER_PROPERTY,
      orderBy: { createdAt: "asc" },
    });
  }

  // -------------------------------------------------------------------------
  // Step 1 — SERP ranking per target query.
  // -------------------------------------------------------------------------
  const ourDomain = deriveDomainFromUrl(property.websiteUrl);
  for (const tq of targetQueries) {
    const res = await fetchSerpOrganic({
      query: tq.query,
      locationCode: tq.locationCode ?? 2840,
    });
    if (!("ok" in res) || !res.ok) {
      if ("error" in res && res.error) {
        stats.errors.push({
          stage: "serp",
          propertyId: property.id,
          error: `${tq.query}: ${res.error}`,
        });
      }
      continue;
    }
    stats.costEstimateUsd += res.costUsd;
    stats.serpQueriesScanned += 1;

    // Find our rank: first result whose domain matches ourDomain.
    let ourRank: number | null = null;
    let ourUrl: string | null = null;
    if (ourDomain) {
      for (const item of res.data) {
        if (item.domain && item.domain.replace(/^www\./, "") === ourDomain) {
          ourRank = item.rank_absolute;
          ourUrl = item.url;
          break;
        }
      }
    }
    const top10 = res.data.slice(0, 10).map((r) => ({
      rank: r.rank_absolute,
      domain: r.domain,
      url: r.url,
      title: r.title,
      description: r.description,
    }));

    try {
      await prisma.serpRanking.upsert({
        where: {
          orgId_propertyId_query_date: {
            orgId: property.orgId,
            propertyId: property.id,
            query: tq.query,
            date: today,
          },
        },
        create: {
          orgId: property.orgId,
          propertyId: property.id,
          targetQueryId: tq.id,
          query: tq.query,
          date: today,
          ourRank,
          ourUrl,
          topResults: top10 as unknown as object,
        },
        update: {
          targetQueryId: tq.id,
          ourRank,
          ourUrl,
          topResults: top10 as unknown as object,
        },
      });
    } catch (err) {
      stats.errors.push({
        stage: "serp-write",
        propertyId: property.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 2 — On-page Lighthouse audit for the property's homepage.
  // -------------------------------------------------------------------------
  if (property.websiteUrl) {
    const auditRes = await fetchLighthouseScores({ url: property.websiteUrl });
    if ("ok" in auditRes && auditRes.ok) {
      stats.costEstimateUsd += auditRes.costUsd;
      stats.lighthouseAudits += 1;
      try {
        await prisma.onPageAudit.upsert({
          where: {
            orgId_url_date: {
              orgId: property.orgId,
              url: property.websiteUrl,
              date: today,
            },
          },
          create: {
            orgId: property.orgId,
            propertyId: property.id,
            url: property.websiteUrl,
            date: today,
            performance: auditRes.data.performance,
            accessibility: auditRes.data.accessibility,
            bestPractices: auditRes.data.best_practices,
            seo: auditRes.data.seo,
            pwa: auditRes.data.pwa,
          },
          update: {
            propertyId: property.id,
            performance: auditRes.data.performance,
            accessibility: auditRes.data.accessibility,
            bestPractices: auditRes.data.best_practices,
            seo: auditRes.data.seo,
            pwa: auditRes.data.pwa,
          },
        });
      } catch (err) {
        stats.errors.push({
          stage: "lighthouse-write",
          propertyId: property.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if ("error" in auditRes && auditRes.error) {
      stats.errors.push({
        stage: "lighthouse",
        propertyId: property.id,
        error: auditRes.error,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 3 — Backlinks summary for the property's domain.
  // -------------------------------------------------------------------------
  if (ourDomain) {
    const blRes = await fetchBacklinksSummary({ target: ourDomain });
    if ("ok" in blRes && blRes.ok) {
      stats.costEstimateUsd += blRes.costUsd;
      stats.backlinkSummaries += 1;
      try {
        await prisma.backlinkSummary.upsert({
          where: {
            orgId_target_date: {
              orgId: property.orgId,
              target: ourDomain,
              date: today,
            },
          },
          create: {
            orgId: property.orgId,
            propertyId: property.id,
            target: ourDomain,
            date: today,
            domainRank: blRes.data.rank,
            backlinks: blRes.data.backlinks,
            referringDomains: blRes.data.referring_domains,
            referringMainDomains: blRes.data.referring_main_domains,
          },
          update: {
            propertyId: property.id,
            domainRank: blRes.data.rank,
            backlinks: blRes.data.backlinks,
            referringDomains: blRes.data.referring_domains,
            referringMainDomains: blRes.data.referring_main_domains,
          },
        });
      } catch (err) {
        stats.errors.push({
          stage: "backlinks-write",
          propertyId: property.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else if ("error" in blRes && blRes.error) {
      stats.errors.push({
        stage: "backlinks",
        propertyId: property.id,
        error: blRes.error,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Step 4 — Organic competitor domains (enriches PropertyCompetitorScan).
  // -------------------------------------------------------------------------
  if (ourDomain) {
    const compRes = await fetchCompetitorDomains({
      domain: ourDomain,
      limit: 10,
    });
    if ("ok" in compRes && compRes.ok) {
      stats.costEstimateUsd += compRes.costUsd;
      for (const c of compRes.data) {
        try {
          await prisma.propertyCompetitorScan.upsert({
            where: {
              propertyId_source_externalId: {
                propertyId: property.id,
                source: CompetitorScanSource.DATAFORSEO_COMPETITORS_DOMAIN,
                externalId: c.domain,
              },
            },
            create: {
              orgId: property.orgId,
              propertyId: property.id,
              source: CompetitorScanSource.DATAFORSEO_COMPETITORS_DOMAIN,
              externalId: c.domain,
              competitorName: c.domain,
              competitorUrl: `https://${c.domain}`,
              competitorAddress: null,
              distanceMeters: null,
              rating: null,
              reviewCount: null,
              amenities: [],
              rankingQueries: { intersections: c.intersections } as object,
              rawPayload: JSON.parse(JSON.stringify(c)),
              scannedAt: new Date(),
            },
            update: {
              competitorName: c.domain,
              competitorUrl: `https://${c.domain}`,
              rankingQueries: { intersections: c.intersections } as object,
              rawPayload: JSON.parse(JSON.stringify(c)),
              scannedAt: new Date(),
            },
          });
          stats.competitorRows += 1;
        } catch (err) {
          stats.errors.push({
            stage: "competitor-write",
            propertyId: property.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } else if ("error" in compRes && compRes.error) {
      stats.errors.push({
        stage: "competitors",
        propertyId: property.id,
        error: compRes.error,
      });
    }
  }

  return stats;
}
