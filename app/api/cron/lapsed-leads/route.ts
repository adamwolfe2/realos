import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuditAction, LeadStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

// After the batch updateMany + createMany rewrite this job finishes in
// ~1s for a 500-row daily batch. Tight cap surfaces regressions early.
export const maxDuration = 60;

// GET /api/cron/lapsed-leads
// Daily. Moves CONTACTED / TOUR_SCHEDULED / TOURED leads with no activity
// in 14 days to LOST, and logs an audit row per move.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("lapsed-leads", async () => {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const candidates = await prisma.lead.findMany({
      where: {
        status: {
          in: [
            LeadStatus.CONTACTED,
            LeadStatus.TOUR_SCHEDULED,
            LeadStatus.TOURED,
          ],
        },
        lastActivityAt: { lt: cutoff },
      },
      select: { id: true, orgId: true, status: true, email: true },
      take: 500,
    });

    // Batch-only path: a single updateMany + chunked createMany cuts
    // wall-time from minutes (500 sequential txns) to ~1s. We trade
    // per-row error isolation for aggregate stats — failure halts the
    // batch but cron-run telemetry captures the error message.
    const now = new Date();
    const CHUNK_SIZE = 200;
    const errors: string[] = [];
    let moved = 0;

    if (candidates.length > 0) {
      const leadIds = candidates.map((l) => l.id);
      const auditRows = candidates.map((lead) => ({
        orgId: lead.orgId,
        action: AuditAction.UPDATE,
        entityType: "Lead",
        entityId: lead.id,
        description: `Auto-closed stale lead, ${lead.status} → LOST (14d inactive)`,
      }));

      try {
        const updated = await prisma.lead.updateMany({
          where: { id: { in: leadIds } },
          data: { status: LeadStatus.LOST, lastActivityAt: now },
        });
        moved = updated.count;

        for (let i = 0; i < auditRows.length; i += CHUNK_SIZE) {
          const chunk = auditRows.slice(i, i + CHUNK_SIZE);
          await prisma.auditEvent.createMany({
            data: chunk,
            skipDuplicates: true,
          });
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    return {
      result: NextResponse.json({
        scanned: candidates.length,
        moved,
        errors: errors.length ? errors : undefined,
      }),
      recordsProcessed: moved,
    };
  });
}
