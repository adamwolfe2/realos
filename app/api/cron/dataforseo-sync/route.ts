import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { syncPropertyFromDataforSeo } from "@/lib/seo/sync-orchestrator";
import { isDataforSeoConfigured } from "@/lib/seo/dataforseo";
import { notDemoOrg } from "@/lib/tenancy/demo-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/dataforseo-sync
//
// Daily 04:00 UTC. For every LIVE property, runs the full DataforSEO scan:
//   - SERP rankings for active SeoTargetQuery rows (auto-derives starter
//     queries if the property has none)
//   - On-page Lighthouse audit (homepage)
//   - Backlinks summary (domain)
//   - Organic competitor domains (DataforSEO Labs)
//
// Cost guard: BATCH_SIZE caps each run at 25 properties so per-run cost
// is bounded at ~$1.25 / day. With our nightly window and a typical
// portfolio of 50-150 LIVE properties, every property gets refreshed
// every 2-6 days — fast enough that recommendations stay current.
//
// Skipped: DataforSEO not configured -> records a SKIPPED cron run and
// returns ok:true without touching the DB.
// ---------------------------------------------------------------------------

const BATCH_SIZE = 25;
// Upper bound on the stale set we rank in memory.
const MAX_STALE_CANDIDATES = 1000;

// Newest row this cron wrote per property (SERP, Lighthouse or backlinks).
// Any of the three counts, so a property whose SERP step keeps failing still
// rotates to the back once its Lighthouse/backlink rows land.
// ponytail: a property whose every step fails writes nothing and stays
// first; the schema branch's Property.lastSeoScanAt (stamped on attempt)
// replaces this.
async function lastDataforSeoScanMs(
  propertyIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (propertyIds.length === 0) return out;
  const where = { propertyId: { in: propertyIds } };
  const groups = await Promise.all([
    prisma.serpRanking.groupBy({ by: ["propertyId"], where, _max: { date: true } }),
    prisma.onPageAudit.groupBy({ by: ["propertyId"], where, _max: { date: true } }),
    prisma.backlinkSummary.groupBy({ by: ["propertyId"], where, _max: { date: true } }),
  ]);
  for (const g of groups.flat()) {
    const t = g._max.date?.getTime() ?? 0;
    if (g.propertyId && t > (out.get(g.propertyId) ?? 0)) out.set(g.propertyId, t);
  }
  return out;
}
const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 1 day min between scans per property

export async function GET(req: NextRequest) {
  const authResponse = verifyCronAuth(req);
  if (authResponse) return authResponse;

  return recordCronRun<NextResponse>("dataforseo-sync", async () => {
    if (!isDataforSeoConfigured()) {
      return {
        result: NextResponse.json({
          ok: true,
          skipped: true,
          reason:
            "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not configured. No scans run.",
        }),
        recordsProcessed: 0,
      };
    }

    const startedAt = Date.now();
    // A property is ~12 sequential DataForSEO calls (~100s). Stop starting
    // new ones with headroom before maxDuration (300s): a killed run never
    // records its result, which is how every run in Sep 2026 ended.
    // Unscanned properties keep stale serpRankings, so they stay eligible.
    const deadline = startedAt + 180_000;
    const cutoff = new Date(Date.now() - SCAN_INTERVAL_MS);

    // Pick LIVE properties that haven't been scanned today, stalest scan
    // first (see lastDataforSeoScanMs). The old lastSyncedAt order used a
    // timestamp this cron never writes, so the same properties led every run
    // and later ones (a second property in the same org) starved.
    const stale = await prisma.property.findMany({
      where: {
        lifecycle: "ACTIVE",
        launchStatus: "LIVE",
        // Demo fixtures have .example domains: paid calls that always fail.
        org: notDemoOrg,
        OR: [
          // Property has no SerpRanking rows yet.
          { serpRankings: { none: {} } },
          // Or its most recent scan was before today's cutoff.
          {
            serpRankings: {
              every: { date: { lt: cutoff } },
            },
          },
        ],
      },
      select: { id: true, orgId: true, name: true, websiteUrl: true },
      orderBy: { id: "asc" },
      take: MAX_STALE_CANDIDATES,
    });
    const lastScan = await lastDataforSeoScanMs(stale.map((p) => p.id));
    const candidates = [...stale]
      .sort((a, b) => (lastScan.get(a.id) ?? 0) - (lastScan.get(b.id) ?? 0))
      .slice(0, BATCH_SIZE);

    const aggregate = {
      propertiesScanned: 0,
      serpQueriesScanned: 0,
      lighthouseAudits: 0,
      backlinkSummaries: 0,
      competitorRows: 0,
      costEstimateUsd: 0,
      errors: [] as Array<{ stage: string; propertyId: string; error: string }>,
    };

    for (const p of candidates) {
      if (Date.now() > deadline) break;
      try {
        const stats = await syncPropertyFromDataforSeo({
          orgId: p.orgId,
          propertyId: p.id,
        });
        aggregate.propertiesScanned += 1;
        aggregate.serpQueriesScanned += stats.serpQueriesScanned;
        aggregate.lighthouseAudits += stats.lighthouseAudits;
        aggregate.backlinkSummaries += stats.backlinkSummaries;
        aggregate.competitorRows += stats.competitorRows;
        aggregate.costEstimateUsd += stats.costEstimateUsd;
        aggregate.errors.push(...stats.errors);
      } catch (err) {
        aggregate.errors.push({
          stage: "property",
          propertyId: p.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    console.info(
      `[dataforseo-sync] scanned=${aggregate.propertiesScanned}/${candidates.length} ` +
        `serps=${aggregate.serpQueriesScanned} ` +
        `lighthouse=${aggregate.lighthouseAudits} ` +
        `backlinks=${aggregate.backlinkSummaries} ` +
        `competitors=${aggregate.competitorRows} ` +
        `cost=$${aggregate.costEstimateUsd.toFixed(4)} ` +
        `errors=${aggregate.errors.length} ` +
        `(${durationMs}ms)`,
    );

    return {
      result: NextResponse.json({
        ok: true,
        candidates: candidates.length,
        ...aggregate,
        errors: aggregate.errors.slice(0, 20),
        durationMs,
      }),
      recordsProcessed:
        aggregate.serpQueriesScanned +
        aggregate.lighthouseAudits +
        aggregate.backlinkSummaries +
        aggregate.competitorRows,
      // Per-property/stage failures → record the run `partial`, not clean `ok`.
      errorCount: aggregate.errors.length,
      errorSummary: aggregate.errors
        .map((e) => `${e.propertyId}/${e.stage}: ${e.error}`)
        .join("; "),
    };
  });
}
