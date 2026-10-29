import "server-only";
import { prisma } from "@/lib/db";
import { AdPlatform, AuditAction, Prisma, type AdAccount } from "@prisma/client";
import {
  fetchGoogleAdsAdDailyMetrics,
  fetchGoogleAdsAds,
  fetchGoogleAdsCampaigns,
  fetchGoogleAdsDailyMetrics,
  resolveGoogleAdsCredentials,
  type GoogleAdCreative,
  type GoogleAdDailyMetric,
  type GoogleAdsCampaign,
  type GoogleAdsDailyMetric,
} from "./google-ads";
import {
  fetchMetaAdDailyMetrics,
  fetchMetaAds,
  fetchMetaAdsCampaigns,
  fetchMetaAdsDailyMetrics,
  resolveMetaAdsCredentials,
  type MetaAdCreative,
  type MetaAdDailyMetric,
  type MetaAdsCampaign,
  type MetaAdsDailyMetric,
} from "./meta-ads";

// ---------------------------------------------------------------------------
// Cross-platform ad sync worker.
//
// For each AdAccount with autoSyncEnabled=true:
//   1. Pull current campaign list from the platform (upsert into AdCampaign).
//   2. Pull daily metrics for the requested window (default: yesterday only;
//      backfill mode: last 30 days). Upsert into AdMetricDaily.
//   3. Refresh AdCampaign denorm totals (impressions/clicks/conversions and
//      spendToDateCents) from AdMetricDaily.
//
// Idempotent. Safe to call repeatedly. Each platform fetch is wrapped so a
// single failing account doesn't kill the rest of the cron run.
// ---------------------------------------------------------------------------

export type AdsSyncStats = {
  campaignsUpserted: number;
  metricRowsUpserted: number;
  creativesUpserted: number;
  creativeMetricRowsUpserted: number;
  warnings: string[];
  /** Campaign/metric writes that threw; any > 0 holds the watermark. */
  failedWrites: number;
};

export type AdsSyncResult = {
  ok: boolean;
  stats: AdsSyncStats;
  error?: string;
};

export type AdsSyncOptions = {
  fullBackfill?: boolean;     // Pull last 30 days instead of just yesterday.
  startDate?: Date;
  endDate?: Date;
};

export async function runAdsSyncForAccount(
  adAccountId: string,
  options: AdsSyncOptions = {}
): Promise<AdsSyncResult> {
  const stats: AdsSyncStats = {
    campaignsUpserted: 0,
    metricRowsUpserted: 0,
    creativesUpserted: 0,
    creativeMetricRowsUpserted: 0,
    warnings: [],
    failedWrites: 0,
  };

  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  });
  if (!account) {
    return { ok: false, stats, error: "AdAccount not found" };
  }

  const { startDate, endDate } = resolveSyncWindow(
    new Date(),
    account.lastSyncAt,
    options,
  );

  try {
    if (account.platform === AdPlatform.GOOGLE_ADS) {
      await syncGoogleAds(account, startDate, endDate, stats);
    } else if (account.platform === AdPlatform.META) {
      await syncMetaAds(account, startDate, endDate, stats);
    } else {
      stats.warnings.push(`Unsupported platform: ${account.platform}`);
    }

    await refreshCampaignTotals(account.id);

    // Guarded: a disconnect during this run set "revoked"; a late sync must
    // not flip it back to active.
    await prisma.adAccount.updateMany({
      // NULL accessStatus (pre-column rows) must still advance; `not` alone skips NULL in SQL.
      where: { id: account.id, OR: [{ accessStatus: null }, { accessStatus: { not: "revoked" } }] },
      data: {
        // Hold the watermark when rows failed to write, so the next run's
        // window re-pulls those days (resolveSyncWindow starts at lastSyncAt).
        ...(stats.failedWrites === 0 ? { lastSyncAt: new Date() } : {}),
        lastSyncError: null,
        accessStatus: "active",
      },
    });

    await prisma.auditEvent.create({
      data: {
        orgId: account.orgId,
        action: AuditAction.SETTING_CHANGE,
        entityType: "AdAccount",
        entityId: account.id,
        description: `Ads sync completed (${account.platform})`,
        diff: {
          campaignsUpserted: stats.campaignsUpserted,
          metricRowsUpserted: stats.metricRowsUpserted,
          creativesUpserted: stats.creativesUpserted,
          creativeMetricRowsUpserted: stats.creativeMetricRowsUpserted,
          warnings: stats.warnings,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.adAccount.updateMany({
      // NULL accessStatus (pre-column rows) must still advance; `not` alone skips NULL in SQL.
      where: { id: account.id, OR: [{ accessStatus: null }, { accessStatus: { not: "revoked" } }] },
      data: {
        lastSyncError: message,
        accessStatus: "error",
      },
    });
    return { ok: false, stats, error: message };
  }
}

// ---------------------------------------------------------------------------
// Per-platform sync paths
// ---------------------------------------------------------------------------

async function syncGoogleAds(
  account: AdAccount,
  startDate: Date,
  endDate: Date,
  stats: AdsSyncStats
): Promise<void> {
  // resolveGoogleAdsCredentials prefers an OAuthConnection row scoped to the
  // same externalAccountId (the customer the operator picked in the picker
  // page) and falls back to the legacy AdAccount.credentialsEncrypted paste
  // blob. Either path returns the same GoogleAdsCredentials shape.
  const creds = await resolveGoogleAdsCredentials(account.orgId, account, {
    externalAccountId: account.externalAccountId,
  });
  const customerId = account.externalAccountId;

  const campaigns = await fetchGoogleAdsCampaigns(creds, customerId);
  await upsertCampaigns(account, campaigns, AdPlatform.GOOGLE_ADS, stats);

  const metrics = await fetchGoogleAdsDailyMetrics(
    creds,
    customerId,
    startDate,
    endDate
  );
  await upsertMetrics(account, metrics, stats);

  await syncCreatives(
    account,
    () => fetchGoogleAdsAds(creds, customerId),
    () => fetchGoogleAdsAdDailyMetrics(creds, customerId, startDate, endDate),
    stats,
  );
}

async function syncMetaAds(
  account: AdAccount,
  startDate: Date,
  endDate: Date,
  stats: AdsSyncStats
): Promise<void> {
  // Same OAuth-first pattern as syncGoogleAds — prefer OAuthConnection,
  // fall back to legacy AdAccount.credentialsEncrypted.
  const creds = await resolveMetaAdsCredentials(account.orgId, account, {
    externalAccountId: account.externalAccountId,
  });
  const adAccountId = account.externalAccountId;

  const campaigns = await fetchMetaAdsCampaigns(creds, adAccountId);
  await upsertCampaigns(account, campaigns, AdPlatform.META, stats);

  const metrics = await fetchMetaAdsDailyMetrics(
    creds,
    adAccountId,
    startDate,
    endDate
  );
  await upsertMetrics(account, metrics, stats);

  await syncCreatives(
    account,
    () => fetchMetaAds(creds, adAccountId),
    () => fetchMetaAdDailyMetrics(creds, adAccountId, startDate, endDate),
    stats,
  );
}

// ---------------------------------------------------------------------------
// Per-ad creatives. Runs after the campaign phase so a creative-side API
// failure (new endpoint, missing permission on an old token) never costs
// the campaign data: it is recorded as a warning + failed write, which
// holds the watermark so the window is re-pulled next run.
// ---------------------------------------------------------------------------

type CreativeRecord = GoogleAdCreative | MetaAdCreative;
type CreativeDailyMetric = GoogleAdDailyMetric | MetaAdDailyMetric;

async function syncCreatives(
  account: AdAccount,
  fetchAds: () => Promise<CreativeRecord[]>,
  fetchAdMetrics: () => Promise<CreativeDailyMetric[]>,
  stats: AdsSyncStats,
): Promise<void> {
  try {
    const ads = await fetchAds();
    await upsertCreatives(account, ads, stats);
    const metrics = await fetchAdMetrics();
    await upsertCreativeMetrics(account, metrics, stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.failedWrites += 1;
    stats.warnings.push(`creatives: ${message}`);
  }
}

async function upsertCreatives(
  account: AdAccount,
  ads: CreativeRecord[],
  stats: AdsSyncStats,
): Promise<void> {
  const campaignRows = await prisma.adCampaign.findMany({
    where: { adAccountId: account.id },
    select: { id: true, externalCampaignId: true },
  });
  const campaignIdByExternal = new Map<string, string>();
  for (const c of campaignRows) {
    if (c.externalCampaignId) campaignIdByExternal.set(c.externalCampaignId, c.id);
  }

  const seenAt = new Date();
  for (const ad of ads) {
    const fields = {
      campaignId: ad.externalCampaignId ? campaignIdByExternal.get(ad.externalCampaignId) ?? null : null,
      name: ad.name,
      status: ad.status,
      format: ad.format,
      thumbnailUrl: ad.thumbnailUrl,
      imageUrl: ad.imageUrl,
      videoId: ad.videoId,
      headline: ad.headline,
      body: ad.body,
      ctaType: ad.ctaType,
      landingUrl: ad.landingUrl,
      lastSeenAt: seenAt,
    };
    try {
      await prisma.adCreative.upsert({
        where: {
          adAccountId_externalAdId: { adAccountId: account.id, externalAdId: ad.externalAdId },
        },
        create: {
          orgId: account.orgId,
          adAccountId: account.id,
          platform: account.platform,
          externalAdId: ad.externalAdId,
          ...fields,
        },
        update: fields,
      });
      stats.creativesUpserted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.failedWrites += 1;
      stats.warnings.push(`creative ${ad.externalAdId}: ${message}`);
    }
  }
}

async function upsertCreativeMetrics(
  account: AdAccount,
  metrics: CreativeDailyMetric[],
  stats: AdsSyncStats,
): Promise<void> {
  const creativeRows = await prisma.adCreative.findMany({
    where: { adAccountId: account.id },
    select: { id: true, externalAdId: true },
  });
  const idByExternal = new Map(creativeRows.map((c) => [c.externalAdId, c.id]));

  for (const m of metrics) {
    const adCreativeId = idByExternal.get(m.externalAdId);
    if (!adCreativeId) {
      stats.warnings.push(`metrics for ad ${m.externalAdId}: no matching AdCreative row`);
      continue;
    }
    const date = parseISODate(m.date);
    if (!date) {
      stats.warnings.push(`ad metrics row has invalid date: ${m.date}`);
      continue;
    }
    const values = {
      impressions: m.impressions,
      clicks: m.clicks,
      spendCents: m.spendCents,
      conversions: m.conversions,
      ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
      cpcCents: m.clicks > 0 ? Math.round(m.spendCents / m.clicks) : 0,
      costPerConversionCents: m.conversions > 0 ? Math.round(m.spendCents / m.conversions) : 0,
    };
    try {
      await prisma.adCreativeMetricDaily.upsert({
        where: { adCreativeId_date: { adCreativeId, date } },
        create: { orgId: account.orgId, adAccountId: account.id, adCreativeId, date, ...values },
        update: values,
      });
      stats.creativeMetricRowsUpserted += 1;
    } catch (err) {
      stats.failedWrites += 1;
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.warnings.push(`ad metrics ad=${m.externalAdId} date=${m.date}: ${message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Generic upserts
// ---------------------------------------------------------------------------

async function upsertCampaigns(
  account: AdAccount,
  campaigns: (GoogleAdsCampaign | MetaAdsCampaign)[],
  platform: AdPlatform,
  stats: AdsSyncStats
): Promise<void> {
  for (const c of campaigns) {
    try {
      await prisma.adCampaign.upsert({
        where: {
          adAccountId_externalCampaignId: {
            adAccountId: account.id,
            externalCampaignId: c.externalCampaignId,
          },
        },
        create: {
          orgId: account.orgId,
          adAccountId: account.id,
          platform,
          externalCampaignId: c.externalCampaignId,
          name: c.name,
          status: c.status,
          objective: c.objective,
          dailyBudgetCents: c.dailyBudgetCents,
          startDate: c.startDate,
          endDate: c.endDate,
          startedAt: c.startDate,
          endedAt: c.endDate,
        },
        update: {
          name: c.name,
          status: c.status,
          objective: c.objective,
          dailyBudgetCents: c.dailyBudgetCents,
          startDate: c.startDate,
          endDate: c.endDate,
          startedAt: c.startDate,
          endedAt: c.endDate,
        },
      });
      stats.campaignsUpserted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.failedWrites += 1;
      stats.warnings.push(`campaign ${c.externalCampaignId}: ${message}`);
    }
  }
}

async function upsertMetrics(
  account: AdAccount,
  metrics: (GoogleAdsDailyMetric | MetaAdsDailyMetric)[],
  stats: AdsSyncStats
): Promise<void> {
  // Build a lookup of externalCampaignId → AdCampaign.id.
  const campaignRows = await prisma.adCampaign.findMany({
    where: { adAccountId: account.id },
    select: { id: true, externalCampaignId: true },
  });
  const idByExternal = new Map<string, string>();
  for (const c of campaignRows) {
    if (c.externalCampaignId) idByExternal.set(c.externalCampaignId, c.id);
  }

  for (const m of metrics) {
    const campaignId = idByExternal.get(m.externalCampaignId);
    if (!campaignId) {
      stats.warnings.push(
        `metrics for campaign ${m.externalCampaignId}: no matching AdCampaign row`
      );
      continue;
    }
    const date = parseISODate(m.date);
    if (!date) {
      stats.warnings.push(`metrics row has invalid date: ${m.date}`);
      continue;
    }
    const ctr = m.impressions > 0 ? m.clicks / m.impressions : 0;
    const cpcCents = m.clicks > 0 ? Math.round(m.spendCents / m.clicks) : 0;
    const costPerConversionCents =
      m.conversions > 0 ? Math.round(m.spendCents / m.conversions) : 0;

    try {
      await prisma.adMetricDaily.upsert({
        where: {
          campaignId_date: {
            campaignId,
            date,
          },
        },
        create: {
          orgId: account.orgId,
          adAccountId: account.id,
          campaignId,
          date,
          impressions: m.impressions,
          clicks: m.clicks,
          spendCents: m.spendCents,
          conversions: m.conversions,
          conversionValueCents: m.conversionValueCents,
          ctr,
          cpcCents,
          costPerConversionCents,
          raw: m as unknown as Prisma.InputJsonValue,
        },
        update: {
          impressions: m.impressions,
          clicks: m.clicks,
          spendCents: m.spendCents,
          conversions: m.conversions,
          conversionValueCents: m.conversionValueCents,
          ctr,
          cpcCents,
          costPerConversionCents,
          raw: m as unknown as Prisma.InputJsonValue,
        },
      });
      stats.metricRowsUpserted += 1;
    } catch (err) {
      stats.failedWrites += 1;
      const message = err instanceof Error ? err.message : "Unknown error";
      stats.warnings.push(
        `metrics campaign=${m.externalCampaignId} date=${m.date}: ${message}`
      );
    }
  }
}

// Refresh AdCampaign totals from AdMetricDaily so the campaign table can
// render rolling stats without aggregating on every render.
async function refreshCampaignTotals(adAccountId: string): Promise<void> {
  const campaigns = await prisma.adCampaign.findMany({
    where: { adAccountId },
    select: { id: true },
  });
  for (const c of campaigns) {
    const agg = await prisma.adMetricDaily.aggregate({
      where: { campaignId: c.id },
      _sum: {
        impressions: true,
        clicks: true,
        spendCents: true,
        conversions: true,
      },
      _max: { date: true },
    });
    await prisma.adCampaign.update({
      where: { id: c.id },
      data: {
        impressions: agg._sum.impressions ?? 0,
        clicks: agg._sum.clicks ?? 0,
        conversions: Math.round(agg._sum.conversions ?? 0),
        spendToDateCents: agg._sum.spendCents ?? 0,
        lastStatsAt: agg._max.date ?? new Date(),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const BACKFILL_MS = 30 * DAY_MS;

/**
 * Default window starts at the day of the last successful sync (or
 * yesterday, whichever is earlier), so days lost to an outage, expired
 * token, or a backfill cut off by the serverless freeze are re-pulled on
 * the next run. Never-synced accounts get the full 30 days. Capped at 30
 * days; metric rows are upserts, so overlap is harmless.
 */
export function resolveSyncWindow(
  now: Date,
  lastSyncAt: Date | null,
  options: AdsSyncOptions = {},
): { startDate: Date; endDate: Date } {
  const endDate = options.endDate ?? endOfYesterdayUTC(now);
  if (options.startDate) return { startDate: options.startDate, endDate };
  // endDate is inclusive, so 29 days back gives a 30-day window.
  const earliest = new Date(endDate.getTime() - BACKFILL_MS + DAY_MS);
  if (options.fullBackfill || !lastSyncAt) return { startDate: earliest, endDate };
  const lastDay = new Date(
    Date.UTC(lastSyncAt.getUTCFullYear(), lastSyncAt.getUTCMonth(), lastSyncAt.getUTCDate()),
  );
  const yesterday = startOfYesterdayUTC(now);
  const start = lastDay < yesterday ? lastDay : yesterday;
  return { startDate: start < earliest ? earliest : start, endDate };
}

function startOfYesterdayUTC(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

function endOfYesterdayUTC(now: Date): Date {
  const d = startOfYesterdayUTC(now);
  // We want the day itself, not 23:59:59 — date column truncates.
  return d;
}

function parseISODate(input: string): Date | null {
  // Accept YYYY-MM-DD; pad to UTC midnight.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}
