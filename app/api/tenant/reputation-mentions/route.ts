import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import {
  checkRateLimit,
  clientReadLimiter,
  rateLimited,
} from "@/lib/rate-limit";
import { MentionSource, Prisma, Sentiment } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/tenant/reputation-mentions?propertyId=...&cursor=...&limit=20&sentiment=NEGATIVE&source=REDDIT&unreviewed=1
//
// Paginated list of persisted mentions for a property. Cursor pagination by
// (publishedAt, id) so new mentions always sort first.
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  propertyId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sentiment: z.nativeEnum(Sentiment).optional(),
  source: z.nativeEnum(MentionSource).optional(),
  unreviewed: z.union([z.literal("1"), z.literal("0")]).optional(),
  flagged: z.union([z.literal("1"), z.literal("0")]).optional(),
});

export async function GET(req: NextRequest) {
  let scope: Awaited<ReturnType<typeof requireScope>>;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(
    clientReadLimiter,
    `reputation-mentions-read:${scope.userId}`
  );
  if (!allowed) return rateLimited();

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { propertyId, cursor, limit, sentiment, source, unreviewed, flagged } =
    parsed.data;

  // Verify the property belongs to the scope.
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...tenantWhere(scope) },
    select: { id: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  const where: Prisma.PropertyMentionWhereInput = {
    ...tenantWhere(scope),
    propertyId,
    ...(sentiment ? { sentiment } : {}),
    ...(source ? { source } : {}),
    ...(unreviewed === "1" ? { reviewedByUserId: null } : {}),
    ...(flagged === "1" ? { flagged: true } : {}),
  };

  // Cursor is the opaque id of the last-seen row.
  const take = limit + 1;
  const rows = await prisma.propertyMention.findMany({
    where,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    take,
    select: {
      id: true,
      source: true,
      sourceUrl: true,
      title: true,
      excerpt: true,
      authorName: true,
      publishedAt: true,
      rating: true,
      sentiment: true,
      topics: true,
      reviewedByUserId: true,
      flagged: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({
    items: items.map((r) => ({
      ...r,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      reviewed: r.reviewedByUserId !== null,
    })),
    nextCursor,
  });
}
