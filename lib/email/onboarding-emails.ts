import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  FROM_EMAIL,
  BRAND_EMAIL,
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
  text?: string;
  replyTo?: string;
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

  const text = [
    `Hi ${input.name},`,
    "",
    `Thanks for the intake on behalf of ${input.companyName}. Our team reviews every submission personally before your call.`,
    "",
    input.bookedCallAt
      ? `Your consultation is booked for ${input.bookedCallAt}. You'll receive a calendar invite shortly.`
      : "We'll follow up within one business day with a time to speak.",
    "",
    "Keep an eye on your inbox for a proposal with retainer pricing, timeline, and next steps within 24 hours of our call.",
    "",
    `${BRAND_NAME}`,
    APP_URL,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `${BRAND_NAME}, your intake is in`,
    html,
    text,
    replyTo: BRAND_EMAIL,
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

  const text = [
    "New intake just landed.",
    "",
    `Company: ${input.companyName}`,
    `Contact: ${input.primaryContactName} (${input.primaryContactEmail})`,
    `Property type: ${input.propertyType}`,
    `Modules selected: ${input.moduleCount}`,
    `Pain point: ${input.biggestPainPoint ?? "—"}`,
    `Current vendor: ${input.currentVendor ?? "—"}`,
    `Current spend: ${spendDisplay}`,
    "",
    `${APP_URL}/admin/intakes/${input.intakeId}`,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `New intake, ${input.companyName}`,
    html,
    text,
    replyTo: input.primaryContactEmail,
  });
}

// ---------------------------------------------------------------------------
// sendClientPortalReadyEmail — sent to the primary contact when an intake is
// converted to a client org and their Clerk invitation is dispatched.
// ---------------------------------------------------------------------------

export async function sendClientPortalReadyEmail(input: {
  to: string;
  contactName: string;
  orgName: string;
  orgSlug: string;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) {
    return { ok: false, error: "Invalid recipient" };
  }

  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "leasestack.co";
  const portalUrl = `https://${input.orgSlug}.${platformDomain}/portal`;

  const firstName = input.contactName.split(" ")[0] ?? input.contactName;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Hi ${escape(firstName)},</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Your ${escape(BRAND_NAME)} portal for <strong>${escape(input.orgName)}</strong> is ready.
      You should have received a separate invitation email to set up your login.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Once you're in, you'll be able to track leads, review visitor intelligence,
      and monitor your marketing performance all in one place.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Reply to this email any time you have questions. We're here to make sure
      your onboarding goes smoothly.
    </p>
  `;

  const html = buildBaseHtml({
    headline: `Your ${BRAND_NAME} portal is ready`,
    bodyHtml,
    ctaText: "Open your portal",
    ctaUrl: portalUrl,
  });

  const text = [
    `Hi ${firstName},`,
    "",
    `Your ${BRAND_NAME} portal for ${input.orgName} is ready.`,
    "You should have received a separate invitation email to set up your login.",
    "",
    "Once you're in, you'll be able to track leads, review visitor intelligence, and monitor your marketing performance all in one place.",
    "",
    "Reply to this email any time you have questions.",
    "",
    `Open your portal: ${portalUrl}`,
    "",
    `${BRAND_NAME}`,
    APP_URL,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `Your ${BRAND_NAME} portal is ready`,
    html,
    text,
    replyTo: BRAND_EMAIL,
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
