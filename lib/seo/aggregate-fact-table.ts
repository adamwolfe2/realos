import "server-only";

// ---------------------------------------------------------------------------
// QueryLandingDaily aggregator.
//
// Stitches DataforSEO SerpRanking + GSC SeoQuery + (lazily) GA4 page metrics
// into a single (org, propertyId, date, url, query) fact table. Every
// composite SEO chart reads from this — backbone of the "real magic"
// cross-source views in docs/SEO_AEO_AGENT_ARCHITECTURE.md.
//
// Strategy per scheduled run:
//   1. For each LIVE property, collect the union of (query, url) pairs
//      from yesterday's SerpRanking + GSC SeoQuery.
//   2. For each pair, upsert a QueryLandingDaily row carrying every
//      cross-source metric we have, plus derived flags (isBranded).
//   3. Skipped sources (no GSC connection, no GA4) leave their columns
//      at defaults so the row still exists and downstream charts don't
//      blow up.
//
// The aggregator is *idempotent*: same input → same row. Re-running over
// the same date range is safe and we use upserts to merge late-arriving
// signal (GA4 latency is ~24h vs DataforSEO same-day).
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

type AggregationResult = {
  rowsWritten: number;
  propertiesProcessed: number;
  errors: Array<{ propertyId: string; error: string }>;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}


/**
 * Branded-query heuristic: case-insensitive match of any token from
 * the org or property name (length >= 4) against the query string.
 *
 * Brand names with short tokens ("BG", "SG") aren't enough to confidently
 * tag, so we require >= 4 chars. False negatives are fine (a query just
 * gets tagged non-branded); false positives are NOT (would skew the
 * branded vs non-branded split chart).
 */
function isBrandedQuery(
  query: string,
  brandTokens: string[],
): boolean {
  const q = query.toLowerCase();
  for (const t of brandTokens) {
    if (t.length < 4) continue;
    if (q.includes(t.toLowerCase())) return true;
  }
  return false;
}

/**
 * Aggregate a single property's day.
 */
async function aggregatePropertyDay(input: {
  orgId: string;
  propertyId: string;
  date: Date;
  brandTokens: string[];
}): Promise<{ rowsWritten: number; error?: string }> {
  const { orgId, propertyId, date, brandTokens } = input;

  try {
    const [serpRows, gscRows] = await Promise.all([
      prisma.serpRanking.findMany({
        where: { orgId, propertyId, date },
        select: {
          query: true,
          ourUrl: true,
          ourRank: true,
        },
      }),
      prisma.seoQuery.findMany({
        where: { orgId, date },
        select: {
          query: true,
          impressions: true,
          clicks: true,
          ctr: true,
          position: true,
        },
      }),
    ]);

    // Union of (query, url) pairs across both sources.
    type PairKey = `${string}|${string}`;
    const pairs = new Map<
      PairKey,
      {
        query: string;
        url: string;
        serpPosition: number | null;
        gscImpressions: number;
        gscClicks: number;
        gscCtr: number | null;
        gscPosition: number | null;
      }
    >();

    // Seed from SerpRanking (each row is one query, one URL).
    for (const r of serpRows) {
      if (!r.ourUrl) continue; // can't join without a URL anchor
      const key: PairKey = `${r.query.toLowerCase()}|${r.ourUrl}`;
      pairs.set(key, {
        query: r.query,
        url: r.ourUrl,
        serpPosition: r.ourRank,
        gscImpressions: 0,
        gscClicks: 0,
        gscCtr: null,
        gscPosition: null,
      });
    }

    // Layer in GSC rows. GSC's SeoQuery doesn't currently carry a URL
    // dimension — it's per-query org-wide. We attach GSC metrics to the
    // canonical landing page we already pulled in via SerpRanking. If
    // there's no SerpRanking row for the query, we create a synthetic
    // pair with url="" so the metrics still flow into the fact table
    // (the charts that need URL anchoring will filter those out).
    for (const g of gscRows) {
      let matched = false;
      for (const [, value] of pairs) {
        if (value.query.toLowerCase() === g.query.toLowerCase()) {
          value.gscImpressions = g.impressions;
          value.gscClicks = g.clicks;
          value.gscCtr = g.ctr;
          value.gscPosition = g.position;
          matched = true;
        }
      }
      if (!matched) {
        const key: PairKey = `${g.query.toLowerCase()}|`;
        pairs.set(key, {
          query: g.query,
          url: "",
          serpPosition: null,
          gscImpressions: g.impressions,
          gscClicks: g.clicks,
          gscCtr: g.ctr,
          gscPosition: g.position,
        });
      }
    }

    if (pairs.size === 0) {
      return { rowsWritten: 0 };
    }

    // Run upserts in bounded-concurrency batches. A single property's
    // pair set can hit several hundred rows; sequential awaits made one
    // property take 5-10s. 20-wide parallelism keeps DB pool happy.
    const UPSERT_CONCURRENCY = 20;
    const pairValues = Array.from(pairs.values());
    let rowsWritten = 0;
    let firstError: string | undefined;

    for (let i = 0; i < pairValues.length; i += UPSERT_CONCURRENCY) {
      const batch = pairValues.slice(i, i + UPSERT_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((value) =>
          prisma.queryLandingDaily.upsert({
            where: {
              orgId_propertyId_date_url_query: {
                orgId,
                propertyId,
                date,
                url: value.url,
                query: value.query,
              },
            },
            create: {
              orgId,
              propertyId,
              date,
              url: value.url,
              query: value.query,
              serpPosition: value.serpPosition,
              serpFeatures: [],
              gscImpressions: value.gscImpressions,
              gscClicks: value.gscClicks,
              gscCtr: value.gscCtr,
              gscPosition: value.gscPosition,
              ga4Sessions: 0,
              ga4Users: 0,
              ga4EngagedSessions: 0,
              ga4Conversions: 0,
              isBranded: isBrandedQuery(value.query, brandTokens),
            },
            update: {
              serpPosition: value.serpPosition,
              gscImpressions: value.gscImpressions,
              gscClicks: value.gscClicks,
              gscCtr: value.gscCtr,
              gscPosition: value.gscPosition,
              isBranded: isBrandedQuery(value.query, brandTokens),
            },
          }),
        ),
      );
      for (const r of settled) {
        if (r.status === "fulfilled") {
          rowsWritten += 1;
        } else if (!firstError) {
          firstError =
            r.reason instanceof Error ? r.reason.message : String(r.reason);
        }
      }
    }

    if (firstError) return { rowsWritten, error: firstError };
    return { rowsWritten };
  } catch (err) {
    return {
      rowsWritten: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run the aggregator for every LIVE property in the platform.
 * Wraps each property in try/catch so one bad row never aborts the run.
 */
export async function runFactTableAggregation(opts: {
  /** UTC midnight of the day to aggregate. Defaults to yesterday. */
  date?: Date;
} = {}): Promise<AggregationResult> {
  const targetDate = startOfUtcDay(opts.date ?? new Date(Date.now() - DAY_MS));

  const properties = await prisma.property.findMany({
    where: { lifecycle: "ACTIVE", launchStatus: "LIVE" },
    select: {
      id: true,
      orgId: true,
      name: true,
      org: { select: { name: true } },
    },
    take: 200,
  });

  const result: AggregationResult = {
    rowsWritten: 0,
    propertiesProcessed: 0,
    errors: [],
  };

  // Process properties in bounded-concurrency batches. Each property's
  // aggregator is mostly DB-bound; 5 in parallel keeps the run snappy
  // without overloading the connection pool.
  const PROPERTY_CONCURRENCY = 5;
  for (let i = 0; i < properties.length; i += PROPERTY_CONCURRENCY) {
    const batch = properties.slice(i, i + PROPERTY_CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (p) => {
        const brandTokens = Array.from(
          new Set(
            [...(p.org?.name ?? "").split(/\s+/), ...p.name.split(/\s+/)]
              .map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, ""))
              .filter((t) => t.length >= 4),
          ),
        );
        const r = await aggregatePropertyDay({
          orgId: p.orgId,
          propertyId: p.id,
          date: targetDate,
          brandTokens,
        });
        return { propertyId: p.id, result: r };
      }),
    );
    for (const item of settled) {
      result.propertiesProcessed += 1;
      result.rowsWritten += item.result.rowsWritten;
      if (item.result.error) {
        result.errors.push({
          propertyId: item.propertyId,
          error: item.result.error,
        });
      }
    }
  }

  return result;
}
