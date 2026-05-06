import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuditAction, LeadStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

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

    // Per-iteration try/catch — a single transaction failure (orgId no
    // longer exists, FK violation on a renamed entity) shouldn't tank
    // the entire daily run. Each failure logs to the errors array so
    // cron-run telemetry surfaces it without the whole job 500ing.
    let moved = 0;
    const errors: string[] = [];
    for (const lead of candidates) {
      try {
        await prisma.$transaction([
          prisma.lead.update({
            where: { id: lead.id },
            data: { status: LeadStatus.LOST, lastActivityAt: new Date() },
          }),
          prisma.auditEvent.create({
            data: {
              orgId: lead.orgId,
              action: AuditAction.UPDATE,
              entityType: "Lead",
              entityId: lead.id,
              description: `Auto-closed stale lead, ${lead.status} → LOST (14d inactive)`,
            },
          }),
        ]);
        moved++;
      } catch (err) {
        errors.push(
          `${lead.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
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
