import "server-only";
import {
  getResend,
  isValidEmail,
  FROM_EMAIL,
  APP_URL,
  BRAND_NAME,
  AGENCY_ADMIN_EMAIL,
} from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// Email the agency admin when a new content draft is submitted for
// review. Routes to AGENCY_ADMIN_EMAIL (set via env, defaults to
// team@leasestack.co). Single recipient, transactional.
//
// Goal: Adam sees new drafts off-portal so review turnaround stays low.
// Falls back silently if RESEND_API_KEY or AGENCY_ADMIN_EMAIL isn't set.
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

function e(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(input: Input, adminUrl: string): string {
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const scoreBadge =
    input.estimatedScore != null
      ? `<span style="display:inline-block;background:#F3F4F6;color:#374151;font-size:11px;font-weight:600;padding:2px 8px;border-radius:3px;margin-left:8px;font-family:ui-monospace,monospace;">est. ${input.estimatedScore}</span>`
      : "";
  const queryRow = input.targetQuery
    ? `<p style="margin:8px 0 0;font-size:12px;color:#6B7280;font-family:ui-monospace,monospace;">target: ${e(input.targetQuery)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>New draft from ${e(input.clientOrgName)}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="background:#2563EB;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">${e(BRAND_NAME)} Admin</p>
              <p style="margin:8px 0 0;color:#BFDBFE;font-size:13px;">Content draft pending review</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#111111;">${e(input.clientOrgName)}${input.propertyName ? ` · ${e(input.propertyName)}` : ""}</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">${e(fmt)}${scoreBadge}</p>
              ${queryRow}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0;">
              <table cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px;width:100%;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6B7280;">Operator brief</p>
                    <p style="margin:6px 0 0;font-size:13.5px;color:#111111;line-height:1.5;white-space:pre-wrap;">${e(input.brief)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <a href="${e(adminUrl)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:4px;letter-spacing:0.04em;">Open in admin queue</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Sent to ${e(BRAND_NAME)} reviewers because a new draft is in the queue. Review SLA: 24h.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDraftSubmittedEmail(input: Input): Promise<{
  ok: boolean;
  error?: string;
}> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };
  if (!isValidEmail(AGENCY_ADMIN_EMAIL)) {
    return { ok: false, error: "AGENCY_ADMIN_EMAIL invalid" };
  }
  const adminUrl = `${APP_URL}/admin/content-drafts/${input.draftId}`;
  try {
    const res = await resend.emails.send({
      from: FROM_EMAIL,
      to: AGENCY_ADMIN_EMAIL,
      subject: `New draft from ${input.clientOrgName}: ${input.format.replace(/_/g, " ").toLowerCase()}`,
      html: buildHtml(input, adminUrl),
      tags: [
        { name: "template", value: "draft-submitted" },
        { name: "category", value: "transactional-admin" },
      ],
    });
    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
