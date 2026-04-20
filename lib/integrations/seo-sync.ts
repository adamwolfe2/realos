import "server-only";
import { prisma } from "@/lib/db";
import { SeoProvider, SeoSyncStatus } from "@prisma/client";
import {
  fetchGscDaily,
  fetchGscQueriesByDate,
  type GscDailyRow,
  type GscQueryRow,
} from "./gsc";
import {
  fetchGa4OrganicDaily,
  fetchGa4OrganicLandingPages,
  type Ga4DailyRow,
  type Ga4LandingPageRow,
} from "./ga4";

// ---------------------------------------------------------------------------
// SEO sync worker.
//
// For a given orgId, pulls data from each connected SEO integration (GSC and/or
// GA4) and upserts into SeoSnapshot, SeoQuery, SeoLandingPage. Re-running for
// the same date window is safe — every write is keyed on a unique tuple of
// (orgId, date[, query|url]).
//
// Date window:
//   - first sync: last 30 days
//   - subsequent: yesterday only (cron path), unless caller passes fromDate
//
// Failures from one provider don't block the other. Errors land in the
// integration row's lastSyncError so they're visible in the portal UI.
// ---------------------------------------------------------------------------

export type SeoSyncStats = {
  gscDays: number;
  gscQueries: number;
  ga4Days: number;
  ga4LandingPages: number;
  warnings: string[];
};

export type SeoSyncResult = {
  ok: boolean;
  stats: SeoSyncStats;
  error?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function parseYmdToUtc(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export async function runSeoSync(
  orgId: string,
  options: { fromDate?: Date; toDate?: Date; fullBackfill?: boolean } = {},
): Promise<SeoSyncResult> {
  const stats: SeoSyncStats = {
    gscDays: 0,
    gscQueries: 0,
    ga4Days: 0,
    ga4LandingPages: 0,
    warnings: [],
  };

  const integrations = await prisma.seoIntegration.findMany({
    where: { orgId },
  });
  if (integrations.length === 0) {
    return {
      ok: false,
      stats,
      error: "No SEO integrations configured for this org.",
    };
  }

  // Default window: yesterday for cron runs; 30 days for first/full backfill.
  const now = new Date();
  const yesterday = startOfUtcDay(new Date(now.getTime() - DAY_MS));
  const toDate = options.toDate ? startOfUtcDay(options.toDate) : yesterday;
  const fullBackfill =
    options.fullBackfill ||
    integrations.every((i) => i.lastSyncAt == null);
  const fromDate = options.fromDate
    ? startOfUtcDay(options.fromDate)
    : fullBackfill
      ? startOfUtcDay(new Date(now.getTime() - 30 * DAY_MS))
      : yesterday;

  // GSC and GA4 each contribute partial fields to the daily SeoSnapshot row;
  // we collect both, then upsert per date with a merged payload.
  const dailyByDate = new Map<
    string,
    {
      organicSessions?: number;
      organicUsers?: number;
      totalImpressions?: number;
      totalClicks?: number;
      avgCtr?: number;
      avgPosition?: number;
    }
  >();

  for (const integration of integrations) {
    if (integration.provider === SeoProvider.GSC) {
      try {
        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: { status: SeoSyncStatus.SYNCING, lastSyncError: null },
        });

        const daily: GscDailyRow[] = await fetchGscDaily(
          integration.serviceAccountJsonEncrypted,
          integration.propertyIdentifier,
          fromDate,
          toDate,
        );
        for (const row of daily) {
          const cur = dailyByDate.get(row.date) ?? {};
          dailyByDate.set(row.date, {
            ...cur,
            totalImpressions: (cur.totalImpressions ?? 0) + row.impressions,
            totalClicks: (cur.totalClicks ?? 0) + row.clicks,
            avgCtr: row.ctr,
            avgPosition: row.position,
          });
        }
        stats.gscDays += daily.length;

        const queries: GscQueryRow[] = await fetchGscQueriesByDate(
          integration.serviceAccountJsonEncrypted,
          integration.propertyIdentifier,
          fromDate,
          toDate,
        );
        for (const q of queries) {
          const date = parseYmdToUtc(q.date);
          if (!date || !q.query) continue;
          await prisma.seoQuery.upsert({
            where: {
              orgId_date_query: {
                orgId,
                date,
                query: q.query,
              },
            },
            create: {
              orgId,
              date,
              query: q.query,
              impressions: q.impressions,
              clicks: q.clicks,
              ctr: q.ctr,
              position: q.position,
            },
            update: {
              impressions: q.impressions,
              clicks: q.clicks,
              ctr: q.ctr,
              position: q.position,
            },
          });
          stats.gscQueries++;
        }

        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: {
            status: SeoSyncStatus.IDLE,
            lastSyncAt: new Date(),
            lastSyncError: null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown GSC error";
        stats.warnings.push(`GSC: ${message}`);
        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: {
            status: SeoSyncStatus.ERROR,
            lastSyncError: message,
          },
        });
      }
    }

    if (integration.provider === SeoProvider.GA4) {
      try {
        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: { status: SeoSyncStatus.SYNCING, lastSyncError: null },
        });

        const daily: Ga4DailyRow[] = await fetchGa4OrganicDaily(
          integration.serviceAccountJsonEncrypted,
          integration.propertyIdentifier,
          fromDate,
          toDate,
        );
        for (const row of daily) {
          const cur = dailyByDate.get(row.date) ?? {};
          dailyByDate.set(row.date, {
            ...cur,
            organicSessions: (cur.organicSessions ?? 0) + row.sessions,
            organicUsers: (cur.organicUsers ?? 0) + row.users,
          });
        }
        stats.ga4Days += daily.length;

        const pages: Ga4LandingPageRow[] = await fetchGa4OrganicLandingPages(
          integration.serviceAccountJsonEncrypted,
          integration.propertyIdentifier,
          fromDate,
          toDate,
        );
        for (const p of pages) {
          const date = parseYmdToUtc(p.date);
          if (!date || !p.url) continue;
          // Strip query string to prevent table cardinality blow-up.
          const url = p.url.split("?")[0] || p.url;
          await prisma.seoLandingPage.upsert({
            where: {
              orgId_date_url: {
                orgId,
                date,
                url,
              },
            },
            create: {
              orgId,
              date,
              url,
              sessions: p.sessions,
              users: p.users,
              bounceRate: p.bounceRate,
              avgEngagementTime: p.avgEngagementTime,
            },
            update: {
              sessions: p.sessions,
              users: p.users,
              bounceRate: p.bounceRate,
              avgEngagementTime: p.avgEngagementTime,
            },
          });
          stats.ga4LandingPages++;
        }

        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: {
            status: SeoSyncStatus.IDLE,
            lastSyncAt: new Date(),
            lastSyncError: null,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown GA4 error";
        stats.warnings.push(`GA4: ${message}`);
        await prisma.seoIntegration.update({
          where: { id: integration.id },
          data: {
            status: SeoSyncStatus.ERROR,
            lastSyncError: message,
          },
        });
      }
    }
  }

  // Now write the merged daily snapshots.
  for (const [dateStr, payload] of dailyByDate.entries()) {
    const date = parseYmdToUtc(dateStr);
    if (!date) continue;
    await prisma.seoSnapshot.upsert({
      where: { orgId_date: { orgId, date } },
      create: {
        orgId,
        date,
        organicSessions: payload.organicSessions ?? 0,
        organicUsers: payload.organicUsers ?? 0,
        totalImpressions: payload.totalImpressions ?? 0,
        totalClicks: payload.totalClicks ?? 0,
        avgCtr: payload.avgCtr ?? 0,
        avgPosition: payload.avgPosition ?? 0,
      },
      update: {
        organicSessions: payload.organicSessions ?? 0,
        organicUsers: payload.organicUsers ?? 0,
        totalImpressions: payload.totalImpressions ?? 0,
        totalClicks: payload.totalClicks ?? 0,
        avgCtr: payload.avgCtr ?? 0,
        avgPosition: payload.avgPosition ?? 0,
      },
    });
  }

  return {
    ok: stats.warnings.length === 0,
    stats,
    error: stats.warnings.length > 0 ? stats.warnings.join("; ") : undefined,
  };
}
