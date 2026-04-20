import "server-only";
import { prisma } from "@/lib/db";
import { AdPlatform, AuditAction, Prisma, type AdAccount } from "@prisma/client";
import {
  fetchGoogleAdsCampaigns,
  fetchGoogleAdsDailyMetrics,
  parseGoogleAdsCredentials,
  type GoogleAdsCampaign,
  type GoogleAdsDailyMetric,
} from "./google-ads";
import {
  fetchMetaAdsCampaigns,
  fetchMetaAdsDailyMetrics,
  parseMetaAdsCredentials,
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
  warnings: string[];
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
    warnings: [],
  };

  const account = await prisma.adAccount.findUnique({
    where: { id: adAccountId },
  });
  if (!account) {
    return { ok: false, stats, error: "AdAccount not found" };
  }

  // Window resolution. "Yesterday" by default keeps the cron cheap and
  // matches what most ops dashboards report on.
  const now = new Date();
  const endDate = options.endDate ?? endOfYesterdayUTC(now);
  const startDate =
    options.startDate ??
    (options.fullBackfill
      ? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      : startOfYesterdayUTC(now));

  try {
    if (account.platform === AdPlatform.GOOGLE_ADS) {
      await syncGoogleAds(account, startDate, endDate, stats);
    } else if (account.platform === AdPlatform.META) {
      await syncMetaAds(account, startDate, endDate, stats);
    } else {
      stats.warnings.push(`Unsupported platform: ${account.platform}`);
    }

    await refreshCampaignTotals(account.id);

    await prisma.adAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
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
          warnings: stats.warnings,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { ok: true, stats };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.adAccount.update({
      where: { id: account.id },
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
  const creds = parseGoogleAdsCredentials(account);
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
}

async function syncMetaAds(
  account: AdAccount,
  startDate: Date,
  endDate: Date,
  stats: AdsSyncStats
): Promise<void> {
  const creds = parseMetaAdsCredentials(account);
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
