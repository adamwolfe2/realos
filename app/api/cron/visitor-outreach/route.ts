import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VisitorIdentificationStatus } from "@prisma/client";
import { sendVisitorOutreachEmail } from "@/lib/email/visitor-emails";

// GET /api/cron/visitor-outreach
// Runs hourly, fires outreach email to high-intent identified visitors
// that haven't already received one. Requires Bearer CRON_SECRET.
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

  const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.visitor.findMany({
    where: {
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

  for (const v of candidates) {
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
  }

  return NextResponse.json({
    sent,
    scanned: candidates.length,
    errors: errors.length ? errors : undefined,
  });
}
