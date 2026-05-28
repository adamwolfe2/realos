import "server-only";
import { buildBaseHtml } from "./shared";
import type { LeadNotifyChannel } from "@prisma/client";

// ---------------------------------------------------------------------------
// buildLeadNotifyEmail — instant lead-capture alert template. Shared by every
// channel (chatbot, popup, form, ingest, tour, visitor → lead, manual). The
// body is intentionally minimal: lead summary + a single CTA button to the
// portal lead detail page. No marketing chrome; this is an operational ping.
// ---------------------------------------------------------------------------

const CHANNEL_LABEL: Record<LeadNotifyChannel, string> = {
  CHATBOT: "Chatbot",
  POPUP: "Popup",
  FORM: "Website form",
  INGEST: "Integration webhook",
  TOUR: "Tour request",
  VISITOR_CONVERT: "Visitor converted",
  MANUAL: "Manual portal add",
};

type LeadNotifyEmailInput = {
  orgName: string;
  subject: string;
  channel: LeadNotifyChannel;
  lead: {
    name: string | null;
    email: string | null;
    phone: string | null;
    sourceLabel: string | null;
    intent: string | null;
  };
  propertyName: string | null;
  portalUrl: string;
};

type LeadNotifyEmailOutput = { html: string; text: string };

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string | null): string {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:8px 0;color:#6b7280;font-size:13px;vertical-align:top;white-space:nowrap;width:120px;">${escape(label)}</td>
      <td style="padding:8px 0;color:#111827;font-size:14px;font-weight:500;">${escape(value)}</td>
    </tr>`;
}

export function buildLeadNotifyEmail(
  input: LeadNotifyEmailInput,
): LeadNotifyEmailOutput {
  const channelLabel = CHANNEL_LABEL[input.channel] ?? input.channel;
  const displayName =
    input.lead.name ?? input.lead.email ?? "a new lead";

  const summaryRows =
    row("Name", input.lead.name) +
    row("Email", input.lead.email) +
    row("Phone", input.lead.phone) +
    row("Source", input.lead.sourceLabel ?? channelLabel) +
    row("Property", input.propertyName) +
    row("Intent", input.lead.intent);

  const body = `
    <p style="margin:0 0 12px 0;color:#111827;font-size:15px;line-height:1.55;">
      You just captured a new lead via <strong>${escape(channelLabel)}</strong>.
    </p>
    <p style="margin:0 0 24px 0;color:#374151;font-size:14px;line-height:1.55;">
      ${escape(displayName)} just gave you their contact info on
      ${escape(input.propertyName ?? input.orgName)}. Reach out fast — the
      first 5 minutes are the difference between a tour and a ghost.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:0 0 24px 0;">
      ${summaryRows}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
      <tr>
        <td style="background:#111827;border-radius:6px;">
          <a href="${escape(input.portalUrl)}"
             style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            Open in portal
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0 0;color:#6b7280;font-size:12px;line-height:1.5;">
      You're receiving this because you set ${escape(input.orgName)}'s lead
      notification email in Portal → Settings. Change or disable channel
      alerts at any time from that page.
    </p>
  `;

  const html = buildBaseHtml({
    title: input.subject,
    headline: `New lead — ${displayName}`,
    preheader: `${displayName} — ${input.propertyName ?? input.orgName}`,
    bodyHtml: body,
  });

  const textLines = [
    `New lead via ${channelLabel}`,
    "",
    input.lead.name ? `Name: ${input.lead.name}` : null,
    input.lead.email ? `Email: ${input.lead.email}` : null,
    input.lead.phone ? `Phone: ${input.lead.phone}` : null,
    input.lead.sourceLabel ? `Source: ${input.lead.sourceLabel}` : null,
    input.propertyName ? `Property: ${input.propertyName}` : null,
    input.lead.intent ? `Intent: ${input.lead.intent}` : null,
    "",
    `Open in portal: ${input.portalUrl}`,
  ].filter((line): line is string => line !== null);

  return { html, text: textLines.join("\n") };
}
