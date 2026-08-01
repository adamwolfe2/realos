import "server-only";
import { prisma } from "@/lib/db";
import { SeoProvider, SeoSyncStatus, Prisma } from "@prisma/client";
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
// GA4) and writes into SeoSnapshot, SeoQuery, SeoLandingPage. Re-running for
// the same date window is safe — every write is keyed on (orgId, propertyId,
// date[, query|url]), matching the two partial unique indexes added in
// prisma/migrations/20260801_add_seo_metrics_property_dimension (one row per
// org-wide date, one row per property per date).
//
// Property scoping (Wave 3 Phase 5): each SeoIntegration carries its own
// propertyId (NULL = org-wide legacy integration). Every write below is
// keyed by the integration that produced it, so a run for one property's
// GSC/GA4 connection only ever touches rows scoped to that property — it
// can no longer collide with a sibling property's rows. Uniqueness is a
// partial index, not a Prisma-level @@unique, so upsert() can't be used
// (Prisma requires a full @@unique to build the upsert's WHERE); we use
// find-then-write instead, matching lib/actions/seo-connect.ts. Every
// find-then-write below is race-safe: a concurrent run that also misses
// the findFirst and loses the create gets caught on the resulting P2002
// and falls back to updating the winner's row instead of failing the sync.
//
// Double-counting write-side policy (2026-08-01 addendum): once a
// property-scoped integration has synced a date, that property's rows
// fully re-cover the org's traffic for that date (property rows across
// all of the org's property-scoped integrations sum to what the legacy
// blended org-wide row used to represent). So after writing property-
// scoped rows for a run's date window, we deleteMany the org-wide
// (propertyId NULL) rows for those SAME dates — UNLESS this same run also
// wrote a fresh NULL row for that date (i.e. a NULL-scoped integration is
// still active and contributed that date), in which case the NULL row is
// left alone. This keeps org-wide reads (lib/dashboard/queries.ts,
// lib/briefing/queries.ts, app/portal/seo/page.tsx, etc.) simple
// unscoped SUMs — no double-counting NULL + property rows for the same
// date — without those read sites needing any propertyId-aware logic.
// Transient dips between two integrations' runs are acceptable; NULL-
// scoped-only orgs are entirely unaffected (nothing ever supersedes them).
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

function isP2002(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** Track which ymd date strings got a NULL-scoped vs property-scoped write
 *  this run, per table, so the supersede-cleanup below only deletes NULL
 *  rows for dates a NULL-scoped integration did NOT also just write. */
function makeDateTracker() {
  return {
    nullDates: new Set<string>(),
    propertyDates: new Set<string>(),
    record(propertyId: string | null, date: string) {
      (propertyId ? this.propertyDates : this.nullDates).add(date);
    },
    superseded(): string[] {
      return [...this.propertyDates].filter((d) => !this.nullDates.has(d));
    },
  };
}

async function deleteSupersededNullRows(
  label: string,
  deleteMany: (args: {
    where: { orgId: string; propertyId: null; date: { in: Date[] } };
  }) => Promise<{ count: number }>,
  orgId: string,
  ymdDates: string[],
  stats: SeoSyncStats,
): Promise<void> {
  if (ymdDates.length === 0) return;
  const dates = ymdDates
    .map(parseYmdToUtc)
    .filter((d): d is Date => d !== null);
  if (dates.length === 0) return;
  try {
    await deleteMany({ where: { orgId, propertyId: null, date: { in: dates } } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    stats.warnings.push(`Superseded-row cleanup (${label}): ${message}`);
  }
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

  // Filter out demo-seeded rows that store the literal "DEMO_SEED"
  // placeholder as ciphertext. The status helper + portal/seo page
  // already filter these, but the sync worker did NOT — meaning every
  // cron tick was trying to decrypt "DEMO_SEED", throwing, and
  // setting status=ERROR on the integration row. That cascaded into
  // the marketplace pill flipping to rose "Sync error" and the
  // StaleOnLoadTrigger firing pointlessly.
  const integrations = await prisma.seoIntegration.findMany({
    where: {
      orgId,
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
    },
  });
  if (integrations.length === 0) {
    return {
      ok: false,
      stats,
      error: "No SEO integrations configured for this org.",
    };
  }

  // Default window: a 2-day rolling window for cron runs (today + yesterday)
  // so GA4's intraday data refreshes every 30 min. 30 days on first/full
  // backfill. Pre-fix the incremental window was "yesterday only" —
  // meaning if a cron tick failed, the missed day never got re-fetched
  // until a full backfill ran. Pulling the last 2 days every tick keeps
  // GA4 intraday + GSC late-arriving data fresh and self-heals single-
  // tick failures without a backfill.
  //
  // Window rationale:
  //   - toDate: today (UTC), so GA4 returns the partial intraday row
  //     for the current day. GA4 revises this row over ~24h; pulling
  //     it on the 30-min cron keeps the live dashboard reasonably
  //     current.
  //   - fromDate: yesterday (UTC). Covers GSC's late-arriving rows
  //     (GSC publishes with a 1–2 day lag) without exploding quota.
  const now = new Date();
  const today = startOfUtcDay(now);
  const yesterday = startOfUtcDay(new Date(now.getTime() - DAY_MS));
  const toDate = options.toDate ? startOfUtcDay(options.toDate) : today;
  const fullBackfill =
    options.fullBackfill ||
    integrations.every((i) => i.lastSyncAt == null);
  const fromDate = options.fromDate
    ? startOfUtcDay(options.fromDate)
    : fullBackfill
      ? startOfUtcDay(new Date(now.getTime() - 30 * DAY_MS))
      : yesterday;

  // GSC and GA4 each contribute partial fields to the daily SeoSnapshot row;
  // we collect both, then write per (propertyId, date) with a merged
  // payload. Keyed by propertyId (not just date) so two integrations
  // scoped to different properties never merge into the same row.
  // @@unique([orgId, propertyId, provider]) on SeoIntegration guarantees at
  // most one GSC + one GA4 integration share a given NON-NULL propertyId —
  // Postgres treats NULL as distinct in unique indexes, so that guarantee
  // does NOT extend to the org-wide (propertyId NULL) bucket; an org can
  // hold multiple NULL-scoped integrations of the same provider. Merging
  // within a propertyId group is exactly as safe as the old org-wide merge
  // was for single-property orgs, but for the NULL bucket the safety comes
  // from app-level dedup (find-then-create on SeoIntegration), not this
  // constraint.
  const dailyByPropertyDate = new Map<
    string,
    {
      propertyId: string | null;
      date: string;
      organicSessions?: number;
      organicUsers?: number;
      totalImpressions?: number;
      totalClicks?: number;
      avgCtr?: number;
      avgPosition?: number;
    }
  >();
  const propertyDateKey = (propertyId: string | null, date: string) =>
    `${propertyId ?? ""}::${date}`;

  const queryDates = makeDateTracker();
  const landingPageDates = makeDateTracker();

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
          const key = propertyDateKey(integration.propertyId, row.date);
          const cur = dailyByPropertyDate.get(key) ?? {
            propertyId: integration.propertyId,
            date: row.date,
          };
          dailyByPropertyDate.set(key, {
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
          // Find-then-write (not upsert): uniqueness on this model is a
          // partial index, not a Prisma @@unique, so there's no compound
          // key Prisma can accept in an upsert `where`. Scoped by this
          // integration's own propertyId so a per-property sync run only
          // ever touches its own property's query rows.
          const findWhere = {
            orgId,
            propertyId: integration.propertyId ?? null,
            date,
            query: q.query,
          };
          const updateData = {
            impressions: q.impressions,
            clicks: q.clicks,
            ctr: q.ctr,
            position: q.position,
          };
          const existing = await prisma.seoQuery.findFirst({
            where: findWhere,
            select: { id: true },
          });
          if (existing) {
            await prisma.seoQuery.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            try {
              await prisma.seoQuery.create({
                data: { ...findWhere, ...updateData },
              });
            } catch (err) {
              // Concurrent run won the race and created the row first —
              // catch the partial-unique P2002 and update the winner's row
              // instead of failing this integration's whole sync.
              if (!isP2002(err)) throw err;
              const winner = await prisma.seoQuery.findFirst({
                where: findWhere,
                select: { id: true },
              });
              if (!winner) throw err;
              await prisma.seoQuery.update({
                where: { id: winner.id },
                data: updateData,
              });
            }
          }
          // Recorded only after a successful write — see snapshot loop
          // below for why (a failed write must not mark a date as
          // "property-covered" for the supersede-cleanup step).
          queryDates.record(integration.propertyId, q.date);
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
          const key = propertyDateKey(integration.propertyId, row.date);
          const cur = dailyByPropertyDate.get(key) ?? {
            propertyId: integration.propertyId,
            date: row.date,
          };
          dailyByPropertyDate.set(key, {
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
          // Find-then-write (not upsert) — see seoQuery above for why.
          // Scoped by this integration's own propertyId.
          const findWhere = {
            orgId,
            propertyId: integration.propertyId ?? null,
            date,
            url,
          };
          const updateData = {
            sessions: p.sessions,
            users: p.users,
            bounceRate: p.bounceRate,
            avgEngagementTime: p.avgEngagementTime,
          };
          const existing = await prisma.seoLandingPage.findFirst({
            where: findWhere,
            select: { id: true },
          });
          if (existing) {
            await prisma.seoLandingPage.update({
              where: { id: existing.id },
              data: updateData,
            });
          } else {
            try {
              await prisma.seoLandingPage.create({
                data: { ...findWhere, ...updateData },
              });
            } catch (err) {
              if (!isP2002(err)) throw err;
              const winner = await prisma.seoLandingPage.findFirst({
                where: findWhere,
                select: { id: true },
              });
              if (!winner) throw err;
              await prisma.seoLandingPage.update({
                where: { id: winner.id },
                data: updateData,
              });
            }
          }
          // Recorded only after a successful write — see snapshot loop
          // below for why.
          landingPageDates.record(integration.propertyId, p.date);
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

  // Now write the merged daily snapshots, one per (propertyId, date) group.
  // One bad date is logged as a warning rather than aborting the rest of
  // the run — by this point both integrations' status rows were already
  // reset to IDLE above, so a hard throw here would silently drop every
  // remaining snapshot with no visible error in the portal.
  const snapshotDates = makeDateTracker();
  for (const payload of dailyByPropertyDate.values()) {
    const date = parseYmdToUtc(payload.date);
    if (!date) continue;
    try {
      // Find-then-write (not upsert) — see seoQuery above for why.
      const findWhere = { orgId, propertyId: payload.propertyId ?? null, date };
      const data = {
        organicSessions: payload.organicSessions ?? 0,
        organicUsers: payload.organicUsers ?? 0,
        totalImpressions: payload.totalImpressions ?? 0,
        totalClicks: payload.totalClicks ?? 0,
        avgCtr: payload.avgCtr ?? 0,
        avgPosition: payload.avgPosition ?? 0,
      };
      const existing = await prisma.seoSnapshot.findFirst({
        where: findWhere,
        select: { id: true },
      });
      if (existing) {
        await prisma.seoSnapshot.update({ where: { id: existing.id }, data });
      } else {
        try {
          await prisma.seoSnapshot.create({ data: { ...findWhere, ...data } });
        } catch (err) {
          if (!isP2002(err)) throw err;
          const winner = await prisma.seoSnapshot.findFirst({
            where: findWhere,
            select: { id: true },
          });
          if (!winner) throw err;
          await prisma.seoSnapshot.update({ where: { id: winner.id }, data });
        }
      }
      // Recorded only after a successful write — a failed write must not
      // mark this date as "property-covered" for the supersede-cleanup
      // step below, or a write failure would delete the org-wide NULL
      // row for a date that in fact has no property data to replace it.
      snapshotDates.record(payload.propertyId, payload.date);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown snapshot write error";
      stats.warnings.push(`Snapshot ${payload.date}: ${message}`);
    }
  }

  // Double-counting write-side policy — see file header. Delete org-wide
  // NULL rows for any date this run just fully re-covered with property-
  // scoped rows, so org-wide reads never sum a NULL row and a property row
  // for the same date. Skipped for dates where a NULL-scoped integration
  // also wrote this run (that NULL row is live data, not a stale
  // remainder). Best-effort: a cleanup failure is a warning, not a reason
  // to fail an otherwise-successful sync.
  await deleteSupersededNullRows(
    "SeoSnapshot",
    prisma.seoSnapshot.deleteMany.bind(prisma.seoSnapshot),
    orgId,
    snapshotDates.superseded(),
    stats,
  );
  await deleteSupersededNullRows(
    "SeoQuery",
    prisma.seoQuery.deleteMany.bind(prisma.seoQuery),
    orgId,
    queryDates.superseded(),
    stats,
  );
  await deleteSupersededNullRows(
    "SeoLandingPage",
    prisma.seoLandingPage.deleteMany.bind(prisma.seoLandingPage),
    orgId,
    landingPageDates.superseded(),
    stats,
  );

  return {
    ok: stats.warnings.length === 0,
    stats,
    error: stats.warnings.length > 0 ? stats.warnings.join("; ") : undefined,
  };
}
