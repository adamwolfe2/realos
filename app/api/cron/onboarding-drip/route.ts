import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrgType, TenantStatus } from "@prisma/client";
import { recordCronRun } from "@/lib/health/cron-run";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_NAME,
  BRAND_EMAIL,
} from "@/lib/email/shared";

// GET /api/cron/onboarding-drip
// Daily at 13:00 UTC. Sends setup-nudge emails to newly converted CLIENT orgs
// as they progress through onboarding. Three touch points:
//   Day 2 — no properties added yet
//   Day 5 — no data integration connected yet
//   Day 10 — no activity (no leads, no visitors)
//
// Dedup: AuditEvent rows (entityType='onboarding_drip', description=step) prevent
// repeat sends. The AuditEvent FK requires orgId which all orgs have.
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

  return recordCronRun("onboarding-drip", async () => {
    const now = new Date();

    const orgs = await prisma.organization.findMany({
      where: {
        orgType: OrgType.CLIENT,
        status: {
          in: [
            TenantStatus.INTAKE_RECEIVED,
            TenantStatus.CONSULTATION_BOOKED,
            TenantStatus.PROPOSAL_SENT,
            TenantStatus.CONTRACT_SIGNED,
            TenantStatus.BUILD_IN_PROGRESS,
            TenantStatus.QA,
            TenantStatus.LAUNCHED,
          ],
        },
        primaryContactEmail: { not: null },
      },
    });

    const portalBase =
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const results: Array<{ orgId: string; action: string; error?: string }> =
      [];

    for (const org of orgs) {
      try {
        const daysSince = Math.floor(
          (now.getTime() - org.createdAt.getTime()) / (24 * 60 * 60 * 1000)
        );

        // Determine which step is due.
        type StepKey = "add_property" | "add_integration" | "setup_checklist";
        let targetStep: StepKey | null = null;
        if (daysSince >= 2 && daysSince <= 4) targetStep = "add_property";
        else if (daysSince >= 5 && daysSince <= 9) targetStep = "add_integration";
        else if (daysSince >= 10 && daysSince <= 14) targetStep = "setup_checklist";

        if (!targetStep) {
          results.push({ orgId: org.id, action: "skip_window" });
          continue;
        }

        // Check dedup — has this step already been sent?
        const alreadySent = await prisma.auditEvent.findFirst({
          where: {
            orgId: org.id,
            entityType: "onboarding_drip",
            description: targetStep,
          },
        });

        if (alreadySent) {
          results.push({ orgId: org.id, action: "already_sent" });
          continue;
        }

        // Check the condition that triggers the nudge.
        const shouldSend = await checkStepCondition(org.id, targetStep);
        if (!shouldSend) {
          results.push({ orgId: org.id, action: "condition_not_met" });
          continue;
        }

        if (!isValidEmail(org.primaryContactEmail)) {
          results.push({ orgId: org.id, action: "skip_invalid_email" });
          continue;
        }

        const firstName =
          (org.primaryContactName ?? "there").split(" ")[0] ?? "there";
        const { subject, bodyHtml } = buildDripEmail(targetStep, {
          firstName,
          orgName: org.name,
          portalBase,
        });

        const html = buildBaseHtml({
          headline: subject,
          bodyHtml,
          ctaText: "Open your portal",
          ctaUrl: `${portalBase}/portal`,
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

        // Record the send so we never repeat this step.
        await prisma.auditEvent.create({
          data: {
            orgId: org.id,
            action: "UPDATE",
            entityType: "onboarding_drip",
            entityId: org.id,
            description: targetStep,
          },
        });

        results.push({ orgId: org.id, action: `sent_${targetStep}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[cron/onboarding-drip] error for org ${org.id}: ${message}`
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

async function checkStepCondition(
  orgId: string,
  step: "add_property" | "add_integration" | "setup_checklist"
): Promise<boolean> {
  if (step === "add_property") {
    const count = await prisma.property.count({ where: { orgId } });
    return count === 0;
  }

  if (step === "add_integration") {
    const [seo, ads, appfolio] = await Promise.all([
      prisma.seoIntegration.count({ where: { orgId } }),
      prisma.adAccount.count({ where: { orgId } }),
      prisma.appFolioIntegration.count({ where: { orgId } }),
    ]);
    return seo + ads + appfolio === 0;
  }

  // setup_checklist: no leads and no visitors in the org.
  const [leads, visitors] = await Promise.all([
    prisma.lead.count({ where: { orgId } }),
    prisma.visitor.count({ where: { orgId } }),
  ]);
  return leads + visitors === 0;
}

type StepKey = "add_property" | "add_integration" | "setup_checklist";

function buildDripEmail(
  step: StepKey,
  opts: { firstName: string; orgName: string; portalBase: string }
): { subject: string; bodyHtml: string } {
  const { firstName, orgName, portalBase } = opts;
  const e = htmlEscape;

  if (step === "add_property") {
    const propertiesUrl = `${portalBase}/portal/properties`;
    return {
      subject: `Add your first property to ${BRAND_NAME}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Your ${e(BRAND_NAME)} portal for ${e(orgName)} is ready, but we noticed you
          haven't added a property yet. Adding your first property unlocks lead
          tracking, visitor analytics, and the chatbot.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          It takes about two minutes. Head to your portal to get started.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          <a href="${e(propertiesUrl)}" style="color:#2563EB;">Add a property</a>
        </p>
      `,
    };
  }

  if (step === "add_integration") {
    const integrationsUrl = `${portalBase}/portal/settings/integrations`;
    return {
      subject: `Connect your first data source to ${BRAND_NAME}`,
      bodyHtml: `
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Your portal is live for ${e(orgName)}, and the next step is connecting a
          data source so we can start pulling in organic traffic, ad performance,
          and lead analytics.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          Connecting Google Search Console takes under five minutes and immediately
          shows you which keywords are driving traffic to your properties.
        </p>
        <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
          <a href="${e(integrationsUrl)}" style="color:#2563EB;">Connect an integration</a>
        </p>
      `,
    };
  }

  // setup_checklist
  const portalUrl = `${portalBase}/portal`;
  return {
    subject: `Your ${BRAND_NAME} setup checklist for ${orgName}`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        You've had your ${e(BRAND_NAME)} portal for ${e(orgName)} for about 10 days. Here's
        a quick summary of what would help unlock the most value right away:
      </p>
      <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;line-height:1.8;">
        <li>Add at least one property if you haven't yet</li>
        <li>Connect a data source (Google Search Console, Google Ads, or AppFolio)</li>
        <li>Review the lead capture settings on your site config</li>
      </ul>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        Any questions, just reply here and we'll help you get set up.
      </p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        <a href="${e(portalUrl)}" style="color:#2563EB;">Open your portal</a>
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
