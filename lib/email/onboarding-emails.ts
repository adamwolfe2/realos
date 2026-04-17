import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  APP_URL,
  BRAND_NAME,
} from "./shared";

// ---------------------------------------------------------------------------
// Intake + onboarding transactional emails.
// TODO(Sprint 10): split into per-milestone templates (consultation-booked,
// proposal-sent, contract-signed, build-in-progress, launched) and wire up
// the onboarding-drip cron.
// ---------------------------------------------------------------------------

type SendResult = { ok: boolean; id?: string; error?: string };

async function safeSend(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Resend not configured" };
  }
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { ok: true, id: r.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function sendIntakeReceivedEmail(input: {
  to: string;
  name: string;
  companyName: string;
  bookedCallAt?: string;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) {
    return { ok: false, error: "Invalid recipient" };
  }

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escape(input.name)},</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Thanks for the intake on behalf of ${escape(input.companyName)}. Our team reviews every
      submission personally before your call, so when we meet you can skip the discovery and
      jump straight to building your marketing stack.
    </p>
    ${
      input.bookedCallAt
        ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Your consultation is booked for <strong>${escape(
        input.bookedCallAt
      )}</strong>. You'll receive a calendar invite shortly.
    </p>`
        : `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      We'll follow up within one business day with a time to speak.
    </p>`
    }
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Keep an eye on your inbox for a proposal with retainer pricing, timeline, and next
      steps within 24 hours of our call.
    </p>
  `;

  const html = buildBaseHtml({
    headline: `Thanks, ${escape(input.name.split(" ")[0] ?? input.name)}`,
    bodyHtml,
    ctaText: "Visit our site",
    ctaUrl: APP_URL,
  });

  return safeSend({
    to: input.to,
    subject: `${BRAND_NAME}, your intake is in`,
    html,
  });
}

export async function notifyAgencyOfIntake(input: {
  to: string;
  intakeId: string;
  companyName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  propertyType: string;
  moduleCount: number;
  biggestPainPoint?: string;
  currentVendor?: string;
  currentMonthlySpendCents?: number | null;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) {
    return { ok: false, error: "Invalid recipient" };
  }

  const spendDisplay =
    input.currentMonthlySpendCents != null
      ? `$${Math.round(input.currentMonthlySpendCents / 100).toLocaleString()}/mo`
      : "unknown";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      New intake just landed.
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 16px;">
      <tbody>
        ${row("Company", input.companyName)}
        ${row("Contact", `${input.primaryContactName} (${input.primaryContactEmail})`)}
        ${row("Property type", input.propertyType)}
        ${row("Modules selected", String(input.moduleCount))}
        ${row("Pain point", input.biggestPainPoint ?? "—")}
        ${row("Current vendor", input.currentVendor ?? "—")}
        ${row("Current spend", spendDisplay)}
      </tbody>
    </table>
  `;

  const html = buildBaseHtml({
    headline: "New intake, " + input.companyName,
    bodyHtml,
    ctaText: "Open in admin",
    ctaUrl: `${APP_URL}/admin/intakes/${input.intakeId}`,
  });

  return safeSend({
    to: input.to,
    subject: `New intake, ${input.companyName}`,
    html,
  });
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;width:40%;">${escape(
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
