import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus } from "@prisma/client";
import { sendVisitorWeeklyDigest } from "@/lib/email/visitor-emails";

// GET /api/cron/pixel-weekly-digest
// Runs Mondays. For every tenant with weekly digest enabled, sends the
// last-7-day visitor roll-up to the configured recipients.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  for (const integration of integrations) {
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

    const recipients = buildRecipientList(integration.weeklyDigestEmails, integration.org.primaryContactEmail);
    const errors: string[] = [];
    let sent = 0;
    for (const to of recipients) {
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
    }
    results.push({ orgId: integration.orgId, sent, errors });
  }

  return NextResponse.json({ tenants: results.length, results });
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
