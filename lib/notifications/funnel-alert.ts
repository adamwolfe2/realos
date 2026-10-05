import "server-only";

import { prisma } from "@/lib/db";
import { runAfter } from "@/lib/after";
import {
  AGENCY_ADMIN_EMAIL,
  APP_URL,
  buildBaseHtml,
  escapeHtml,
  sendBrandedEmail,
} from "@/lib/email/shared";

// Internal heads-up when a self-serve operator signs up or finishes the
// onboarding wizard, so someone can call them while they are warm. Both
// real trials before 2026-10 expired with nobody reaching out. Runs after
// the response; never throws.
const COPY = {
  signup: { subject: "New signup", headline: "New workspace signed up" },
  onboarding_completed: {
    subject: "Onboarding finished",
    headline: "A trial just finished onboarding",
  },
} as const;

export async function alertFunnelStep(input: {
  orgId: string;
  step: keyof typeof COPY;
}): Promise<void> {
  const { orgId, step } = input;
  await runAfter(`funnel-alert:${step}`, async () => {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        users: { select: { email: true }, take: 3 },
        properties: { select: { name: true, websiteUrl: true }, take: 10 },
      },
    });
    if (!org) {
      console.warn(`[funnel-alert] org ${orgId} not found for ${step}`);
      return;
    }
    const emails = org.users.map((u) => escapeHtml(u.email)).join(", ") || "none yet";
    const props = org.properties
      .map((p) => `<li>${escapeHtml(p.name)}${p.websiteUrl ? ` (${escapeHtml(p.websiteUrl)})` : ""}</li>`)
      .join("");
    const { subject, headline } = COPY[step];
    const r = await sendBrandedEmail({
      to: AGENCY_ADMIN_EMAIL,
      subject: `${subject}: ${org.name}`,
      html: buildBaseHtml({
        headline,
        bodyHtml:
          `<p><strong>${escapeHtml(org.name)}</strong></p>` +
          `<p>Contact: ${emails}</p>` +
          (props ? `<p>Properties:</p><ul>${props}</ul>` : ""),
        ctaText: "Open workspace",
        ctaUrl: `${APP_URL}/admin/clients/${orgId}`,
      }),
      template: `funnel-alert-${step}`,
    });
    if (!r.ok) console.warn(`[funnel-alert] ${step} alert not sent:`, r.error);
  });
}
