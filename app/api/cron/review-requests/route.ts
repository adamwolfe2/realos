import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { sendReviewRequestEmail } from "@/lib/email/review-request";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/review-requests
// Daily. Sends a Google review request to residents who signed 7+ days ago.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("review-requests", async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const candidates = await prisma.lead.findMany({
      where: {
        status: LeadStatus.SIGNED,
        convertedAt: { gte: sixtyDaysAgo, lt: sevenDaysAgo },
        reviewRequestSentAt: null,
        email: { not: null },
        unsubscribedFromEmails: false,
        property: { googleReviewUrl: { not: null } },
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        property: { select: { name: true, googleReviewUrl: true } },
      },
      take: 200,
    });

    let sent = 0;
    for (const lead of candidates) {
      if (!lead.email || !lead.property?.googleReviewUrl) continue;
      try {
        await sendReviewRequestEmail({
          to: lead.email,
          firstName: lead.firstName,
          propertyName: lead.property.name,
          googleReviewUrl: lead.property.googleReviewUrl,
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { reviewRequestSentAt: new Date() },
        });
        sent++;
      } catch {
        // Skip individual failures; cron will retry tomorrow
      }
    }

    return {
      result: NextResponse.json({ scanned: candidates.length, sent }),
      recordsProcessed: sent,
    };
  });
}
