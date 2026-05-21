/**
 * GET /api/cron/site-intelligence-refresh
 *
 * Nightly at 05:00 UTC. Picks the 5 oldest orgs by
 * `SiteIntelligence.crawledAt` (NULL first) where the org has at least
 * one DomainBinding OR at least one Property with a websiteUrl, and runs
 * `ingestOrgIntelligence` against each.
 *
 * Cost guard: BATCH_SIZE caps the run at 5 orgs/night. With Firecrawl at
 * ~$0.04/crawl + Perplexity at ~$0.005 + Haiku at ~$0.001, per-run cost is
 * bounded at ~$0.25/night.
 *
 * Auth + run recording mirror /api/cron/dataforseo-sync/route.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";
import { ingestOrgIntelligence } from "@/lib/intelligence/site-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BATCH_SIZE = 5;

export async function GET(req: NextRequest) {
  const authResponse = verifyCronAuth(req);
  if (authResponse) return authResponse;

  return recordCronRun<NextResponse>("site-intelligence-refresh", async () => {
    const startedAt = Date.now();

    // Orgs eligible: have at least one domain OR at least one property
    // with a websiteUrl. Order by siteIntelligence.crawledAt asc, NULL
    // first. We do this in two passes — first fetch eligible org IDs,
    // then sort by their existing intelligence crawledAt.
    const candidates = await prisma.organization.findMany({
      where: {
        OR: [
          { domains: { some: {} } },
          { properties: { some: { websiteUrl: { not: null } } } },
        ],
      },
      select: {
        id: true,
        name: true,
        siteIntelligence: { select: { crawledAt: true } },
      },
    });

    // Sort: NULL crawledAt first, then oldest crawledAt first.
    const sorted = candidates.sort((a, b) => {
      const aTs = a.siteIntelligence?.crawledAt?.getTime() ?? -Infinity;
      const bTs = b.siteIntelligence?.crawledAt?.getTime() ?? -Infinity;
      return aTs - bTs;
    });

    const batch = sorted.slice(0, BATCH_SIZE);

    const aggregate = {
      orgsScanned: 0,
      pagesIngested: 0,
      costUsd: 0,
      errors: [] as Array<{ orgId: string; error: string }>,
    };

    for (const org of batch) {
      try {
        const result = await ingestOrgIntelligence({
          orgId: org.id,
          force: false,
        });
        aggregate.orgsScanned += 1;
        aggregate.pagesIngested += result.stats.pagesIngested;
        aggregate.costUsd += result.stats.costUsd;
        for (const e of result.stats.errors) {
          aggregate.errors.push({
            orgId: org.id,
            error: `${e.stage}: ${e.error}`,
          });
        }
      } catch (err) {
        aggregate.errors.push({
          orgId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[site-intelligence-refresh] scanned=${aggregate.orgsScanned}/${batch.length} ` +
        `pages=${aggregate.pagesIngested} ` +
        `cost=$${aggregate.costUsd.toFixed(4)} ` +
        `errors=${aggregate.errors.length} ` +
        `(${durationMs}ms)`,
    );

    return {
      result: NextResponse.json({
        ok: true,
        candidates: batch.length,
        ...aggregate,
        errors: aggregate.errors.slice(0, 20),
        durationMs,
      }),
      recordsProcessed: aggregate.orgsScanned,
    };
  });
}
