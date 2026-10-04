import "server-only";

import { runAfter } from "@/lib/after";
import { trackServer } from "@/lib/analytics-server";
import {
  AGENCY_ADMIN_EMAIL,
  APP_URL,
  buildBaseHtml,
  escapeHtml,
  sendBrandedEmail,
} from "@/lib/email/shared";

// One place for "a prospect left their email on /audit": funnel event plus an
// internal alert. Called from /api/audit/start (email supplied up front) and
// /api/audit/[id]/capture-email. Both run after the response; never throws.
export async function notifyAuditLead(input: {
  auditId: string;
  domain: string;
  email: string;
}): Promise<void> {
  const { auditId, domain, email } = input;
  await trackServer({
    event: "audit_email_captured",
    distinctId: `audit:${auditId}`,
  });
  await runAfter("audit-lead-alert", async () => {
    const r = await sendBrandedEmail({
      to: AGENCY_ADMIN_EMAIL,
      subject: `Audit lead: ${domain}`,
      html: buildBaseHtml({
        headline: "New audit lead",
        bodyHtml: `<p><strong>${escapeHtml(email)}</strong> left their email after auditing <strong>${escapeHtml(domain)}</strong>.</p>`,
        ctaText: "See audit leads",
        ctaUrl: `${APP_URL}/admin/audit-leads`,
      }),
      template: "audit-lead-alert",
    });
    if (!r.ok) console.warn("[audit-lead] alert not sent:", r.error);
  });
}
