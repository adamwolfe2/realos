import "server-only";
import {
  sendBrandedEmail,
  buildBaseHtml,
  isValidEmail,
  APP_URL,
  BRAND_NAME,
  AGENCY_ADMIN_EMAIL,
  escapeHtml,
} from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// Email the agency admin when a new content draft is submitted for
// review. Routes to AGENCY_ADMIN_EMAIL (set via env, defaults to
// team@leasestack.co). Single recipient, transactional.
//
// Goal: Adam sees new drafts off-portal so review turnaround stays low.
// Falls back silently if RESEND_API_KEY or AGENCY_ADMIN_EMAIL isn't set.
//
// Branding: routes through sendBrandedEmail + buildBaseHtml so the
// header / footer / unsubscribe match every other transactional email.
// Hand-rolled HTML shell removed during #26.
// ---------------------------------------------------------------------------

type Input = {
  draftId: string;
  format: string;
  brief: string;
  targetQuery: string | null;
  estimatedScore: number | null;
  clientOrgName: string;
  propertyName: string | null;
};

function buildBody(input: Input): string {
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const scoreBadge =
    input.estimatedScore != null
      ? `<span style="display:inline-block;background:#F3F4F6;color:#374151;font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;margin-left:8px;font-family:ui-monospace,monospace;">est. ${input.estimatedScore}</span>`
      : "";
  const queryRow = input.targetQuery
    ? `<p style="margin:8px 0 0;font-size:12px;color:#6B7280;font-family:ui-monospace,monospace;">target: ${escapeHtml(input.targetQuery)}</p>`
    : "";
  const propertyRow = input.propertyName
    ? ` · ${escapeHtml(input.propertyName)}`
    : "";

  return `
    <p style="margin:0;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">${escapeHtml(fmt)}${scoreBadge}</p>
    <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#111111;">${escapeHtml(input.clientOrgName)}${propertyRow}</p>
    ${queryRow}
    <table cellpadding="0" cellspacing="0" style="margin-top:18px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;width:100%;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Operator brief</p>
          <p style="margin:6px 0 0;font-size:13.5px;color:#111111;line-height:1.5;white-space:pre-wrap;">${escapeHtml(input.brief)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0;font-size:12px;color:#9CA3AF;">Sent to ${escapeHtml(BRAND_NAME)} reviewers because a new draft is in the queue. Review SLA: 24h.</p>
  `;
}

export async function sendDraftSubmittedEmail(input: Input): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isValidEmail(AGENCY_ADMIN_EMAIL)) {
    return { ok: false, error: "AGENCY_ADMIN_EMAIL invalid" };
  }
  const adminUrl = `${APP_URL}/admin/content-drafts/${input.draftId}`;
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const subject = `New draft from ${input.clientOrgName}: ${fmt}`;
  const html = buildBaseHtml({
    headline: "New draft pending review",
    bodyHtml: buildBody(input),
    ctaText: "Open in admin queue",
    ctaUrl: adminUrl,
    preheader: `${input.clientOrgName} submitted a ${fmt} for review`,
    title: subject,
  });

  const result = await sendBrandedEmail({
    to: AGENCY_ADMIN_EMAIL,
    subject,
    html,
    category: "transactional",
    template: "draft-submitted",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
