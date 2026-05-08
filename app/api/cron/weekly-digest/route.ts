import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { buildWeeklyDigest } from "@/lib/reports/weekly-digest";
import {
  buildWeeklyDigestEmail,
  weeklyDigestSubject,
} from "@/lib/reports/email-template";
import {
  getResend,
  isValidEmail,
  FROM_EMAIL,
} from "@/lib/email/shared";
import { verifyCronAuth } from "@/lib/cron/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/weekly-digest
//
// Fires every Monday at 09:00 UTC (vercel.json). For every org that has real
// data this week (at least one lead, ad spend, or organic session) it builds a
// digest and emails every org member.
//
// Orgs without activity are silently skipped — digest.hasData === false.
// Auth: Bearer CRON_SECRET.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("weekly-digest", async () => {
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    let sent = 0;
    let skipped = 0;
    const errors: Array<{ orgId: string; error: string }> = [];

    const portalBase =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co";

    const resend = getResend();

    for (const org of orgs) {
      try {
        const digest = await buildWeeklyDigest(org.id);

        if (!digest.hasData) {
          skipped += 1;
          continue;
        }

        // Resolve recipient emails from org members
        const members = await prisma.user.findMany({
          where: { orgId: org.id },
          select: { email: true },
        });

        const recipientEmails = members
          .map((m) => m.email)
          .filter(isValidEmail);

        if (recipientEmails.length === 0) {
          skipped += 1;
          continue;
        }

        if (!resend) {
          errors.push({ orgId: org.id, error: "RESEND_API_KEY not configured" });
          continue;
        }

        const subject = weeklyDigestSubject(digest);
        const html = buildWeeklyDigestEmail(digest, `${portalBase}/portal`);

        const unsubMailbox =
          process.env.UNSUBSCRIBE_EMAIL?.trim() ||
          "unsubscribe@leasestack.co";

        // Send one email per recipient so each gets a personal copy.
        // Weekly digest is broadcast — full RFC 8058 header set so
        // Gmail renders the visible Unsubscribe button.
        const sendResults = await Promise.allSettled(
          recipientEmails.map((email) =>
            resend.emails.send({
              from: FROM_EMAIL,
              to: email,
              subject,
              html,
              headers: {
                "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
                "X-Entity-Ref-ID": `weekly-digest-${digest.orgId}-${email}`,
              },
              tags: [
                { name: "template", value: "weekly-digest" },
                { name: "category", value: "broadcast" },
              ],
            }),
          ),
        );

        let orgSent = 0;
        for (const result of sendResults) {
          if (result.status === "fulfilled" && !result.value.error) {
            orgSent += 1;
          } else if (result.status === "rejected") {
            const msg =
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason);
            errors.push({ orgId: org.id, error: `send failed: ${msg}` });
          } else if (result.status === "fulfilled" && result.value.error) {
            errors.push({
              orgId: org.id,
              error: `resend error: ${result.value.error.message}`,
            });
          }
        }

        sent += orgSent;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/weekly-digest] error for org ${org.id}: ${message}`
        );
        errors.push({ orgId: org.id, error: message });
      }
    }

    return {
      result: NextResponse.json({ sent, skipped, errors }),
      recordsProcessed: sent,
    };
  });
}
