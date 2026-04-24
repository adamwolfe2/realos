import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
} from "./shared";

type SendResult = { ok: boolean; id?: string; error?: string };

async function safeSend(opts: {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };
  try {
    const r = await resend.emails.send({
      from: opts.from ?? FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
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

export async function sendVisitorOutreachEmail(input: {
  to: string;
  firstName?: string | null;
  orgName: string;
  applyUrl?: string | null;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) return { ok: false, error: "Invalid recipient" };
  const greeting = input.firstName?.trim()
    ? `Hi ${escape(input.firstName.trim())},`
    : "Hi,";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Saw you browsing ${escape(input.orgName)}. If you'd like, grab a tour time
      and we'll show you the available units in person (or do it virtually).
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Any questions before you decide? Just reply to this email, a real person
      reads every response.
    </p>
  `;
  const html = buildBaseHtml({
    headline: `Quick hello from ${input.orgName}`,
    bodyHtml,
    ctaText: "Book a tour",
    ctaUrl: input.applyUrl ?? "#",
    includeUnsubscribe: true,
  });

  const greetingText = input.firstName?.trim()
    ? `Hi ${input.firstName.trim()},`
    : "Hi,";
  const text = [
    greetingText,
    "",
    `Saw you browsing ${input.orgName}. If you'd like, grab a tour time and we'll show you the available units in person (or do it virtually).`,
    "",
    "Any questions before you decide? Just reply to this email, a real person reads every response.",
    ...(input.applyUrl ? ["", `Book a tour: ${input.applyUrl}`] : []),
    "",
    input.orgName,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `Following up from ${input.orgName}`,
    html,
    text,
  });
}

export async function sendVisitorWeeklyDigest(input: {
  to: string;
  orgName: string;
  totalVisitors: number;
  identified: number;
  highIntent: number;
  convertedToLead: number;
  rangeLabel: string;
  portalUrl: string;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) return { ok: false, error: "Invalid recipient" };
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
      Quick roll-up of your pixel-captured traffic for ${escape(input.rangeLabel)}.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tbody>
        ${row("Total visitors", input.totalVisitors.toLocaleString())}
        ${row("Identified", input.identified.toLocaleString())}
        ${row("High intent, score 60+", input.highIntent.toLocaleString())}
        ${row("Converted to a lead", input.convertedToLead.toLocaleString())}
      </tbody>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Full list + outreach queue lives in the portal.
    </p>
  `;
  const html = buildBaseHtml({
    headline: `${input.orgName}, weekly pixel report`,
    bodyHtml,
    ctaText: "Open portal",
    ctaUrl: input.portalUrl,
  });

  const text = [
    `Quick roll-up of your pixel-captured traffic for ${input.rangeLabel}.`,
    "",
    `Total visitors: ${input.totalVisitors.toLocaleString()}`,
    `Identified: ${input.identified.toLocaleString()}`,
    `High intent (score 60+): ${input.highIntent.toLocaleString()}`,
    `Converted to a lead: ${input.convertedToLead.toLocaleString()}`,
    "",
    `Full list + outreach queue: ${input.portalUrl}`,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `${input.orgName}, weekly pixel report`,
    html,
    text,
  });
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;color:#87867f;text-transform:uppercase;letter-spacing:0.08em;width:55%;">${escape(
        label
      )}</td>
      <td style="padding:6px 0;font-size:16px;color:#0a0a0a;font-weight:600;">${escape(value)}</td>
    </tr>
  `;
}

function escape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
