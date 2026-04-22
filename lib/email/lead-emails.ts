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

export async function sendLeadAutoReplyEmail(input: {
  to: string;
  firstName?: string | null;
  orgName: string;
  fromEmail?: string | null;
  phone?: string | null;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) return { ok: false, error: "Invalid recipient" };

  const greeting = input.firstName?.trim()
    ? `Hi ${escape(input.firstName.trim())},`
    : "Hi,";
  const greetingText = input.firstName?.trim()
    ? `Hi ${input.firstName.trim()},`
    : "Hi,";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Thanks for reaching out to ${escape(input.orgName)}. Our leasing team will follow up
      within one business day with next steps, a list of available units, and tour times.
    </p>
    ${
      input.phone
        ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Can't wait? Call us at <strong>${escape(input.phone)}</strong>.
    </p>`
        : ""
    }
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      In the meantime, feel free to keep browsing floor plans and amenities on our site.
    </p>
  `;
  const html = buildBaseHtml({
    headline: `Thanks for applying to ${input.orgName}`,
    bodyHtml,
  });

  const text = [
    greetingText,
    "",
    `Thanks for reaching out to ${input.orgName}. Our leasing team will follow up within one business day with next steps, a list of available units, and tour times.`,
    ...(input.phone ? ["", `Can't wait? Call us at ${input.phone}.`] : []),
    "",
    "In the meantime, feel free to keep browsing floor plans and amenities on our site.",
    "",
    input.orgName,
  ].join("\n");

  return safeSend({
    to: input.to,
    from: input.fromEmail ?? FROM_EMAIL,
    subject: `${input.orgName}, we got your application`,
    html,
    text,
    replyTo: input.fromEmail ?? FROM_EMAIL,
  });
}

export async function notifyTenantOfLeadEmail(input: {
  to: string;
  orgName: string;
  leadId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  sourceDetail?: string | null;
  preferredUnitType?: string | null;
  notes?: string | null;
  appUrl: string;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) return { ok: false, error: "Invalid recipient" };

  const name =
    [input.firstName, input.lastName].filter(Boolean).join(" ") ||
    input.email ||
    "Unknown";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      New lead for <strong>${escape(input.orgName)}</strong>.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tbody>
        ${row("Name", name)}
        ${row("Email", input.email ?? "—")}
        ${row("Phone", input.phone ?? "—")}
        ${row("Source", `${input.source}${input.sourceDetail ? `, ${input.sourceDetail}` : ""}`)}
        ${row("Preferred unit", input.preferredUnitType ?? "—")}
        ${row("Notes", input.notes ?? "—")}
      </tbody>
    </table>
  `;
  const html = buildBaseHtml({
    headline: `New lead, ${input.orgName}`,
    bodyHtml,
    ctaText: "Open in portal",
    ctaUrl: `${input.appUrl}/portal/leads/${input.leadId}`,
  });

  const text = [
    `New lead for ${input.orgName}.`,
    "",
    `Name: ${name}`,
    `Email: ${input.email ?? "—"}`,
    `Phone: ${input.phone ?? "—"}`,
    `Source: ${input.source}${input.sourceDetail ? `, ${input.sourceDetail}` : ""}`,
    `Preferred unit: ${input.preferredUnitType ?? "—"}`,
    `Notes: ${input.notes ?? "—"}`,
    "",
    `${input.appUrl}/portal/leads/${input.leadId}`,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `New lead, ${input.orgName} (${name})`,
    html,
    text,
    replyTo: input.email ?? undefined,
  });
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;width:30%;">${escape(
        label
      )}</td>
      <td style="padding:6px 0;font-size:13px;color:#0a0a0a;">${escape(value)}</td>
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
