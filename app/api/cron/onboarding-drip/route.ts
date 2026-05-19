import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  OnboardingPhase,
  OrgType,
  TenantStatus,
} from "@prisma/client";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
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
import { isEmailSuppressed } from "@/lib/email/suppression";
import { syncOnboardingProgress } from "@/lib/onboarding/step-detectors";
import {
  buildOnboardingAutomationEmail,
  type OnboardingAutomationStep,
} from "@/lib/email/onboarding-automation";

export const maxDuration = 300; // 5 min — Vercel Pro cap; crons need it for unbounded loops

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
  const authError = verifyCronAuth(req);
  if (authError) return authError;

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

        // Phase-aware drip runs every pass regardless of legacy window
        // (it has its own dedup). The new system understands FOUNDATION
        // vs GROWTH and short-circuits once the phase completes, so
        // sending it for every org is cheap.
        await sendPhaseAwareDrip({ org, daysSince, portalBase, results });

        // Determine which legacy step is due.
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

        const unsubMailbox =
          process.env.UNSUBSCRIBE_EMAIL?.trim() ||
          "unsubscribe@leasestack.co";
        const r = await resend.emails.send({
          from: FROM_EMAIL,
          to: org.primaryContactEmail as string,
          subject,
          html,
          replyTo: BRAND_EMAIL,
          headers: {
            "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
            "X-Entity-Ref-ID": `onboarding-drip-${org.id}-${targetStep}`,
          },
          tags: [
            { name: "template", value: `onboarding-drip-${targetStep}` },
            { name: "category", value: "broadcast" },
          ],
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
    // Onboarding-drip "has the operator added a property?" — only count
    // marketable rows. AppFolio dumping 50 parking lots into the DB
    // doesn't mean the operator has actually onboarded a building.
    const count = await prisma.property.count({
      where: marketablePropertyWhere(orgId),
    });
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

// ---------------------------------------------------------------------------
// Phase-aware drip (FOUNDATION / GROWTH automation).
//
// Day-window matrix:
//   2  → foundation_day2_add_property      (sent only if Foundation still active)
//   4  → foundation_day4_connect_data      (still in Foundation)
//   7  → foundation_day7_stuck             (still in Foundation, with steps remaining)
//   9  → growth_day9_verify_leads          (advanced to Growth)
//   14 → growth_day14_stuck                (still in Growth, with steps remaining)
//
// Dedup uses the same AuditEvent table (entityType = "onboarding_drip",
// description = the step key) so a retried cron pass never sends twice.
// Suppression: every send checks `isEmailSuppressed` first.
// ---------------------------------------------------------------------------

type DripOrg = {
  id: string;
  name: string;
  primaryContactEmail: string | null;
  primaryContactName: string | null;
};

async function sendPhaseAwareDrip(opts: {
  org: DripOrg;
  daysSince: number;
  portalBase: string;
  results: Array<{ orgId: string; action: string; error?: string }>;
}): Promise<void> {
  const { org, daysSince, portalBase, results } = opts;

  // Pick the target step for this day-window. We only fire at exact
  // boundaries; otherwise the cron repeats too often for the same org.
  const step: OnboardingAutomationStep | null =
    daysSince === 2
      ? "foundation_day2_add_property"
      : daysSince === 4
        ? "foundation_day4_connect_data"
        : daysSince === 7
          ? "foundation_day7_stuck"
          : daysSince === 9
            ? "growth_day9_verify_leads"
            : daysSince === 14
              ? "growth_day14_stuck"
              : null;
  if (!step) return;

  if (!isValidEmail(org.primaryContactEmail)) return;

  // Sync the onboarding progress so the gate checks the freshest state.
  // Cheap — short-circuits if the org has cleared POLISH.
  const progress = await syncOnboardingProgress(org.id).catch(() => null);
  if (!progress) return;

  // Phase gate — only send a nudge whose target phase matches where the
  // operator actually is. Skip the Foundation nudges once they've moved
  // to Growth, etc.
  const expectedPhase: OnboardingPhase | null = step.startsWith("foundation")
    ? OnboardingPhase.FOUNDATION
    : step.startsWith("growth")
      ? OnboardingPhase.GROWTH
      : null;
  if (!expectedPhase) return;
  if (progress.currentPhase !== expectedPhase) return;

  // The "stuck" nudges should only fire if there are real outstanding
  // steps. If the operator happens to have cleared everything but the
  // phase hasn't advanced yet (race), suppress the nag.
  if (step === "foundation_day7_stuck" || step === "growth_day14_stuck") {
    const outstanding = progress.steps.filter(
      (s) =>
        s.phase === expectedPhase &&
        s.status !== "COMPLETED" &&
        s.status !== "SKIPPED",
    );
    if (outstanding.length === 0) return;
  }

  const dedupKey = `phase_${step}`;
  const alreadySent = await prisma.auditEvent.findFirst({
    where: {
      orgId: org.id,
      entityType: "onboarding_drip",
      description: dedupKey,
    },
  });
  if (alreadySent) {
    results.push({ orgId: org.id, action: `phase_already_sent:${step}` });
    return;
  }

  const recipient = org.primaryContactEmail as string;
  const suppressed = await isEmailSuppressed(recipient).catch(() => false);
  if (suppressed) {
    results.push({ orgId: org.id, action: `phase_skip_suppressed:${step}` });
    return;
  }

  const resend = getResend();
  if (!resend) {
    results.push({ orgId: org.id, action: `phase_skip_resend_missing:${step}` });
    return;
  }

  const firstName =
    (org.primaryContactName ?? "there").split(" ")[0] ?? "there";
  const callBookingUrl =
    process.env.LEASESTACK_BOOKING_URL?.trim() ||
    "https://cal.com/leasestack/intro";

  const { subject, bodyHtml, ctaText, ctaUrl } =
    buildOnboardingAutomationEmail(step, {
      firstName,
      orgName: org.name,
      portalBase,
      callBookingUrl,
    });

  const html = buildBaseHtml({
    headline: subject,
    bodyHtml,
    ctaText,
    ctaUrl,
  });

  const unsubMailbox =
    process.env.UNSUBSCRIBE_EMAIL?.trim() || "unsubscribe@leasestack.co";
  const r = await resend.emails.send({
    from: FROM_EMAIL,
    to: recipient,
    subject,
    html,
    replyTo: BRAND_EMAIL,
    headers: {
      "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
      "X-Entity-Ref-ID": `onboarding-drip-${org.id}-${dedupKey}`,
    },
    tags: [
      { name: "template", value: `onboarding-${step}` },
      { name: "category", value: "broadcast" },
    ],
  });

  if (r.error) {
    results.push({
      orgId: org.id,
      action: `phase_email_error:${step}`,
      error: r.error.message,
    });
    return;
  }

  await prisma.auditEvent.create({
    data: {
      orgId: org.id,
      action: "UPDATE",
      entityType: "onboarding_drip",
      entityId: org.id,
      description: dedupKey,
    },
  });

  results.push({ orgId: org.id, action: `sent_phase_${step}` });
}
