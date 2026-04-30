import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrgType, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_NAME,
  BRAND_EMAIL,
} from "@/lib/email/shared";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

// GET /api/cron/billing-reminders
// Daily at 09:00 UTC. Sends billing reminder emails to CLIENT orgs whose
// subscriptionStatus is PAST_DUE. Deduplicates via AuditEvent rows so the
// same org receives at most one reminder per 7-day window.
// After 14+ days past-due, sends an escalated notice and sets status=PAUSED.
export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("billing-reminders", async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * 24 * 60 * 60 * 1000
    );

    const orgs = await prisma.organization.findMany({
      where: {
        orgType: OrgType.CLIENT,
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        primaryContactEmail: { not: null },
      },
    });

    // Batch-fetch all billing-reminder audit events for these orgs in a single
    // query, then bucket per org. Replaces the N+1 pattern of two findFirst()
    // calls per org which dominated wall-clock time as more tenants entered
    // PAST_DUE.
    const orgIds = orgs.map((o) => o.id);
    const reminderEvents =
      orgIds.length > 0
        ? await prisma.auditEvent.findMany({
            where: { orgId: { in: orgIds }, entityType: "billing_reminder" },
            select: { orgId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const reminderRange = new Map<
      string,
      { first: Date; last: Date }
    >();
    for (const ev of reminderEvents) {
      if (!ev.orgId) continue;
      const r = reminderRange.get(ev.orgId);
      if (!r) {
        reminderRange.set(ev.orgId, { first: ev.createdAt, last: ev.createdAt });
      } else {
        if (ev.createdAt < r.first) r.first = ev.createdAt;
        if (ev.createdAt > r.last) r.last = ev.createdAt;
      }
    }

    const portalBase =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const billingUrl = `${portalBase}/portal/billing`;

    const results: Array<{
      orgId: string;
      action: string;
      error?: string;
    }> = [];

    for (const org of orgs) {
      try {
        if (!isValidEmail(org.primaryContactEmail)) {
          results.push({ orgId: org.id, action: "skip_invalid_email" });
          continue;
        }

        const reminders = reminderRange.get(org.id);

        // Skip if we sent a reminder within the last 7 days.
        if (reminders && reminders.last.getTime() > sevenDaysAgo.getTime()) {
          results.push({ orgId: org.id, action: "skip_rate_limited" });
          continue;
        }

        // Escalation: first reminder was 14+ days ago.
        const isEscalated =
          reminders != null &&
          reminders.first.getTime() <= fourteenDaysAgo.getTime();

        const firstName =
          (org.primaryContactName ?? "there").split(" ")[0] ?? "there";
        const { subject, bodyHtml } = buildBillingReminderEmail({
          firstName,
          orgName: org.name,
          billingUrl,
          escalated: isEscalated,
        });

        const html = buildBaseHtml({
          headline: isEscalated
            ? `Urgent: ${org.name} account suspended`
            : `Action needed: ${org.name} payment`,
          bodyHtml,
          ctaText: "Update payment method",
          ctaUrl: billingUrl,
          alertBannerHtml: isEscalated
            ? `<p style="margin:0;font-size:13px;font-weight:600;color:#92400e;">
                Your account has been paused due to non-payment.
                Update your payment method to restore access.
              </p>`
            : undefined,
        });

        const resend = getResend();
        if (!resend) {
          results.push({ orgId: org.id, action: "skip_resend_missing" });
          continue;
        }

        const r = await resend.emails.send({
          from: FROM_EMAIL,
          to: org.primaryContactEmail as string,
          subject,
          html,
          replyTo: BRAND_EMAIL,
        });

        if (r.error) {
          results.push({
            orgId: org.id,
            action: "email_error",
            error: r.error.message,
          });
          continue;
        }

        // Record the reminder in AuditEvent for dedup and future escalation checks.
        await prisma.auditEvent.create({
          data: {
            orgId: org.id,
            action: "UPDATE",
            entityType: "billing_reminder",
            entityId: org.id,
            description: isEscalated ? "escalated" : "standard",
          },
        });

        // Pause the org if escalated and not already paused.
        if (isEscalated && org.status !== TenantStatus.PAUSED) {
          await prisma.organization.update({
            where: { id: org.id },
            data: { status: TenantStatus.PAUSED },
          });
          results.push({ orgId: org.id, action: "sent_escalated_and_paused" });
        } else {
          results.push({
            orgId: org.id,
            action: isEscalated ? "sent_escalated" : "sent_standard",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/billing-reminders] error for org ${org.id}: ${message}`
        );
        results.push({ orgId: org.id, action: "error", error: message });
      }
    }

    const sent = results.filter((r) => r.action.startsWith("sent_")).length;

    return {
      result: NextResponse.json({ processed: orgs.length, sent, results }),
      recordsProcessed: sent,
    };
  });
}

function buildBillingReminderEmail(opts: {
  firstName: string;
  orgName: string;
  billingUrl: string;
  escalated: boolean;
}): { subject: string; bodyHtml: string } {
  const { firstName, orgName, billingUrl, escalated } = opts;
  const e = htmlEscape;

  if (escalated) {
    return {
      subject: `Urgent: Your ${BRAND_NAME} account for ${orgName} has been paused`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Your ${e(BRAND_NAME)} account for ${e(orgName)} has been paused because your
          payment is now more than 14 days overdue.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Your data is safe and your portal access can be restored immediately once
          payment is updated. Please update your payment method to reactivate your account.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          If you believe this is an error or need help, reply to this email and
          we'll get it sorted right away.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          <a href="${e(billingUrl)}" style="color:#2563EB;font-weight:600;">Update payment method</a>
        </p>
      `,
    };
  }

  return {
    subject: `Action needed: Your ${BRAND_NAME} account`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        Your ${e(BRAND_NAME)} account for ${e(orgName)} has a past-due balance. To keep
        your marketing stack running without interruption, please update your
        payment method.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        If you have any questions about your invoice or need to discuss your plan,
        just reply here and we'll take care of it.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        <a href="${e(billingUrl)}" style="color:#2563EB;font-weight:600;">Update payment method</a>
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
