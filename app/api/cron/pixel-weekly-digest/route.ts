import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus } from "@prisma/client";
import { sendVisitorWeeklyDigest } from "@/lib/email/visitor-emails";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/pixel-weekly-digest
// Runs Mondays. For every tenant with weekly digest enabled, sends the
// last-7-day visitor roll-up to the configured recipients.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("pixel-weekly-digest", async () => {
  const integrations = await prisma.cursiveIntegration.findMany({
    where: { weeklyDigestEnabled: true },
    include: {
      org: {
        select: { id: true, name: true, primaryContactEmail: true },
      },
    },
  });

  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const portalBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const results: Array<{
    orgId: string;
    sent: number;
    errors: string[];
  }> = [];

  // Per-tenant try/catch — if a single tenant's count queries throw or
  // their digest send fails wholesale, we shouldn't silently drop
  // every other tenant's digest. Errors land in the per-tenant result
  // record so cron-run telemetry can surface them.
  for (const integration of integrations) {
    try {
      const rangeLabel = "the last 7 days";
      const [totalVisitors, identified, highIntent, convertedToLead] =
        await Promise.all([
          prisma.visitor.count({
            where: {
              orgId: integration.orgId,
              lastSeenAt: { gte: sinceWeek },
            },
          }),
          prisma.visitor.count({
            where: {
              orgId: integration.orgId,
              lastSeenAt: { gte: sinceWeek },
              status: {
                in: [
                  VisitorIdentificationStatus.IDENTIFIED,
                  VisitorIdentificationStatus.ENRICHED,
                ],
              },
            },
          }),
          prisma.visitor.count({
            where: {
              orgId: integration.orgId,
              lastSeenAt: { gte: sinceWeek },
              intentScore: { gte: 60 },
            },
          }),
          prisma.visitor.count({
            where: {
              orgId: integration.orgId,
              lastSeenAt: { gte: sinceWeek },
              status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
            },
          }),
        ]);

      const recipients = buildRecipientList(
        integration.weeklyDigestEmails,
        integration.org.primaryContactEmail,
      );
      const errors: string[] = [];
      let sent = 0;
      for (const to of recipients) {
        try {
          const r = await sendVisitorWeeklyDigest({
            to,
            orgName: integration.org.name,
            totalVisitors,
            identified,
            highIntent,
            convertedToLead,
            rangeLabel,
            portalUrl: `${portalBase}/portal/visitors`,
          });
          if (r.ok) sent++;
          else if (r.error) errors.push(`${to}: ${r.error}`);
        } catch (err) {
          errors.push(
            `${to}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      results.push({ orgId: integration.orgId, sent, errors });
    } catch (err) {
      results.push({
        orgId: integration.orgId,
        sent: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      });
    }
  }

    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    return {
      result: NextResponse.json({ tenants: results.length, results }),
      recordsProcessed: totalSent,
    };
  });
}

function buildRecipientList(
  explicit: unknown,
  fallback: string | null
): string[] {
  const out = new Set<string>();
  if (Array.isArray(explicit)) {
    for (const e of explicit) {
      if (typeof e === "string" && e.includes("@")) out.add(e);
    }
  }
  if (out.size === 0 && fallback && fallback.includes("@")) {
    out.add(fallback);
  }
  return Array.from(out);
}
