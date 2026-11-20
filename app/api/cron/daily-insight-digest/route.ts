import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recordCronRun } from "@/lib/health/cron-run";
import { verifyCronAuth } from "@/lib/cron/auth";
import { getOpenInsights, getInsightCounts } from "@/lib/insights/queries";
import {
  buildInsightDigestEmail,
  insightDigestSubject,
  type DigestPayload,
} from "@/lib/email/insight-digest-email";
import { getResend, FROM_EMAIL } from "@/lib/email/shared";

import { digestAudiences } from "@/lib/email/digest-audiences";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ---------------------------------------------------------------------------
// GET /api/cron/daily-insight-digest
//
// Fires every weekday at 09:00 UTC (vercel.json). For every org with
// ≥1 unresolved open insight, builds a daily digest email and sends to
// every org member. Orgs with zero open insights are silently skipped
// — no "you have nothing to do" emails. Spam-safe.
//
// Auth: Bearer CRON_SECRET (matches the weekly-digest pattern).
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  return recordCronRun("daily-insight-digest", async () => {
    const orgs = await prisma.organization.findMany({
      where: {
        // Only send to orgs that are actually using the product. Skips
        // CHURNED / PROSPECT / TRIAL_EXPIRED states so we don't ping
        // people who lapsed.
        status: { in: ["LAUNCHED", "ACTIVE", "AT_RISK"] },
        orgType: "CLIENT",
      },
      select: { id: true, name: true },
    });

    const portalBase =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://leasestack.co";
    const resend = getResend();

    let sent = 0;
    let skippedNoInsights = 0;
    let skippedNoMembers = 0;
    const errors: Array<{ orgId: string; error: string }> = [];

    for (const org of orgs) {
      try {
        // Recipients are grouped by property access. A property-restricted
        // member (UserPropertyAccess rows) gets a digest built from only
        // their granted properties, same as /portal/insights shows them;
        // everyone else gets the org-wide digest. Before this, every member
        // got every property's insights (titles, bodies, property names).
        const members = await prisma.user.findMany({
          where: { orgId: org.id },
          select: { email: true, propertyAccess: { select: { propertyId: true } } },
        });
        const audiences = digestAudiences(members);
        if (audiences.length === 0) {
          skippedNoMembers += 1;
          continue;
        }

        if (!resend) {
          errors.push({
            orgId: org.id,
            error: "RESEND_API_KEY not configured",
          });
          continue;
        }

        let orgSent = 0;
        let orgHadInsights = false;
        for (const audience of audiences) {
          const insightScope = { propertyIds: audience.propertyIds ?? undefined };
          const counts = await getInsightCounts(org.id, insightScope);
          if (counts.total === 0) continue;
          const insights = await getOpenInsights(org.id, { ...insightScope, limit: 5 });
          if (insights.length === 0) continue;
          orgHadInsights = true;

          const payload: DigestPayload = {
            orgName: org.name,
            insights: insights.map((i) => ({
              id: i.id,
              severity:
                (i.severity as "info" | "warning" | "critical") ?? "info",
              category: i.category,
              title: i.title,
              body: i.body,
              suggestedAction: i.suggestedAction ?? null,
              href: i.href ?? null,
              propertyName: i.property?.name ?? null,
            })),
            counts: {
              critical: counts.critical,
              warning: counts.warning,
              info: counts.info,
              total: counts.total,
            },
            portalUrl: portalBase,
          };

          const subject = insightDigestSubject(payload);
          const html = buildInsightDigestEmail(payload);

          const unsubMailbox =
            process.env.UNSUBSCRIBE_EMAIL?.trim() ||
            "unsubscribe@leasestack.co";

          const sendResults = await Promise.allSettled(
            audience.emails.map((email) =>
              resend.emails.send({
                from: FROM_EMAIL,
                to: email,
                subject,
                html,
                headers: {
                  "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
                  "X-Entity-Ref-ID": `daily-insight-${org.id}-${email}`,
                },
                tags: [
                  { name: "template", value: "daily-insight-digest" },
                  { name: "category", value: "broadcast" },
                ],
              }),
            ),
          );

          for (const result of sendResults) {
            if (result.status === "fulfilled" && !result.value.error) {
              orgSent += 1;
            } else if (result.status === "rejected") {
              const msg =
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason);
              errors.push({
                orgId: org.id,
                error: `send failed: ${msg}`,
              });
            } else if (
              result.status === "fulfilled" &&
              result.value.error
            ) {
              errors.push({
                orgId: org.id,
                error: `resend error: ${result.value.error.message}`,
              });
            }
          }
        }
        if (!orgHadInsights) skippedNoInsights += 1;

        sent += orgSent;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/daily-insight-digest] error for org ${org.id}: ${message}`,
        );
        errors.push({ orgId: org.id, error: message });
      }
    }

    return {
      result: NextResponse.json({
        ok: true,
        orgsScanned: orgs.length,
        emailsSent: sent,
        skippedNoInsights,
        skippedNoMembers,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
      }),
      recordsProcessed: sent,
    };
  });
}
