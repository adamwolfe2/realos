import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_EMAIL,
  APP_URL,
} from "./shared";

// Transactional emails for the Cursive pixel provisioning queue.
//
// AudienceLab does not expose a programmatic pixel-creation API, so customer
// requests sit in /admin/pixel-requests until ops sets up the pixel + segment
// + workflow in AL's dashboard and pastes the resulting pixel_id back into
// the admin Cursive panel. This module powers the two notifications that
// bracket that lifecycle: ops gets a heads-up on submit, customer gets a
// "ready to install" email on fulfillment.

type SendResult = { ok: boolean; id?: string; error?: string };

async function safeSend(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
    return { ok: true, id: r.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Sent to ops the moment a customer submits the "Connect Cursive pixel" form.
// Recipient is PIXEL_REQUEST_NOTIFY_EMAIL (falls back to ADMIN_EMAIL).
export async function sendPixelRequestOpsEmail(input: {
  orgName: string;
  orgId: string;
  websiteName: string;
  websiteUrl: string;
  requestedByEmail?: string | null;
  requestId: string;
}): Promise<SendResult> {
  const to =
    process.env.PIXEL_REQUEST_NOTIFY_EMAIL ?? BRAND_EMAIL;
  if (!isValidEmail(to)) return { ok: false, error: "Invalid ops recipient" };

  const adminQueueUrl = `${APP_URL}/admin/pixel-requests`;
  const clientUrl = `${APP_URL}/admin/clients/${input.orgId}`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      <strong>${escape(input.orgName)}</strong> just requested an identity-resolution
      pixel for <a href="${escape(input.websiteUrl)}">${escape(input.websiteUrl)}</a>.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Website name</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escape(input.websiteName)}</td>
      </tr>
      <tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Website URL</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escape(input.websiteUrl)}</td>
      </tr>
      ${
        input.requestedByEmail
          ? `<tr>
        <td style="padding:6px 16px 6px 0;font-size:12px;color:#6b7280;">Requested by</td>
        <td style="padding:6px 0;font-size:13px;color:#111827;">${escape(input.requestedByEmail)}</td>
      </tr>`
          : ""
      }
    </table>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#374151;">
      <strong>Fulfillment steps in AudienceLab:</strong>
    </p>
    <ol style="margin:0 0 16px 18px;padding:0;font-size:13px;line-height:1.6;color:#374151;">
      <li>Create a new V4 pixel for ${escape(input.websiteUrl)}</li>
      <li>Create a Studio Segment scoped to that pixel</li>
      <li>Add a Workflow: Studio Segment Trigger → Custom HTTP, target <code>${APP_URL}/api/webhooks/cursive</code> (POST, JSON, include <code>pixel_id</code> in the body)</li>
      <li>Copy the pixel_id and paste it into <a href="${clientUrl}">${escape(input.orgName)}'s admin Cursive panel</a> — saving will mark this request fulfilled and email the customer their install snippet.</li>
    </ol>
  `;

  return safeSend({
    to,
    subject: `New pixel request: ${input.orgName}`,
    html: buildBaseHtml({
      headline: "New Cursive pixel request",
      bodyHtml,
      ctaText: "Open admin queue",
      ctaUrl: adminQueueUrl,
    }),
  });
}

// Sent to the customer when ops marks the request fulfilled (which happens
// automatically when ops pastes the pixel_id into the admin Cursive panel).
export async function sendPixelReadyCustomerEmail(input: {
  to: string;
  customerName: string;
  websiteUrl: string;
  installSnippet: string;
  webhookUrl?: string | null;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) return { ok: false, error: "Invalid recipient" };

  const portalUrl = `${APP_URL}/portal/settings/integrations`;

  const webhookSection = input.webhookUrl
    ? `
    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
      AudienceLab webhook URL
    </p>
    <pre style="margin:0 0 8px;padding:12px;background:#0a0a0a;color:#f8f9fa;font-family:Menlo,Monaco,Consolas,monospace;font-size:11px;line-height:1.5;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${escape(input.webhookUrl)}</pre>
    <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#374151;">
      Paste this into the AudienceLab pixel under Webhooks. AudienceLab's Test
      button should pass immediately. No additional headers required.
    </p>
  `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escape(input.customerName)},</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Your visitor identification pixel for <strong>${escape(input.websiteUrl)}</strong> is live.
      Paste the snippet below into the <code>&lt;head&gt;</code> of your site and named
      visitors will start showing up in your portal within a few minutes.
    </p>
    <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">
      Install snippet
    </p>
    <pre style="margin:0 0 16px;padding:12px;background:#0a0a0a;color:#f8f9fa;font-family:Menlo,Monaco,Consolas,monospace;font-size:11px;line-height:1.5;border-radius:4px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;">${escape(input.installSnippet)}</pre>
    ${webhookSection}
    <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#374151;">
      You can always grab this snippet again from your portal under Settings → Integrations.
    </p>
  `;

  return safeSend({
    to: input.to,
    subject: "Your visitor pixel is live",
    html: buildBaseHtml({
      headline: "Your pixel is ready to install",
      bodyHtml,
      ctaText: "Open portal",
      ctaUrl: portalUrl,
    }),
  });
}
