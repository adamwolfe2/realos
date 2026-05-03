import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  sanitizeSubject,
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
      subject: sanitizeSubject(opts.subject),
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    });
    if (r.error) {
      console.error("[email] Resend rejected send:", r.error);
      return { ok: false, error: r.error.message ?? "Resend API error" };
    }
    return { ok: true, id: r.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[email] Resend send threw:", msg);
    return { ok: false, error: msg };
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

// ---------------------------------------------------------------------------
// sendTeammateInviteEmail — sent when a client owner/admin (or agency operator)
// invites a teammate into a CLIENT organization. Suppresses Clerk's default
// invitation email so we control branding (LeaseStack, never the Clerk app
// name) and explicitly name the inviting company/property/portfolio.
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  CLIENT_OWNER: "Owner",
  CLIENT_ADMIN: "Admin",
  CLIENT_VIEWER: "Viewer",
  LEASING_AGENT: "Leasing agent",
  AGENCY_OWNER: "Agency owner",
  AGENCY_ADMIN: "Agency admin",
  AGENCY_OPERATOR: "Agency operator",
};

export async function sendTeammateInviteEmail(input: {
  to: string;
  orgName: string;
  role: string;
  acceptUrl: string;
  inviterName?: string | null;
  inviterEmail?: string | null;
  expiresInDays?: number;
}): Promise<SendResult> {
  if (!isValidEmail(input.to)) {
    return { ok: false, error: "Invalid recipient" };
  }

  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const inviter = input.inviterName?.trim() || input.inviterEmail?.trim() || null;
  const expires = input.expiresInDays ?? 30;

  const introLine = inviter
    ? `<strong>${escape(inviter)}</strong> invited you to join <strong>${escape(
        input.orgName
      )}</strong> on ${escape(BRAND_NAME)} as <strong>${escape(roleLabel)}</strong>.`
    : `You have been invited to join <strong>${escape(
        input.orgName
      )}</strong> on ${escape(BRAND_NAME)} as <strong>${escape(roleLabel)}</strong>.`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${introLine}</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      ${escape(BRAND_NAME)} is the marketing platform powering ${escape(
    input.orgName
  )}'s lead capture, visitor intelligence, advertising, and resident
      conversations. Once you accept, you'll have access to dashboards, leads,
      and reports for ${escape(input.orgName)}.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5b5b5b;">
      This invitation expires in ${expires} days. If you weren't expecting this,
      you can safely ignore the email.
    </p>
  `;

  const html = buildBaseHtml({
    headline: `You're invited to ${input.orgName}`,
    bodyHtml,
    ctaText: "Accept invitation",
    ctaUrl: input.acceptUrl,
  });

  const text = [
    inviter
      ? `${inviter} invited you to join ${input.orgName} on ${BRAND_NAME} as ${roleLabel}.`
      : `You have been invited to join ${input.orgName} on ${BRAND_NAME} as ${roleLabel}.`,
    "",
    `${BRAND_NAME} powers ${input.orgName}'s marketing platform. Once you accept, you'll have access to dashboards, leads, and reports for ${input.orgName}.`,
    "",
    `Accept your invitation: ${input.acceptUrl}`,
    "",
    `This invitation expires in ${expires} days.`,
    "",
    `${BRAND_NAME}`,
    APP_URL,
  ].join("\n");

  return safeSend({
    to: input.to,
    subject: `You're invited to ${input.orgName} on ${BRAND_NAME}`,
    html,
    text,
    replyTo: BRAND_EMAIL,
  });
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:6px 12px 6px 0;font-size:12px;color:#87867f;text-transform:uppercase;letter-spacing:0.08em;width:40%;">${escape(
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
