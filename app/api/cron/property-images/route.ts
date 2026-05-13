import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import { batchRefreshPropertyImages } from "@/lib/property-images/refresh";

export const maxDuration = 300;

// GET /api/cron/property-images
//
// Nightly. Picks up to BATCH properties whose websiteUrl is set and
// whose imageScrapeAt is either NULL (never scraped) or older than
// STALE_DAYS (refresh window). Scrapes each, sets heroImageUrl + logoUrl
// when slots are empty, records imageScrapeAt + imageScrapeError.
//
// Order is "never scraped first, oldest scraped second" so new properties
// get pictures fast and stale ones rotate over time. Partial index
// `Property_imageScrapeAt_websiteUrl_idx` keeps the candidate query cheap
// regardless of portfolio size.
//
// Auth: standard CRON_SECRET via verifyCronAuth.

const BATCH = 50;
const STALE_DAYS = 30;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("property-images", async () => {
    const staleBefore = new Date(
      Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000,
    );

    const candidates = await prisma.property.findMany({
      where: {
        websiteUrl: { not: null },
        lifecycle: "ACTIVE",
        OR: [
          { imageScrapeAt: null },
          { imageScrapeAt: { lt: staleBefore } },
        ],
      },
      orderBy: [
        // Sentinel + composite index makes NULLS FIRST cheap.
        { imageScrapeAt: { sort: "asc", nulls: "first" } },
      ],
      take: BATCH,
      select: { id: true },
    });

    const results = await batchRefreshPropertyImages({
      propertyIds: candidates.map((p) => p.id),
    });

    const heroSet = results.filter((r) => r.heroSet).length;
    const logoSet = results.filter((r) => r.logoSet).length;
    const errored = results.filter((r) => r.error).length;

    return {
      result: NextResponse.json({
        attempted: results.length,
        heroSet,
        logoSet,
        errored,
        details:
          errored > 0
            ? results
                .filter((r) => r.error)
                .slice(0, 10)
                .map((r) => ({ propertyId: r.propertyId, error: r.error }))
            : undefined,
      }),
      recordsProcessed: heroSet + logoSet,
    };
  });
}
