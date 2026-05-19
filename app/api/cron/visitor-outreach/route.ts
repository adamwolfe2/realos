import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus } from "@prisma/client";
import { sendVisitorOutreachEmail } from "@/lib/email/visitor-emails";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/visitor-outreach
// Runs hourly, fires outreach email to high-intent identified visitors
// that haven't already received one. Requires Bearer CRON_SECRET.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("visitor-outreach", async () => {
  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Cursive verification gate. Outreach only fires for visitors whose
  // org has at least one CursiveIntegration with lastEventAt set —
  // proof that the pixel actually fired events at LeaseStack, not just
  // that ops typed a pixel ID into the admin panel. Prior to this gate,
  // a misconfigured AL webhook (URL never pasted into the AL pixel UI)
  // would silently never produce visitor rows for outreach, but if the
  // segment pull happened to create visitors via /api/cron/pixel-segment-sync
  // we'd email people for an "integration" the operator hadn't actually
  // finished wiring up. Once at least one real webhook event lands the
  // gate opens for that org and stays open.
  const verifiedOrgIds = await prisma.cursiveIntegration
    .findMany({
      where: { lastEventAt: { not: null } },
      select: { orgId: true },
      distinct: ["orgId"],
    })
    .then((rows) => rows.map((r) => r.orgId));

  if (verifiedOrgIds.length === 0) {
    return {
      result: NextResponse.json({
        sent: 0,
        scanned: 0,
        skipped:
          "no cursive integrations have received a webhook event yet",
      } as Record<string, unknown>),
      recordsProcessed: 0,
    };
  }

  const candidates = await prisma.visitor.findMany({
    where: {
      orgId: { in: verifiedOrgIds },
      status: {
        in: [
          VisitorIdentificationStatus.IDENTIFIED,
          VisitorIdentificationStatus.ENRICHED,
        ],
      },
      email: { not: null },
      outreachSent: false,
      intentScore: { gte: 60 },
      firstSeenAt: { gte: sinceWeek },
    },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          moduleEmail: true,
          moduleOutboundEmail: true,
          tenantSiteConfig: {
            select: { primaryCtaUrl: true, contactEmail: true },
          },
        },
      },
    },
    take: 200,
  });

  let sent = 0;
  const errors: string[] = [];

  // Per-iteration try/catch so one bad email (Resend transient error,
  // malformed address that slipped past validation, DB write failure)
  // doesn't kill the whole batch and leave the remaining 199 visitors
  // without outreach. Each failure logs to the errors array which is
  // surfaced in the cron-run telemetry.
  for (const v of candidates) {
    try {
      if (!v.email) continue;
      if (!v.org.moduleEmail && !v.org.moduleOutboundEmail) continue;
      const result = await sendVisitorOutreachEmail({
        to: v.email,
        firstName: v.firstName,
        orgName: v.org.name,
        applyUrl: v.org.tenantSiteConfig?.primaryCtaUrl ?? null,
      });
      if (result.ok) {
        await prisma.visitor.update({
          where: { id: v.id },
          data: { outreachSent: true, outreachSentAt: new Date() },
        });
        sent++;
      } else if (result.error) {
        errors.push(`${v.id}: ${result.error}`);
      }
    } catch (err) {
      errors.push(
        `${v.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

    return {
      result: NextResponse.json({
        sent,
        scanned: candidates.length,
        errors: errors.length ? errors : undefined,
      }),
      recordsProcessed: sent,
    };
  });
}
