import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron/auth";
import { recordCronRun } from "@/lib/health/cron-run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// GET /api/cron/draft-expiry
//
// Daily — moves ContentDraft rows that have been sitting in
// PENDING_REVIEW or CHANGES_REQUESTED for more than 14 days to
// EXPIRED. Keeps the admin queue scannable and prevents zombie
// drafts from blocking the bell badge math.
//
// Idempotent. Writes an AuditEvent per row so the agency can see
// why a draft expired without reverse-engineering.
// ---------------------------------------------------------------------------

const STALE_DAYS = 14;

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun<NextResponse>("draft-expiry", async () => {
    const cutoff = new Date(
      Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000,
    );

    // Find candidates first so we can emit audit events per row.
    const candidates = await prisma.contentDraft.findMany({
      where: {
        status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] },
        // submittedAt is set whenever the operator first ships to review.
        // Fall back to createdAt for rows that never reached submitted.
        OR: [
          { submittedAt: { lt: cutoff } },
          {
            submittedAt: null,
            createdAt: { lt: cutoff },
          },
        ],
      },
      select: {
        id: true,
        orgId: true,
        status: true,
        format: true,
        submittedAt: true,
        createdAt: true,
      },
      take: 500,
    });

    if (candidates.length === 0) {
      return {
        result: NextResponse.json({ ok: true, expired: 0 }),
        recordsProcessed: 0,
      };
    }

    const now = new Date();
    await prisma.contentDraft.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { status: "EXPIRED", reviewedAt: now },
    });

    // Audit each expiry separately. Best-effort batch.
    await Promise.allSettled(
      candidates.map((c) => {
        const ageMs =
          now.getTime() - (c.submittedAt ?? c.createdAt).getTime();
        const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
        return prisma.auditEvent.create({
          data: {
            orgId: c.orgId,
            userId: null,
            action: "UPDATE",
            entityType: "ContentDraft",
            entityId: c.id,
            description: `Auto-expired after ${ageDays}d in ${c.status}`,
            diff: {
              from: c.status,
              to: "EXPIRED",
              reason: "stale > 14d",
            } as never,
          },
        });
      }),
    );

    return {
      result: NextResponse.json({
        ok: true,
        expired: candidates.length,
        cutoff: cutoff.toISOString(),
      }),
      recordsProcessed: candidates.length,
    };
  });
}
