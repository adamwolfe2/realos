import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { generateReportSnapshot } from "@/lib/reports/generate";
import { generateShareToken } from "@/lib/reports/token";
import { sendReportEmail } from "@/lib/email/send-report";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/monthly-report
//
// Runs on the 1st of each month at 08:00 UTC (see vercel.json). For every
// active client with a primaryContactEmail, generates a monthly snapshot
// and sends it directly — no draft stage, no operator review required.
// This is the "AM never has to log in" flow — monthly auto-emailed report.
//
// Idempotency: skips orgs that already have a monthly ClientReport for
// the current calendar month's period window.
//
// Auth: Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("monthly-report", async () => {
    const orgs = await prisma.organization.findMany({
      where: {
        orgType: "CLIENT",
        status: { in: ["LAUNCHED", "ACTIVE", "AT_RISK"] },
        primaryContactEmail: { not: null },
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryContactEmail: true,
        primaryContactName: true,
      },
    });

    let sent = 0;
    let skipped = 0;
    const errors: { orgId: string; error: string }[] = [];

    for (const org of orgs) {
      try {
        const snapshot = await generateReportSnapshot(org.id, "monthly");
        const periodStart = new Date(snapshot.periodStart);

        const existing = await prisma.clientReport.findFirst({
          where: { orgId: org.id, kind: "monthly", periodStart },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }

        const shareToken = generateShareToken();

        await prisma.clientReport.create({
          data: {
            orgId: org.id,
            kind: "monthly",
            periodStart,
            periodEnd: new Date(snapshot.periodEnd),
            snapshot: snapshot as object as never,
            shareToken,
            status: "sent",
          },
        });

        await sendReportEmail({
          to: [org.primaryContactEmail!],
          orgName: org.name,
          orgLogoUrl: org.logoUrl,
          snapshot,
          shareToken,
          recipientName: org.primaryContactName ?? undefined,
          senderName: "LeaseStack",
        });

        sent += 1;
      } catch (err) {
        errors.push({
          orgId: org.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      result: NextResponse.json({ ok: true, orgs: orgs.length, sent, skipped, errors }),
      recordsProcessed: sent,
    };
  });
}
