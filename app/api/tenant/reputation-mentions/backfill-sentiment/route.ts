import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { analyzeSentimentAndTopics } from "@/lib/reputation/analyze";

// ---------------------------------------------------------------------------
// POST /api/tenant/reputation-mentions/backfill-sentiment
//
// Bug #23 — operators reported the sentiment tracker showed every
// mention as "unclassified." Root cause was usually a missing
// ANTHROPIC_API_KEY in the production env, OR mentions inserted by
// scans that ran before the analyzer was wired up. The orchestrator
// now backfills unclassified mentions on EVERY scan, but operators
// shouldn't have to trigger a fresh scan just to retroactively classify
// their existing mentions once they fix the API key.
//
// This endpoint runs the analyzer over every PropertyMention with
// sentiment=null in the operator's org (optionally scoped to a single
// property) and writes the classifications back. Returns a summary so
// the UI can show "Classified 47 mentions, 0 errors."
//
// Auth: any signed-in user with portal scope. Rate-limited via the
// implicit work — Claude Haiku 4.5 batches up to ~50 mentions per call,
// and we cap the backfill at 200 mentions per request to keep the
// response under the Vercel function timeout.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH_SIZE = 50;
const MAX_PER_REQUEST = 200;

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    propertyId?: string;
  };

  const propertyClause: Prisma.PropertyMentionWhereInput =
    body.propertyId && typeof body.propertyId === "string"
      ? { propertyId: body.propertyId }
      : {};

  const unclassified = await prisma.propertyMention.findMany({
    where: {
      orgId: scope.orgId,
      sentiment: null,
      ...propertyClause,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: MAX_PER_REQUEST,
    select: {
      id: true,
      source: true,
      sourceUrl: true,
      title: true,
      excerpt: true,
      rating: true,
    },
  });

  if (unclassified.length === 0) {
    return NextResponse.json({
      ok: true,
      classified: 0,
      total: 0,
      message: "No unclassified mentions found.",
    });
  }

  let classified = 0;
  let firstError: string | null = null;
  let firstSkipReason: string | null = null;

  for (let i = 0; i < unclassified.length; i += BATCH_SIZE) {
    const batch = unclassified.slice(i, i + BATCH_SIZE);
    const result = await analyzeSentimentAndTopics(
      batch.map((m) => ({
        id: m.id,
        mention: {
          source: m.source,
          sourceUrl: m.sourceUrl,
          title: m.title,
          excerpt: m.excerpt,
          authorName: null,
          publishedAt: null,
          rating: m.rating,
        },
      })),
    );

    if (result.status !== "ok") {
      // Surface ANTHROPIC_API_KEY missing or Claude error and stop
      // — no point hammering the failing path on the rest of the
      // batches.
      firstError = result.errorMessage ?? "classification failed";
      firstSkipReason = result.status;
      break;
    }

    for (const row of batch) {
      const analysis = result.classifications.get(row.id);
      if (!analysis) continue;
      try {
        await prisma.propertyMention.update({
          where: { id: row.id },
          data: {
            sentiment: analysis.sentiment,
            topics: analysis.topics as Prisma.InputJsonValue,
          },
        });
        classified += 1;
      } catch (err) {
        if (!firstError) {
          firstError =
            err instanceof Error ? err.message : "DB update failed";
        }
      }
    }
  }

  return NextResponse.json({
    ok: firstError == null,
    classified,
    total: unclassified.length,
    error: firstError,
    skipReason: firstSkipReason,
    message:
      firstError == null
        ? `Classified ${classified} of ${unclassified.length} mentions.`
        : firstSkipReason === "no_api_key"
          ? "ANTHROPIC_API_KEY is not set. Add it in Vercel and re-run this backfill."
          : `Classification failed after ${classified} mentions: ${firstError}`,
  });
}
