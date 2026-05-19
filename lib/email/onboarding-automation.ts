// ---------------------------------------------------------------------------
// Self-serve onboarding automation — phase-aware email templates.
//
// Extends the legacy onboarding-drip touchpoints (add_property,
// add_integration, setup_checklist) with phase-specific nudges:
//
//   Day 2  (Foundation) — how to add your first property
//   Day 4  (Foundation) — how to connect your first data source
//   Day 7  (Foundation, stuck) — "we're standing by"
//   Day 9  (Growth) — verify your first lead captures
//   Day 14 (Growth, stuck) — "want to jump on a call?"
//
// Every template respects the global unsubscribe + suppression list at
// send-time (the cron route checks shouldSendEmail before each call).
// ---------------------------------------------------------------------------

import { BRAND_NAME } from "@/lib/email/shared";

export type OnboardingAutomationStep =
  | "foundation_day2_add_property"
  | "foundation_day4_connect_data"
  | "foundation_day7_stuck"
  | "growth_day9_verify_leads"
  | "growth_day14_stuck";

export type OnboardingAutomationCopy = {
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
};

type Args = {
  firstName: string;
  orgName: string;
  portalBase: string;
  // Cal.com / Calendly-style booking link for the day-14 "jump on a call"
  // nudge. Defaults to the team scheduling link configured in env.
  callBookingUrl: string;
};

export function buildOnboardingAutomationEmail(
  step: OnboardingAutomationStep,
  args: Args,
): OnboardingAutomationCopy {
  const e = htmlEscape;
  const { firstName, orgName, portalBase, callBookingUrl } = args;

  switch (step) {
    case "foundation_day2_add_property": {
      const url = `${portalBase}/portal/properties`;
      return {
        subject: `How to add your first property to ${BRAND_NAME}`,
        ctaText: "Add a property",
        ctaUrl: url,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Welcome to ${e(BRAND_NAME)}! The first step to lighting up your
            ${e(orgName)} workspace is adding a property. It takes about two
            minutes and unlocks lead tracking, visitor analytics, and your
            AI chatbot.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Use the "Add property" button in the portal to fill in the name,
            address, and unit count. We'll handle the rest.
          </p>
        `,
      };
    }

    case "foundation_day4_connect_data": {
      const url = `${portalBase}/portal/settings/integrations`;
      return {
        subject: `Connect your first data source to ${BRAND_NAME}`,
        ctaText: "Connect an integration",
        ctaUrl: url,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Now that ${e(orgName)} is set up, the next step is connecting a
            data source so we can pull in organic traffic, ad performance,
            and visitor analytics.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Google Search Console takes under five minutes and immediately
            shows which keywords drive traffic to your properties. AppFolio
            is the most powerful option if you use it as your PMS.
          </p>
        `,
      };
    }

    case "foundation_day7_stuck": {
      const url = `${portalBase}/portal`;
      return {
        subject: `Need a hand getting ${e(orgName)} set up?`,
        ctaText: "Open your portal",
        ctaUrl: url,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            You've had your ${e(BRAND_NAME)} workspace for a week. We see
            there are still a few setup steps left — totally normal, and
            we're standing by if anything's blocking you.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            The checklist on your portal home shows exactly where you are
            in the Foundation phase. Tap any step to jump right in, or
            reply to this email and we'll help walk you through it.
          </p>
        `,
      };
    }

    case "growth_day9_verify_leads": {
      const url = `${portalBase}/portal/leads`;
      return {
        subject: `Verify your first lead captures from ${e(orgName)}`,
        ctaText: "Open your leads",
        ctaUrl: url,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            You're in the Growth phase — nice progress. The fastest way to
            validate everything is wired up is to submit a test inquiry
            through your marketing site and confirm it shows up under
            Leads.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Once that test lead appears, you can ship the same form to your
            real audience with confidence.
          </p>
        `,
      };
    }

    case "growth_day14_stuck": {
      return {
        subject: `Want to jump on a call about ${e(orgName)}?`,
        ctaText: "Pick a time",
        ctaUrl: callBookingUrl,
        bodyHtml: `
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${e(firstName)},</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            You've been using ${e(BRAND_NAME)} for two weeks. Some operators
            sail through Growth, others hit a snag — either way we'd love
            to spend 20 minutes with you reviewing ${e(orgName)}'s setup
            and clearing anything that's in the way.
          </p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
            Grab any time that works. No prep needed.
          </p>
        `,
      };
    }
  }
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
