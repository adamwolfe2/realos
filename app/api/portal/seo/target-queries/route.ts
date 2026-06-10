import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /api/portal/seo/target-queries
//
// GET   - list active + inactive target queries (optionally filtered by
//         propertyId). Includes the latest SerpRanking position when
//         available so the UI can show "ranked / not ranked".
// POST  - create a new target query (operator-added, addedBy = userId)
// ---------------------------------------------------------------------------

const createSchema = z.object({
  propertyId: z.string().min(1),
  query: z.string().trim().min(2).max(200),
  intent: z
    .enum(["transactional", "local", "informational", "branded"])
    .optional(),
  locationCode: z.number().int().optional(),
});

export async function GET(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const propertyId = req.nextUrl.searchParams.get("propertyId");
  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (propertyId) {
    if (
      scope.allowedPropertyIds &&
      !scope.allowedPropertyIds.includes(propertyId)
    ) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    where.propertyId = propertyId;
  }

  const queries = await prisma.seoTargetQuery.findMany({
    where: where as never,
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      rankings: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          ourRank: true,
          ourUrl: true,
          date: true,
        },
      },
    },
  });

  return NextResponse.json({
    queries: queries.map((q) => ({
      id: q.id,
      propertyId: q.propertyId,
      query: q.query,
      intent: q.intent,
      locationCode: q.locationCode,
      addedBy: q.addedBy,
      active: q.active,
      createdAt: q.createdAt,
      latestRanking:
        q.rankings && q.rankings.length > 0
          ? {
              position: q.rankings[0].ourRank,
              url: q.rankings[0].ourUrl,
              scannedAt: q.rankings[0].date,
            }
          : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  let parsed: z.infer<typeof createSchema>;
  try {
    const raw = await req.json();
    parsed = createSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Tenant + property check
  const property = await prisma.property.findFirst({
    where: { id: parsed.propertyId, ...tenantWhere(scope) },
    select: { id: true, orgId: true },
  });
  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }
  if (
    scope.allowedPropertyIds &&
    !scope.allowedPropertyIds.includes(property.id)
  ) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  // Cap: 20 active target queries per property keeps DataforSEO cost
  // bounded. Operators can mark old ones inactive instead of deleting.
  const activeCount = await prisma.seoTargetQuery.count({
    where: {
      orgId: property.orgId,
      propertyId: property.id,
      active: true,
    },
  });
  if (activeCount >= 20) {
    return NextResponse.json(
      {
        error:
          "Maximum 20 active target queries per property. Mark an old query inactive first.",
      },
      { status: 400 },
    );
  }

  const normalized = parsed.query.trim().toLowerCase();
  const created = await prisma.seoTargetQuery
    .upsert({
      where: {
        orgId_propertyId_query: {
          orgId: property.orgId,
          propertyId: property.id,
          query: normalized,
        },
      },
      create: {
        orgId: property.orgId,
        propertyId: property.id,
        query: normalized,
        intent: parsed.intent ?? null,
        locationCode: parsed.locationCode ?? 2840,
        addedBy: scope.userId,
        active: true,
      },
      update: {
        active: true,
        intent: parsed.intent ?? undefined,
        locationCode: parsed.locationCode ?? undefined,
      },
    })
    .catch(() => null);

  if (!created) {
    return NextResponse.json(
      { error: "Could not create target query" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, query: created });
}
