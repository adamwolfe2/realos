import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  OrgType,
  TenantStatus,
  LeadStatus,
  ChatbotConversationStatus,
} from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_NAME,
} from "@/lib/email/shared";

// GET /api/cron/weekly-digest
// Mondays at 08:00 UTC. For every active CLIENT org, sends a weekly summary
// comparing this week vs last week: leads, tours, applications, chatbot
// conversations, and site visitors.
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

  return recordCronRun("weekly-digest", async () => {
    const now = new Date();
    const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const orgs = await prisma.organization.findMany({
      where: {
        orgType: OrgType.CLIENT,
        status: {
          in: [TenantStatus.ACTIVE, TenantStatus.LAUNCHED, TenantStatus.AT_RISK],
        },
        primaryContactEmail: { not: null },
      },
    });

    const results: Array<{ orgId: string; sent: number; error?: string }> = [];

    for (const org of orgs) {
      try {
        if (!isValidEmail(org.primaryContactEmail)) {
          results.push({ orgId: org.id, sent: 0, error: "invalid email" });
          continue;
        }

        const [
          leadsThisWeek,
          leadsLastWeek,
          toursThisWeek,
          toursLastWeek,
          applicationsThisWeek,
          applicationsLastWeek,
          chatsThisWeek,
          chatsLastWeek,
          visitorsThisWeek,
          visitorsLastWeek,
        ] = await Promise.all([
          prisma.lead.count({
            where: { orgId: org.id, createdAt: { gte: thisWeekStart } },
          }),
          prisma.lead.count({
            where: {
              orgId: org.id,
              createdAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
          }),
          prisma.lead.count({
            where: {
              orgId: org.id,
              status: {
                in: [LeadStatus.TOUR_SCHEDULED, LeadStatus.TOURED],
              },
              updatedAt: { gte: thisWeekStart },
            },
          }),
          prisma.lead.count({
            where: {
              orgId: org.id,
              status: {
                in: [LeadStatus.TOUR_SCHEDULED, LeadStatus.TOURED],
              },
              updatedAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
          }),
          prisma.application.count({
            where: {
              lead: { orgId: org.id },
              createdAt: { gte: thisWeekStart },
            },
          }),
          prisma.application.count({
            where: {
              lead: { orgId: org.id },
              createdAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
          }),
          prisma.chatbotConversation.count({
            where: {
              orgId: org.id,
              status: {
                in: [
                  ChatbotConversationStatus.LEAD_CAPTURED,
                  ChatbotConversationStatus.HANDED_OFF,
                  ChatbotConversationStatus.CLOSED,
                ],
              },
              createdAt: { gte: thisWeekStart },
            },
          }),
          prisma.chatbotConversation.count({
            where: {
              orgId: org.id,
              status: {
                in: [
                  ChatbotConversationStatus.LEAD_CAPTURED,
                  ChatbotConversationStatus.HANDED_OFF,
                  ChatbotConversationStatus.CLOSED,
                ],
              },
              createdAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
          }),
          prisma.visitor.count({
            where: {
              orgId: org.id,
              lastSeenAt: { gte: thisWeekStart },
            },
          }),
          prisma.visitor.count({
            where: {
              orgId: org.id,
              lastSeenAt: { gte: lastWeekStart, lt: thisWeekStart },
            },
          }),
        ]);

        const stats: StatRow[] = [
          {
            label: "Leads",
            thisWeek: leadsThisWeek,
            lastWeek: leadsLastWeek,
          },
          {
            label: "Tours",
            thisWeek: toursThisWeek,
            lastWeek: toursLastWeek,
          },
          {
            label: "Applications",
            thisWeek: applicationsThisWeek,
            lastWeek: applicationsLastWeek,
          },
          {
            label: "Chatbot conversations",
            thisWeek: chatsThisWeek,
            lastWeek: chatsLastWeek,
          },
          {
            label: "Site visitors",
            thisWeek: visitorsThisWeek,
            lastWeek: visitorsLastWeek,
          },
        ];

        const portalBase =
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const dateRange = formatDateRange(thisWeekStart, now);

        const { subject, html } = buildWeeklyDigestEmail({
          orgName: org.name,
          dateRange,
          stats,
          portalUrl: `${portalBase}/portal`,
        });

        const resend = getResend();
        if (!resend) {
          results.push({ orgId: org.id, sent: 0, error: "resend not configured" });
          continue;
        }

        const r = await resend.emails.send({
          from: FROM_EMAIL,
          to: org.primaryContactEmail as string,
          subject,
          html,
        });

        if (r.error) {
          results.push({
            orgId: org.id,
            sent: 0,
            error: r.error.message,
          });
          continue;
        }

        results.push({ orgId: org.id, sent: 1 });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/weekly-digest] error for org ${org.id}: ${message}`
        );
        results.push({ orgId: org.id, sent: 0, error: message });
      }
    }

    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);

    return {
      result: NextResponse.json({ orgs: orgs.length, sent: totalSent, results }),
      recordsProcessed: totalSent,
    };
  });
}

interface StatRow {
  label: string;
  thisWeek: number;
  lastWeek: number;
}

function buildWeeklyDigestEmail(opts: {
  orgName: string;
  dateRange: string;
  stats: StatRow[];
  portalUrl: string;
}): { subject: string; html: string } {
  const { orgName, dateRange, stats, portalUrl } = opts;
  const e = htmlEscape;

  const subject = `Your ${BRAND_NAME} week — ${dateRange}`;

  const rows = stats
    .map((s) => {
      const delta = s.thisWeek - s.lastWeek;
      const deltaText =
        delta > 0
          ? `<span style="color:#047857;font-size:12px;font-weight:600;">+${delta}</span>`
          : delta < 0
            ? `<span style="color:#b91c1c;font-size:12px;font-weight:600;">${delta}</span>`
            : `<span style="color:#6b7280;font-size:12px;">no change</span>`;

      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">
            ${e(s.label)}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:16px;font-weight:700;color:#111111;text-align:right;font-feature-settings:'tnum';">
            ${s.thisWeek}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">
            ${deltaText}
          </td>
        </tr>
      `;
    })
    .join("");

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151;">
      Here's your weekly summary for <strong style="color:#111111;">${e(orgName)}</strong>
      covering ${e(dateRange)}.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;margin:0 0 20px;">
      <thead>
        <tr style="background-color:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;font-weight:700;">
            Metric
          </th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;font-weight:700;">
            This week
          </th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;font-weight:700;">
            vs last week
          </th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6b7280;">
      Full details, lead history, and visitor analytics in your portal.
    </p>
    <p style="margin:0;font-size:13px;">
      <a href="${e(portalUrl)}" style="color:#2563EB;font-weight:600;text-decoration:none;">
        Open your portal
      </a>
    </p>
  `;

  const html = buildBaseHtml({
    headline: `Your ${BRAND_NAME} week`,
    bodyHtml,
    ctaText: "View full report",
    ctaUrl: portalUrl,
  });

  return { subject, html };
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `${fmt(start)} — ${fmt(end)}`;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
