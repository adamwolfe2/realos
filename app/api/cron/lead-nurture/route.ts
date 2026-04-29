import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeadStatus, Prisma } from "@prisma/client";
import { sendLeadCadenceEmail } from "@/lib/email/lead-sequences";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/lead-nurture
// Hourly cadence. For each lifecycle stage, finds leads older than the
// stage offset and not yet advanced, sends the email, and marks the stage
// as sent. Respects unsubscribe + module flags + lost/signed/unqualified.

type Stage = {
  key: "day_one" | "day_three" | "day_seven" | "day_thirty" | "year_one";
  afterHours: number;
  sentStage: string;
  previousStage: string | null;
};

const STAGES: Stage[] = [
  {
    key: "day_one",
    afterHours: 1,
    sentStage: "day_one_sent",
    previousStage: null,
  },
  {
    key: "day_three",
    afterHours: 72,
    sentStage: "day_three_sent",
    previousStage: "day_one_sent",
  },
  {
    key: "day_seven",
    afterHours: 7 * 24,
    sentStage: "day_seven_sent",
    previousStage: "day_three_sent",
  },
  {
    key: "day_thirty",
    afterHours: 30 * 24,
    sentStage: "day_thirty_sent",
    previousStage: "day_seven_sent",
  },
  {
    key: "year_one",
    afterHours: 365 * 24,
    sentStage: "year_one_sent",
    previousStage: "day_thirty_sent",
  },
];

const EXCLUDED_STATUSES: LeadStatus[] = [
  LeadStatus.LOST,
  LeadStatus.SIGNED,
  LeadStatus.UNQUALIFIED,
  LeadStatus.APPROVED,
];

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("lead-nurture", async () => {
  const now = Date.now();
  const results: Array<{ stage: string; fired: number; errors: number }> = [];
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "leasestack.co";

  for (const stage of STAGES) {
    const cutoff = new Date(now - stage.afterHours * 60 * 60 * 1000);
    const where: Prisma.LeadWhereInput = {
      email: { not: null },
      unsubscribedFromEmails: false,
      status: { notIn: EXCLUDED_STATUSES },
      cadenceStage: stage.previousStage ?? null,
      createdAt: { lte: cutoff },
    };

    const candidates = await prisma.lead.findMany({
      where,
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            moduleEmail: true,
            primaryContactEmail: true,
            domains: { orderBy: { isPrimary: "desc" }, take: 1 },
          },
        },
        property: { select: { name: true } },
      },
      take: 200,
    });

    let fired = 0;
    let errors = 0;

    for (const lead of candidates) {
      if (!lead.email) continue;
      if (!lead.org.moduleEmail) continue;

      const host =
        lead.org.domains[0]?.hostname ?? `${lead.org.slug}.${platformDomain}`;
      const applyUrl = `https://${host}/apply`;
      const replyTo =
        lead.org.primaryContactEmail ??
        process.env.RESEND_FROM_EMAIL ??
        "hello@leasestack.co";

      const result = await sendLeadCadenceEmail(stage.key, {
        to: lead.email,
        firstName: lead.firstName,
        orgName: lead.org.name,
        propertyName: lead.property?.name ?? null,
        applyUrl,
        replyTo,
        leadId: lead.id,
      });

      if (result.ok) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            cadenceStage: stage.sentStage,
            lastEmailSentAt: new Date(),
            emailsSent: { increment: 1 },
          },
        });
        fired++;
      } else {
        errors++;
        console.warn(
          `[cron/lead-nurture] failed to send ${stage.key} to ${lead.id}: ${result.error}`
        );
      }
    }

    results.push({ stage: stage.key, fired, errors });
  }

    // appBase kept to make it obvious in logs the cron wired the platform URL.
    const totalFired = results.reduce((sum, r) => sum + r.fired, 0);
    return {
      result: NextResponse.json({ platform: appBase, results }),
      recordsProcessed: totalFired,
    };
  });
}
