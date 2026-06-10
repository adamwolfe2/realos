import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { SeoActionStatus } from "@prisma/client";
import { invalidateRecommendationsCache } from "@/lib/seo/recommendation-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/portal/seo/recommendations/bulk
//
// Apply a single status transition to multiple recommendations. Used by
// the RecommendationManager when an operator selects rows and clicks
// Dismiss / Snooze / Mark done / In progress.
//
// Body:
//   ids:          string[] (max 50)
//   action:       "in_progress" | "completed" | "dismissed" | "snoozed"
//   reason:       string (required for dismissed; optional for snoozed)
//   snoozeUntil:  ISO datetime (required for snoozed, must be future)
//
// Cap at 50 ids per call. Tenant + property-RBAC scoped. Cache busted
// per unique propertyId touched. Audit event written per row.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  action: z.enum(["in_progress", "completed", "dismissed", "snoozed"]),
  reason: z.string().min(4).max(500).optional(),
  snoozeUntil: z.string().datetime().optional(),
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

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (parsed.action === "dismissed" && !parsed.reason) {
    return NextResponse.json(
      { error: "Provide a reason when dismissing." },
      { status: 400 },
    );
  }
  if (parsed.action === "snoozed" && !parsed.snoozeUntil) {
    return NextResponse.json(
      { error: "Provide snoozeUntil when snoozing." },
      { status: 400 },
    );
  }
  if (parsed.snoozeUntil) {
    const ts = new Date(parsed.snoozeUntil).getTime();
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      return NextResponse.json(
        { error: "snoozeUntil must be a future datetime." },
        { status: 400 },
      );
    }
  }

  // Tenant + RBAC-scoped read first — drop any ids that don't belong.
  const where: Record<string, unknown> = {
    id: { in: parsed.ids },
    ...tenantWhere(scope),
  };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }
  const recs = await prisma.seoActionRecommendation.findMany({
    where: where as never,
    select: { id: true, status: true, orgId: true, propertyId: true },
  });
  if (recs.length === 0) {
    return NextResponse.json({
      ok: true,
      updated: 0,
      skipped: parsed.ids.length,
    });
  }

  // Build the patch payload based on action.
  const now = new Date();
  let nextStatus: SeoActionStatus;
  const data: Record<string, unknown> = {};
  if (parsed.action === "in_progress") {
    nextStatus = "IN_PROGRESS";
  } else if (parsed.action === "completed") {
    nextStatus = "COMPLETED";
    data.completedAt = now;
    data.completedBy = scope.userId;
  } else if (parsed.action === "dismissed") {
    nextStatus = "DISMISSED";
    data.dismissedAt = now;
    data.dismissedReason = parsed.reason;
  } else {
    nextStatus = "SNOOZED";
    data.snoozedUntil = new Date(parsed.snoozeUntil!);
    data.snoozedReason = parsed.reason ?? null;
  }
  data.status = nextStatus;

  const update = await prisma.seoActionRecommendation.updateMany({
    where: { id: { in: recs.map((r) => r.id) } },
    data: data as never,
  });

  // Audit + cache busting (deduped by property).
  const propertyIds = new Set(
    recs
      .map((r) => r.propertyId)
      .filter((p): p is string => !!p),
  );
  await Promise.allSettled([
    ...recs.map((r) =>
      prisma.auditEvent.create({
        data: {
          orgId: r.orgId,
          userId: scope.userId,
          action: "UPDATE",
          entityType: "SeoActionRecommendation",
          entityId: r.id,
          description: `Bulk ${parsed.action}: ${r.status} → ${nextStatus}${parsed.reason ? ` · ${parsed.reason.slice(0, 120)}` : ""}`,
          diff: {
            from: r.status,
            to: nextStatus,
            reason: parsed.reason ?? null,
            bulk: true,
          } as never,
        },
      }),
    ),
    ...Array.from(propertyIds).map((pid) =>
      invalidateRecommendationsCache(recs[0].orgId, pid),
    ),
  ]);

  return NextResponse.json({
    ok: true,
    updated: update.count,
    skipped: parsed.ids.length - update.count,
  });
}
