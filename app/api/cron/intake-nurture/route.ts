import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_NAME,
} from "@/lib/email/shared";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/intake-nurture
// Daily at 12:00 UTC. Nurtures unconverted intake submissions with a 3-touch
// email sequence (day 1-2, day 3-5, day 6-8) then archives past day 14.
//
// Dedup tracking: the `raw` JSON field on IntakeSubmission stores a
// `_nurture` object: { day_1: true, day_4: true, day_7: true }.
// No migration required — `raw` is `Json?` and already nullable.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("intake-nurture", async () => {
    const now = new Date();
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    const submissions = await prisma.intakeSubmission.findMany({
      where: {
        status: { notIn: ["converted", "rejected", "archived"] },
        submittedAt: { gte: fourteenDaysAgo },
      },
    });

    const platformDomain =
      process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "leasestack.co";
    const bookUrl = `https://${platformDomain}/onboarding`;

    const results: Array<{ id: string; action: string; error?: string }> = [];

    for (const sub of submissions) {
      try {
        const daysSince = Math.floor(
          (now.getTime() - sub.submittedAt.getTime()) /
            (24 * 60 * 60 * 1000)
        );

        // Archive submissions still unconverted after 14 days.
        if (daysSince >= 14) {
          await prisma.intakeSubmission.update({
            where: { id: sub.id },
            data: { status: "archived" },
          });
          results.push({ id: sub.id, action: "archived" });
          continue;
        }

        // Map daysSince to the nurture step key.
        type EmailKey = "day_1" | "day_4" | "day_7";
        let targetKey: EmailKey | null = null;
        if (daysSince >= 1 && daysSince <= 2) targetKey = "day_1";
        else if (daysSince >= 3 && daysSince <= 5) targetKey = "day_4";
        else if (daysSince >= 6 && daysSince <= 8) targetKey = "day_7";

        if (!targetKey) {
          results.push({ id: sub.id, action: "skip_window" });
          continue;
        }

        // Check dedup state stored in the raw JSON field.
        const rawObj =
          sub.raw != null && typeof sub.raw === "object" && !Array.isArray(sub.raw)
            ? (sub.raw as Record<string, unknown>)
            : {};
        const nurture =
          rawObj["_nurture"] != null &&
          typeof rawObj["_nurture"] === "object" &&
          !Array.isArray(rawObj["_nurture"])
            ? (rawObj["_nurture"] as Record<string, unknown>)
            : {};

        if (nurture[targetKey]) {
          results.push({ id: sub.id, action: "already_sent" });
          continue;
        }

        if (!isValidEmail(sub.primaryContactEmail)) {
          results.push({ id: sub.id, action: "skip_invalid_email" });
          continue;
        }

        const firstName =
          sub.primaryContactName.split(" ")[0] ?? sub.primaryContactName;

        const { subject, bodyHtml } = buildNurtureEmail(targetKey, {
          firstName,
          companyName: sub.companyName,
          painPoint: sub.biggestPainPoint ?? null,
          bookUrl,
        });

        const html = buildBaseHtml({
          headline: subject,
          bodyHtml,
          ctaText: "Book a call",
          ctaUrl: bookUrl,
        });

        const resend = getResend();
        if (!resend) {
          results.push({ id: sub.id, action: "skip_resend_missing" });
          continue;
        }

        const unsubMailbox =
          process.env.UNSUBSCRIBE_EMAIL?.trim() ||
          "unsubscribe@leasestack.co";
        const r = await resend.emails.send({
          from: FROM_EMAIL,
          to: sub.primaryContactEmail,
          subject,
          html,
          headers: {
            "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
            "X-Entity-Ref-ID": `intake-nurture-${sub.id}`,
          },
          tags: [
            { name: "template", value: "intake-nurture" },
            { name: "category", value: "broadcast" },
          ],
        });

        if (r.error) {
          results.push({
            id: sub.id,
            action: "email_error",
            error: r.error.message,
          });
          continue;
        }

        // Mark this step as sent in the raw JSON field.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedRaw: Record<string, any> = {
          ...rawObj,
          _nurture: { ...nurture, [targetKey]: true },
        };
        await prisma.intakeSubmission.update({
          where: { id: sub.id },
          data: { raw: updatedRaw },
        });

        results.push({ id: sub.id, action: `sent_${targetKey}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/intake-nurture] error processing ${sub.id}: ${message}`
        );
        results.push({ id: sub.id, action: "error", error: message });
      }
    }

    const sent = results.filter((r) => r.action.startsWith("sent_")).length;
    const archived = results.filter((r) => r.action === "archived").length;

    return {
      result: NextResponse.json({
        processed: submissions.length,
        sent,
        archived,
        results,
      }),
      recordsProcessed: sent + archived,
    };
  });
}

type NurtureEmailKey = "day_1" | "day_4" | "day_7";

function buildNurtureEmail(
  key: NurtureEmailKey,
  opts: {
    firstName: string;
    companyName: string;
    painPoint: string | null;
    bookUrl: string;
  }
): { subject: string; bodyHtml: string } {
  const { firstName, companyName, painPoint, bookUrl } = opts;
  const e = htmlEscape;

  if (key === "day_1") {
    return {
      subject: `Following up on your ${BRAND_NAME} demo request`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Thanks for submitting your intake for ${e(companyName)}. I wanted to
          personally follow up and make sure you have everything you need before
          our call.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          If you have any questions about how ${e(BRAND_NAME)} works or what to expect,
          just reply here and I'll answer before we speak.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          If you haven't booked a time yet, grab one below and we'll walk through
          your setup together.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          <a href="${e(bookUrl)}" style="color:#2563EB;">Book a call</a>
        </p>
      `,
    };
  }

  if (key === "day_4") {
    const painLine =
      painPoint
        ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            You mentioned <em>${e(painPoint)}</em> as your biggest challenge. That's
            exactly what we built ${e(BRAND_NAME)} to solve, and I'd love to show you
            how we're doing that for similar properties.
          </p>`
        : `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            We work with property managers who want to modernize their leasing funnel
            without adding headcount. Happy to show you what that looks like in practice.
          </p>`;

    return {
      subject: `Quick question about ${companyName}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Just checking in on your ${e(companyName)} submission.
        </p>
        ${painLine}
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          If the timing isn't right yet, just let me know and I can follow up in
          a few weeks. Otherwise, grab a time below.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          <a href="${e(bookUrl)}" style="color:#2563EB;">Book a call</a>
        </p>
      `,
    };
  }

  // day_7
  return {
    subject: `Last check-in from ${BRAND_NAME}`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        This is my last note for now on your ${e(companyName)} inquiry. I don't want
        to fill your inbox if the timing isn't right.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        If you'd like to close this out, just reply "not now" and I'll stop
        reaching out. No pressure at all.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        If you're still interested, one conversation is all it takes to see whether
        ${e(BRAND_NAME)} is the right fit.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        <a href="${e(bookUrl)}" style="color:#2563EB;">Book a call</a>
      </p>
    `,
  };
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
