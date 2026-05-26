import "server-only";
import {
  buildBaseHtml,
  sendBrandedEmail,
  escapeHtml,
  APP_URL,
  BRAND_NAME,
  AGENCY_ADMIN_EMAIL,
} from "./shared";

// ---------------------------------------------------------------------------
// Site Engine transactional emails. Sent when a SiteRequest moves through
// the queue. Phase 1 wires the two emails that bracket every submission:
//   - confirmation (to the submitter, "we got it, here's where to track it")
//   - ops alert    (to Adam / agency inbox, the new request landed)
// State-transition emails (kickoff, preview-ready, etc) land in Phase 2.
// ---------------------------------------------------------------------------

type SendResult = { ok: boolean; id?: string; error?: string };

export interface ConfirmationInput {
  to: string;
  submitterName: string;
  brandName: string;
  slug: string;
  statusUrl: string; // absolute URL the submitter can open to view status
  magicLinkUrl?: string | null; // null when the submitter was already logged in
}

export async function sendSiteRequestConfirmation(
  input: ConfirmationInput,
): Promise<SendResult> {
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escapeHtml(input.submitterName)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      We've received your website intake for <strong>${escapeHtml(input.brandName)}</strong>.
      You'll hear back within 1 business day with next steps.
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
      We design and build every site by hand &mdash; no templates. The intake
      you just submitted feeds directly into the build packet, so the more
      detail you gave us, the faster we move.
    </p>
    ${
      input.magicLinkUrl
        ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
            We've also created a lightweight ${escapeHtml(BRAND_NAME)} account
            for you so you can track progress, upload additional assets, and
            review the preview when it's ready. The link below signs you in
            for the next 7 days:
          </p>
          <p style="margin:0 0 16px;font-size:12px;color:#6b7280;">
            <a href="${escapeHtml(input.magicLinkUrl)}"
               style="word-break:break-all;color:#3b82f6;">
              ${escapeHtml(input.magicLinkUrl)}
            </a>
          </p>`
        : ""
    }
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7280;">
      Reference id:
      <code style="background:#f3f4f6;padding:2px 6px;border-radius:3px;">${escapeHtml(input.slug)}</code>
    </p>
  `;

  return sendBrandedEmail({
    to: input.to,
    subject: `Website intake received — ${input.brandName}`,
    template: "site-request-confirmation",
    html: buildBaseHtml({
      headline: "We've got your intake",
      preheader: `Your website request for ${input.brandName} is in the queue.`,
      bodyHtml,
      ctaText: "View request status",
      ctaUrl: input.statusUrl,
    }),
  });
}

export interface OpsAlertInput {
  brandName: string;
  submitterName: string;
  submitterEmail: string;
  tier: string;
  source: string | null;
  siteRequestId: string;
  inspirationUrls: string[];
}

export async function sendSiteRequestOpsAlert(
  input: OpsAlertInput,
): Promise<SendResult> {
  const adminUrl = `${APP_URL}/admin/site-engine/${input.siteRequestId}`;
  const inspirationList = input.inspirationUrls.length
    ? `<ul style="margin:0 0 16px 18px;padding:0;font-size:13px;color:#374151;">
        ${input.inspirationUrls
          .slice(0, 8)
          .map(
            (u) =>
              `<li><a href="${escapeHtml(u)}" style="color:#3b82f6;">${escapeHtml(u)}</a></li>`,
          )
          .join("")}
      </ul>`
    : `<p style="margin:0 0 16px;font-size:13px;color:#6b7280;">No inspiration URLs provided.</p>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      <strong>${escapeHtml(input.brandName)}</strong> just submitted a site request.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:12px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Submitter</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(input.submitterName)} (${escapeHtml(input.submitterEmail)})</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Tier</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(input.tier)}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Source</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escapeHtml(input.source ?? "direct")}</td>
      </tr>
    </table>
    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
      Inspiration URLs
    </p>
    ${inspirationList}
  `;

  return sendBrandedEmail({
    to: AGENCY_ADMIN_EMAIL,
    subject: `New site request: ${input.brandName}`,
    template: "site-request-ops-alert",
    html: buildBaseHtml({
      headline: "New site request",
      bodyHtml,
      ctaText: "Open in admin",
      ctaUrl: adminUrl,
    }),
  });
}
