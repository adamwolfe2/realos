import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeadSource } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";

// GET /api/cron/lead-score-refresh
// Daily. Recomputes Lead.score + intent label from a simple linear
// heuristic. No ML for v1. Runs in batches.
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

  return recordCronRun("lead-score-refresh", async () => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const leads = await prisma.lead.findMany({
    where: {
      convertedAt: null,
      status: { notIn: ["LOST", "UNQUALIFIED", "SIGNED"] },
    },
    select: {
      id: true,
      lastActivityAt: true,
      source: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      emailsSent: true,
      cadenceStage: true,
    },
    take: 1000,
  });

  let updated = 0;
  for (const lead of leads) {
    let score = 0;

    // Recency of activity
    const daysSinceActivity = Math.floor(
      (now - lead.lastActivityAt.getTime()) / DAY
    );
    if (daysSinceActivity <= 7) score += 20;
    else if (daysSinceActivity <= 14) score += 10;

    // Source
    if (lead.source === LeadSource.CHATBOT) score += 30;
    else if (lead.source === LeadSource.FORM) score += 20;
    else if (lead.source === LeadSource.PIXEL_OUTREACH) score += 15;
    else if (lead.source === LeadSource.REFERRAL) score += 25;

    // Completeness
    const fields = [lead.email, lead.phone, lead.firstName, lead.lastName].filter(
      Boolean
    ).length;
    if (fields >= 4) score += 10;
    else if (fields >= 2) score += 5;

    // Engagement
    if ((lead.emailsSent ?? 0) >= 1) score += 10;

    score = Math.max(0, Math.min(100, score));

    const intent = score >= 70 ? "hot" : score >= 40 ? "warm" : "cold";

    await prisma.lead.update({
      where: { id: lead.id },
      data: { score, intent },
    });
    updated++;
  }

    return {
      result: NextResponse.json({ scanned: leads.length, updated }),
      recordsProcessed: updated,
    };
  });
}
