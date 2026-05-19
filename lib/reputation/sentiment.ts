import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { analyzeSentimentAndTopics } from "./analyze";
import type { ScannedMention } from "./types";

// ---------------------------------------------------------------------------
// Sentiment backfill classifier.
//
// Two paths to a PropertyMention row landing with sentiment=NULL:
//   1. A scan ran while ANTHROPIC_API_KEY was missing or Claude errored.
//   2. The row was inserted by the orchestrator before classification
//      finished (we persist all new mentions even if some can't be
//      analyzed in the same run).
//
// This module batches up to 20 unclassified rows at a time and writes back
// sentiment + sentimentConfidence + topics ("themes"). Designed to be called
// from:
//   * the on-demand /api/portal/reputation/scan endpoint after fetch fan-out
//   * the periodic reputation-scan cron (when one exists)
//   * an admin "Backfill sentiment" button (already exists at
//     /api/tenant/reputation-mentions/backfill-sentiment)
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 20;

export type BackfillResult = {
  scanned: number;
  classified: number;
  status: "ok" | "no_unclassified" | "no_api_key" | "error";
  message: string | null;
};

export async function backfillSentimentForOrg(
  orgId: string,
  options: {
    batchSize?: number;
    propertyIds?: string[] | null;
  } = {},
): Promise<BackfillResult> {
  const batchSize = Math.max(1, Math.min(50, options.batchSize ?? DEFAULT_BATCH_SIZE));

  const where: Prisma.PropertyMentionWhereInput = {
    orgId,
    sentiment: null,
  };
  if (options.propertyIds && options.propertyIds.length > 0) {
    where.propertyId = { in: options.propertyIds };
  }

  const rows = await prisma.propertyMention.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: batchSize,
    select: {
      id: true,
      urlHash: true,
      source: true,
      sourceUrl: true,
      title: true,
      excerpt: true,
      rating: true,
    },
  });

  if (rows.length === 0) {
    return {
      scanned: 0,
      classified: 0,
      status: "no_unclassified",
      message: "All mentions in this workspace are already classified.",
    };
  }

  const items = rows.map((r) => ({
    id: r.id,
    mention: {
      source: r.source,
      sourceUrl: r.sourceUrl,
      title: r.title,
      excerpt: r.excerpt,
      authorName: null,
      publishedAt: null,
      rating: r.rating,
    } satisfies ScannedMention,
  }));

  const result = await analyzeSentimentAndTopics(items);
  if (result.status !== "ok") {
    return {
      scanned: rows.length,
      classified: 0,
      status: result.status,
      message: result.errorMessage,
    };
  }

  let classified = 0;
  await Promise.all(
    rows.map(async (r) => {
      const analysis = result.classifications.get(r.id);
      if (!analysis) return;
      try {
        await prisma.propertyMention.update({
          where: { id: r.id },
          data: {
            sentiment: analysis.sentiment,
            sentimentConfidence: analysis.confidence,
            topics: analysis.topics as Prisma.InputJsonValue,
          },
        });
        classified++;
      } catch {
        // Non-fatal — one bad row shouldn't block the rest.
      }
    }),
  );

  return {
    scanned: rows.length,
    classified,
    status: "ok",
    message: classified === 0 ? "Claude returned no classifications for this batch." : null,
  };
}
