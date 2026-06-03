import "server-only";

// ---------------------------------------------------------------------------
// Data Sinks — single-pane-of-glass for every data sync the platform runs.
//
// The audit caught a class of "lying signal" bugs across cron jobs:
//   - GA4 reported "not connected" while a healthy SeoIntegration row existed
//   - Visitor feed showed cached/stale data with no operator warning
//   - Chatbot served AppFolio inventory from a 4-day-old sync
//
// Each was discovered by accident. This module gives the agency operator a
// deterministic <5s read on every integration's freshness, error streak,
// and 24h throughput by joining CronRun rows against the per-integration
// `lastSyncAt` fields. Re-uses `FRESHNESS_BUDGET` so the "should this be
// fresh by now?" decision matches every other surface (marketplace pills,
// freshness triggers).
//
// Cost model: each summary call costs one Promise.all of cheap aggregations
// — no new tables, no migrations. Safe to fan out per-tenant for the client
// detail page without burning the DB.
//
// Heavy lifting (cron rollup loader, per-integration aggregators, status
// classifier, card builder) lives in `./data-sinks-helpers` so this entry
// point stays under the 400-line cap.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import {
  loadCronRollups,
  aggregateAppFolio,
  aggregateSeo,
  aggregateAds,
  aggregateCursive,
  countDistinctOrgs,
  buildSummaries,
  ALL_CRON_JOBS,
  EMPTY_AGG,
} from "./data-sinks-helpers";

export type {
  SinkProvider,
  SinkStatus,
  DataSinkSummary,
} from "./data-sinks-helpers";

const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Platform-wide variant. Aggregates CronRun + per-integration tables
// across every tenant. tenantsCovered counts distinct orgIds touched in
// the last 24h, null for platform-global pulls (dataforseo, site_intel).
// ---------------------------------------------------------------------------
export async function getPlatformDataSinks() {
  const since24h = new Date(Date.now() - 24 * HOUR);

  const [
    cronRollups,
    appfolioRows,
    seoRows,
    adAccountRows,
    cursiveRows,
    reputationRows,
    aeoRows,
    siteIntelOrgs,
  ] = await Promise.all([
    loadCronRollups(ALL_CRON_JOBS),
    prisma.appFolioIntegration
      .findMany({
        select: {
          orgId: true,
          lastSyncAt: true,
          lastError: true,
          syncStatus: true,
        },
      })
      .catch(() => []),
    prisma.seoIntegration
      .findMany({
        select: {
          orgId: true,
          provider: true,
          lastSyncAt: true,
          lastSyncError: true,
        },
      })
      .catch(() => []),
    prisma.adAccount
      .findMany({
        select: {
          orgId: true,
          platform: true,
          lastSyncAt: true,
          lastSyncError: true,
        },
      })
      .catch(() => []),
    prisma.cursiveIntegration
      .findMany({
        select: {
          orgId: true,
          lastEventAt: true,
          lastSegmentSyncAt: true,
          cursivePixelId: true,
        },
      })
      .catch(() => []),
    prisma.reputationScan
      .findMany({
        where: { createdAt: { gte: since24h } },
        select: { orgId: true },
      })
      .catch(() => []),
    prisma.aeoCitationCheck
      .findMany({
        where: { queryRunAt: { gte: since24h } },
        select: { orgId: true },
      })
      .catch(() => []),
    prisma.siteIntelligence
      .findMany({
        where: { crawledAt: { gte: since24h } },
        select: { orgId: true },
      })
      .catch(() => []),
  ]);

  return buildSummaries({
    cronRollups,
    appfolio: aggregateAppFolio(appfolioRows),
    ga4: aggregateSeo(seoRows, "GA4"),
    gsc: aggregateSeo(seoRows, "GSC"),
    googleAds: aggregateAds(adAccountRows, "GOOGLE_ADS"),
    metaAds: aggregateAds(adAccountRows, "META"),
    cursive: aggregateCursive(cursiveRows),
    reputationTenants: countDistinctOrgs(reputationRows),
    aeoTenants: countDistinctOrgs(aeoRows),
    siteIntelTenants: countDistinctOrgs(siteIntelOrgs),
  });
}

// ---------------------------------------------------------------------------
// Per-tenant variant. Scopes per-integration tables to one orgId.
// tenantsCovered is null (one tenant). CronRun rows stay platform-wide
// (the cron job runs once per tick and processes everyone) — closest
// per-tenant signal is the integration's lastSyncAt field.
// ---------------------------------------------------------------------------
export async function getTenantDataSinks(orgId: string) {
  const [
    cronRollups,
    appfolio,
    seoIntegrations,
    adAccounts,
    cursive,
    siteIntel,
  ] = await Promise.all([
    loadCronRollups(ALL_CRON_JOBS),
    prisma.appFolioIntegration
      .findUnique({
        where: { orgId },
        select: { lastSyncAt: true, lastError: true, syncStatus: true },
      })
      .catch(() => null),
    prisma.seoIntegration
      .findMany({
        where: { orgId },
        select: {
          provider: true,
          lastSyncAt: true,
          lastSyncError: true,
        },
      })
      .catch(() => []),
    prisma.adAccount
      .findMany({
        where: { orgId },
        select: { platform: true, lastSyncAt: true, lastSyncError: true },
      })
      .catch(() => []),
    prisma.cursiveIntegration
      .findMany({
        where: { orgId },
        select: {
          lastEventAt: true,
          lastSegmentSyncAt: true,
          cursivePixelId: true,
        },
      })
      .catch(() => []),
    prisma.siteIntelligence
      .findUnique({
        where: { orgId },
        select: { crawledAt: true },
      })
      .catch(() => null),
  ]);

  const appfolioPer = appfolio
    ? aggregateAppFolio([
        {
          orgId,
          lastSyncAt: appfolio.lastSyncAt,
          lastError: appfolio.lastError,
          syncStatus: appfolio.syncStatus,
        },
      ])
    : EMPTY_AGG;

  const seoForTenant = seoIntegrations.map((s) => ({
    orgId,
    provider: s.provider,
    lastSyncAt: s.lastSyncAt,
    lastSyncError: s.lastSyncError,
  }));
  const adForTenant = adAccounts.map((a) => ({
    orgId,
    platform: a.platform,
    lastSyncAt: a.lastSyncAt,
    lastSyncError: a.lastSyncError,
  }));
  const cursiveForTenant = cursive.map((c) => ({
    orgId,
    lastEventAt: c.lastEventAt,
    lastSegmentSyncAt: c.lastSegmentSyncAt,
    cursivePixelId: c.cursivePixelId,
  }));

  return buildSummaries({
    cronRollups,
    appfolio: appfolioPer,
    ga4: aggregateSeo(seoForTenant, "GA4"),
    gsc: aggregateSeo(seoForTenant, "GSC"),
    googleAds: aggregateAds(adForTenant, "GOOGLE_ADS"),
    metaAds: aggregateAds(adForTenant, "META"),
    cursive: aggregateCursive(cursiveForTenant),
    reputationTenants: null,
    aeoTenants: null,
    siteIntelTenants: siteIntel?.crawledAt ? 1 : 0,
    perTenantOverrides: {
      reputationLastRunAt: null,
      aeoLastRunAt: null,
      siteIntelLastRunAt: siteIntel?.crawledAt ?? null,
    },
  });
}
