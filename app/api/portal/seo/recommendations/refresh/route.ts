import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { generateSeoRecommendations } from "@/lib/seo/agent";
import {
  setCachedRecommendations,
  invalidateRecommendationsCache,
} from "@/lib/seo/recommendation-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/portal/seo/recommendations/refresh
//
// Re-runs the SEO recommendation engine for the calling org. If a
// `propertyId` is provided in the body, scoped to that property only;
// otherwise hits every LIVE property in the org.
//
// Persists the result to SeoActionRecommendation with a stable
// (orgId, propertyId, kind) unique key so re-running is idempotent.
// Status flips of existing recs (IN_PROGRESS / DISMISSED) are preserved.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  propertyId: z.string().min(1).optional(),
});

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

  let body: z.infer<typeof bodySchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    body = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Constrain to the requested property if any, otherwise every property
  // the scope can see.
  const where = tenantWhere(scope);
  if (body.propertyId) {
    if (
      scope.allowedPropertyIds &&
      !scope.allowedPropertyIds.includes(body.propertyId)
    ) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }
    Object.assign(where, { id: body.propertyId });
  }

  // H3 fix — bound wall time. 25 properties × engine (currently a handful
  // of cached-data queries, ~50ms each) keeps us safely inside maxDuration.
  // If a caller passes propertyId, single-property runs aren't capped.
  const properties = await prisma.property.findMany({
    where,
    select: { id: true, orgId: true },
    take: body.propertyId ? 1 : 25,
  });
  if (properties.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, written: 0 });
  }

  let written = 0;
  for (const p of properties) {
    const recs = await generateSeoRecommendations({
      orgId: p.orgId,
      propertyId: p.id,
    });

    // Upsert every rec in parallel. The (orgId, propertyId, kind) unique
    // key dedupes across runs while preserving operator status changes.
    const refreshedAt = new Date();
    const upsertResults = await Promise.all(
      recs.map((r) =>
        prisma.seoActionRecommendation
          .upsert({
            where: {
              orgId_propertyId_kind: {
                orgId: p.orgId,
                propertyId: p.id,
                kind: r.kind,
              },
            },
            create: {
              orgId: p.orgId,
              propertyId: p.id,
              kind: r.kind,
              category: r.category,
              severity: r.severity,
              title: r.title,
              detail: r.detail,
              estimateMinutes: r.estimateMinutes,
              score: r.score,
              actionHref: r.actionHref,
              actionLabel: r.actionLabel,
              evidence: r.evidence as never,
              refreshedAt,
            },
            update: {
              // Don't reset status — operator might have moved it to
              // IN_PROGRESS. Only refresh the engine-derived fields.
              severity: r.severity,
              title: r.title,
              detail: r.detail,
              estimateMinutes: r.estimateMinutes,
              score: r.score,
              actionHref: r.actionHref,
              actionLabel: r.actionLabel,
              evidence: r.evidence as never,
              refreshedAt,
            },
          })
          .then(() => true)
          .catch(() => false),
      ),
    );
    written += upsertResults.filter(Boolean).length;

    // Prime the cache with the fresh result so the next read hits.
    await setCachedRecommendations(p.orgId, p.id, recs).catch(() => undefined);

    // Mark any pre-existing OPEN recs that the engine no longer emits
    // as EXPIRED. This keeps the operator's queue tight.
    const liveKinds = new Set(recs.map((r) => r.kind));
    const existingOpen = await prisma.seoActionRecommendation.findMany({
      where: {
        orgId: p.orgId,
        propertyId: p.id,
        status: "OPEN",
      },
      select: { id: true, kind: true },
    });
    const expiredIds = existingOpen
      .filter((row) => !liveKinds.has(row.kind))
      .map((row) => row.id);
    if (expiredIds.length > 0) {
      await prisma.seoActionRecommendation.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: "EXPIRED" },
      });
    }
  }

  // Invalidate stale caches for any properties not in this batch (single
  // property mode, this is a no-op).
  if (body.propertyId) {
    await invalidateRecommendationsCache(
      properties[0].orgId,
      properties[0].id,
    ).catch(() => undefined);
  }

  return NextResponse.json({
    ok: true,
    scanned: properties.length,
    written,
  });
}
