import "server-only";

// ---------------------------------------------------------------------------
// Runtime logic for data-sinks.ts:
//   - loadCronRollups() — single Promise.all of cron groupBy + latest-N
//   - classifyStatus    — fresh/stale/erroring/dead/missing decision
//   - buildSummaries    — final DataSinkSummary[] assembly
//
// Static catalog (provider tables, types) lives in `./data-sinks-catalog`.
// Per-integration aggregators live in `./data-sinks-aggregators`. Both are
// re-exported here so callers can `import from "./data-sinks-helpers"`.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import {
  maxDate,
  EMPTY_AGG,
  type IntegrationAggregate,
} from "./data-sinks-aggregators";
import {
  CRON_BY_PROVIDER,
  LABEL_BY_PROVIDER,
  expectedIntervalFor,
  type SinkProvider,
  type SinkStatus,
  type DataSinkSummary,
} from "./data-sinks-catalog";

export {
  maxDate,
  aggregateAppFolio,
  aggregateSeo,
  aggregateAds,
  aggregateCursive,
  countDistinctOrgs,
  EMPTY_AGG,
} from "./data-sinks-aggregators";
export type { IntegrationAggregate } from "./data-sinks-aggregators";

export {
  ALL_CRON_JOBS,
  CRON_BY_PROVIDER,
  expectedIntervalFor,
} from "./data-sinks-catalog";
export type {
  SinkProvider,
  SinkStatus,
  DataSinkSummary,
} from "./data-sinks-catalog";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type CronRollup = {
  runsLast24h: number;
  successesLast24h: number;
  errorsLast24h: number;
  rowsLast24h: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorMessage: string | null;
  consecutiveRecentErrors: number;
};

export const EMPTY_ROLLUP: CronRollup = {
  runsLast24h: 0,
  successesLast24h: 0,
  errorsLast24h: 0,
  rowsLast24h: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  consecutiveRecentErrors: 0,
};

// ---------------------------------------------------------------------------
// CronRun rollup. 24h groupBy + latest-N rows for last* timestamps + the
// consecutive-failure streak. Safe-fails to empty when the table is missing.
// ---------------------------------------------------------------------------
export async function loadCronRollups(
  jobNames: string[]
): Promise<Map<string, CronRollup>> {
  const since = new Date(Date.now() - 24 * HOUR);
  const [counts24h, latestPerJob] = await Promise.all([
    prisma.cronRun
      .groupBy({
        by: ["jobName", "status"],
        where: { jobName: { in: jobNames }, startedAt: { gte: since } },
        _count: { _all: true },
        _sum: { recordsProcessed: true },
      })
      .catch(() => [] as Array<{
        jobName: string;
        status: string;
        _count: { _all: number };
        _sum: { recordsProcessed: number | null };
      }>),
    prisma.cronRun
      .findMany({
        where: { jobName: { in: jobNames } },
        select: { jobName: true, startedAt: true, status: true, error: true },
        orderBy: { startedAt: "desc" },
        take: 5 * Math.max(jobNames.length, 1),
      })
      .catch(() => [] as Array<{
        jobName: string;
        startedAt: Date;
        status: string;
        error: string | null;
      }>),
  ]);

  const byJob = new Map<string, CronRollup>();
  for (const jobName of jobNames) byJob.set(jobName, { ...EMPTY_ROLLUP });

  for (const row of counts24h) {
    const cur = byJob.get(row.jobName) ?? { ...EMPTY_ROLLUP };
    const count = row._count._all;
    const rows = row._sum.recordsProcessed ?? 0;
    byJob.set(row.jobName, {
      ...cur,
      runsLast24h: cur.runsLast24h + count,
      successesLast24h:
        cur.successesLast24h + (row.status === "ok" ? count : 0),
      errorsLast24h:
        cur.errorsLast24h +
        (row.status === "error" || row.status === "timeout" ? count : 0),
      rowsLast24h: cur.rowsLast24h + (row.status === "ok" ? rows : 0),
    });
  }

  const seenJobs = new Set<string>();
  const errorStreak = new Map<string, number>();
  const streakClosed = new Set<string>();
  for (const r of latestPerJob) {
    const cur = byJob.get(r.jobName);
    if (!cur) continue;
    if (!seenJobs.has(r.jobName)) {
      seenJobs.add(r.jobName);
      byJob.set(r.jobName, { ...cur, lastRunAt: r.startedAt });
    }
    const after = byJob.get(r.jobName)!;
    if (r.status === "ok" && after.lastSuccessAt == null) {
      byJob.set(r.jobName, { ...after, lastSuccessAt: r.startedAt });
    }
    if (
      (r.status === "error" || r.status === "timeout") &&
      after.lastErrorAt == null
    ) {
      byJob.set(r.jobName, {
        ...after,
        lastErrorAt: r.startedAt,
        lastErrorMessage: r.error ?? after.lastErrorMessage,
      });
    }
    if (!streakClosed.has(r.jobName)) {
      if (r.status === "error" || r.status === "timeout") {
        errorStreak.set(r.jobName, (errorStreak.get(r.jobName) ?? 0) + 1);
      } else if (r.status === "ok") {
        streakClosed.add(r.jobName);
      }
    }
  }

  for (const [jobName, streak] of errorStreak) {
    const cur = byJob.get(jobName);
    if (!cur) continue;
    byJob.set(jobName, { ...cur, consecutiveRecentErrors: streak });
  }

  return byJob;
}

// ---------------------------------------------------------------------------
//   fresh    → last success ≤ expected × 2
//   stale    → last success older than expected window but within 7d
//   erroring → errors in last 24h AND most recent error after last success
//   dead     → no success in 7d OR 3+ consecutive failed runs
//   missing  → no cron run AND no per-integration lastSyncAt
// ---------------------------------------------------------------------------
function classifyStatus(args: {
  provider: SinkProvider;
  lastSuccessAt: Date | null;
  lastErrorAt: Date | null;
  lastRunAt: Date | null;
  errorsLast24h: number;
  consecutiveRecentErrors: number;
}): SinkStatus {
  const {
    provider,
    lastSuccessAt,
    lastErrorAt,
    lastRunAt,
    errorsLast24h,
    consecutiveRecentErrors,
  } = args;

  if (!lastRunAt && !lastSuccessAt) return "missing";

  const now = Date.now();
  const expected = expectedIntervalFor(provider);
  const sevenDaysAgo = now - 7 * DAY;
  const successAgeMs = lastSuccessAt ? now - lastSuccessAt.getTime() : null;

  if (
    (lastSuccessAt == null && (lastRunAt?.getTime() ?? 0) < sevenDaysAgo) ||
    (lastSuccessAt != null && lastSuccessAt.getTime() < sevenDaysAgo) ||
    consecutiveRecentErrors >= 3
  ) {
    return "dead";
  }

  if (
    errorsLast24h > 0 &&
    lastErrorAt &&
    (!lastSuccessAt || lastErrorAt > lastSuccessAt)
  ) {
    return "erroring";
  }

  if (successAgeMs == null) return "stale";
  if (successAgeMs <= expected * 2) return "fresh";
  return "stale";
}

// ---------------------------------------------------------------------------
// Final card builder. Combines cron rollups + per-integration aggregates
// into the shipping DataSinkSummary array.
// ---------------------------------------------------------------------------
export function buildSummaries(input: {
  cronRollups: Map<string, CronRollup>;
  appfolio: IntegrationAggregate;
  ga4: IntegrationAggregate;
  gsc: IntegrationAggregate;
  googleAds: IntegrationAggregate;
  metaAds: IntegrationAggregate;
  cursive: IntegrationAggregate;
  reputationTenants: number | null;
  aeoTenants: number | null;
  siteIntelTenants: number | null;
  perTenantOverrides?: {
    reputationLastRunAt: Date | null;
    aeoLastRunAt: Date | null;
    siteIntelLastRunAt: Date | null;
  };
}): DataSinkSummary[] {
  const providers: SinkProvider[] = [
    "appfolio",
    "ga4",
    "gsc",
    "google_ads",
    "meta_ads",
    "cursive_pixel",
    "reputation",
    "aeo",
    "dataforseo",
    "site_intelligence",
  ];

  const aggByProvider: Record<SinkProvider, IntegrationAggregate | null> = {
    appfolio: input.appfolio,
    ga4: input.ga4,
    gsc: input.gsc,
    google_ads: input.googleAds,
    meta_ads: input.metaAds,
    cursive_pixel: input.cursive,
    reputation: null,
    aeo: null,
    dataforseo: null,
    site_intelligence: null,
  };

  const tenantsByProvider: Record<SinkProvider, number | null> = {
    appfolio: input.appfolio.tenantsCovered,
    ga4: input.ga4.tenantsCovered,
    gsc: input.gsc.tenantsCovered,
    google_ads: input.googleAds.tenantsCovered,
    meta_ads: input.metaAds.tenantsCovered,
    cursive_pixel: input.cursive.tenantsCovered,
    reputation: input.reputationTenants,
    aeo: input.aeoTenants,
    dataforseo: null,
    site_intelligence: input.siteIntelTenants,
  };

  return providers.map((provider) => {
    const cronJobName = CRON_BY_PROVIDER[provider];
    const cron = cronJobName
      ? input.cronRollups.get(cronJobName) ?? EMPTY_ROLLUP
      : EMPTY_ROLLUP;
    const agg = aggByProvider[provider];

    // Per-integration lastSyncAt is often fresher than CronRun rollup
    // (manual button click writes lastSyncAt without a CronRun row).
    const lastSuccessAt = maxDate(cron.lastSuccessAt, agg?.lastSyncAt ?? null);
    let lastRunAt = maxDate(cron.lastRunAt, agg?.lastSyncAt ?? null);

    const overrides = input.perTenantOverrides;
    if (overrides) {
      if (provider === "reputation") {
        lastRunAt = maxDate(lastRunAt, overrides.reputationLastRunAt);
      } else if (provider === "aeo") {
        lastRunAt = maxDate(lastRunAt, overrides.aeoLastRunAt);
      } else if (provider === "site_intelligence") {
        lastRunAt = maxDate(lastRunAt, overrides.siteIntelLastRunAt);
      }
    }

    const lastErrorAt = maxDate(cron.lastErrorAt, agg?.lastErrorAt ?? null);
    const lastErrorMessage =
      cron.lastErrorMessage ?? agg?.lastErrorMessage ?? null;

    const status = classifyStatus({
      provider,
      lastSuccessAt,
      lastErrorAt,
      lastRunAt,
      errorsLast24h: cron.errorsLast24h,
      consecutiveRecentErrors: cron.consecutiveRecentErrors,
    });

    return {
      provider,
      label: LABEL_BY_PROVIDER[provider],
      cronJobName,
      status,
      lastRunAt,
      lastSuccessAt,
      lastErrorAt,
      lastErrorMessage,
      runsLast24h: cron.runsLast24h,
      successesLast24h: cron.successesLast24h,
      errorsLast24h: cron.errorsLast24h,
      rowsLast24h: cronJobName ? cron.rowsLast24h : null,
      expectedIntervalMs: expectedIntervalFor(provider),
      tenantsCovered: tenantsByProvider[provider],
    };
  });
}
