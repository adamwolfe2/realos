import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { generateSeoRecommendations } from "@/lib/seo/agent";
import { setCachedRecommendations } from "@/lib/seo/recommendation-cache";
import { OrgType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to 200 properties × ~50ms engine call ≈ 10s; cap at 60s.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/admin/seo-agent/refresh-all
//
// Agency-only force-refresh of every LIVE property across every CLIENT
// org. Useful after a data backfill or schema change, when Adam wants
// to repopulate recommendations without waiting for the nightly cron.
//
// Caps at 200 properties per call to stay inside maxDuration. Returns
// a JSON summary of what ran. Idempotent via upsert key (orgId,
// propertyId, kind).
// ---------------------------------------------------------------------------

export async function POST() {
  const { userId, error } = await requireAdmin();
  if (error) return error;

  const properties = await prisma.property.findMany({
    where: {
      lifecycle: "ACTIVE",
      launchStatus: "LIVE",
      org: { orgType: OrgType.CLIENT },
    },
    select: { id: true, orgId: true },
    take: 200,
  });

  if (properties.length === 0) {
    return NextResponse.json({ ok: true, scanned: 0, written: 0 });
  }

  let totalWritten = 0;
  let totalExpired = 0;
  const errors: Array<{ propertyId: string; error: string }> = [];

  for (const p of properties) {
    try {
      const recs = await generateSeoRecommendations({
        orgId: p.orgId,
        propertyId: p.id,
      });

      // Upsert engine output in parallel — semantics require per-row
      // upsert (engine emits possibly-changed kinds per property), but
      // we can fan out the writes per property concurrently.
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
      totalWritten += upsertResults.filter(Boolean).length;
      await setCachedRecommendations(p.orgId, p.id, recs).catch(
        () => undefined,
      );

      // Expire any OPEN recs the engine no longer emits (keeps queue tight).
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
        totalExpired += expiredIds.length;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
      errors.push({ propertyId: p.id, error: message });
    }
  }

  // Audit event so future Adam can trace why a portfolio-wide refresh ran.
  // Best-effort against the first available CLIENT org for entity scoping;
  // the agency org isn't a CLIENT and SeoActionRecommendation rows live
  // under client orgs anyway.
  await prisma.auditEvent
    .create({
      data: {
        orgId: properties[0].orgId,
        userId,
        action: "UPDATE",
        entityType: "SeoActionRecommendation",
        entityId: null,
        description: `Admin force-refresh: ${properties.length} properties, ${totalWritten} upserted, ${totalExpired} expired`,
        diff: {
          scanned: properties.length,
          written: totalWritten,
          expired: totalExpired,
          errors: errors.length,
          actor: "admin",
        } as never,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    ok: true,
    scanned: properties.length,
    written: totalWritten,
    expired: totalExpired,
    errors,
  });
}
