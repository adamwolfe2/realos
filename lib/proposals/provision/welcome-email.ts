import "server-only";
import {
  buildBaseHtml,
  escapeHtml,
  getResend,
  isValidEmail,
  sanitizeSubject,
  FROM_EMAIL,
  BRAND_EMAIL,
  BRAND_NAME,
  APP_URL,
} from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// Post-payment welcome email.
//
// Distinct from the proposal email (which is the "review and pay" touch).
// This one fires the moment provisioning lands: the prospect has paid, the
// Org is live, the Clerk invite has been issued (or attempted) — and we
// confirm "your portal is ready" with the accept-invite URL and the
// platform portal URL the operator will eventually live on.
//
// Mirrors the tone of `sendClientPortalReadyEmail` in
// `lib/email/onboarding-emails.ts` (the equivalent for the manual intake-
// conversion path) so the transactional voice stays consistent across
// signup paths.
// ---------------------------------------------------------------------------

export type SendWelcomeEmailArgs = {
  prospectEmail: string;
  prospectName: string;
  orgName: string;
  orgSlug: string;
  /**
   * The Clerk invite URL when the invite was issued successfully. When null
   * (Clerk failure earlier in provisioning) we fall back to the generic
   * /sign-up surface and trust the operator will retry the invite.
   */
  inviteAcceptUrl: string | null;
};

export type SendWelcomeEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export async function sendWelcomeEmail(
  args: SendWelcomeEmailArgs,
): Promise<SendWelcomeEmailResult> {
  if (!isValidEmail(args.prospectEmail)) {
    return { ok: false, error: "Invalid recipient email" };
  }
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Resend not configured" };
  }

  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "leasestack.co";
  const portalUrl = `https://${args.orgSlug}.${platformDomain}/portal`;
  const fallbackInviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? APP_URL}/sign-up`;
  const acceptUrl = args.inviteAcceptUrl ?? fallbackInviteUrl;
  const firstName =
    args.prospectName.trim().split(/\s+/)[0] ?? args.prospectName;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Hi ${escapeHtml(firstName)},
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Welcome to ${escapeHtml(BRAND_NAME)} — your workspace for
      <strong>${escapeHtml(args.orgName)}</strong> is live.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Click the button below to accept your invitation and finish setting up
      your login. Once you're in, you'll be able to connect your PMS, install
      the visitor pixel, and start tracking lead sources end-to-end.
    </p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#64748B;">
      Your portal will live at
      <a href="${escapeHtml(portalUrl)}" style="color:#2563EB;text-decoration:underline;">${escapeHtml(portalUrl)}</a>
      once you're signed in.
    </p>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#64748B;">
      Reply to this email any time with questions — happy to help.
    </p>
  `;

  const html = buildBaseHtml({
    headline: `Welcome to ${BRAND_NAME}`,
    bodyHtml,
    ctaText: "Accept your invitation",
    ctaUrl: acceptUrl,
    preheader: `Your ${BRAND_NAME} workspace for ${args.orgName} is ready — accept your invite to finish setup.`,
    title: `Welcome to ${BRAND_NAME}`,
  });

  const text = [
    `Hi ${firstName},`,
    "",
    `Welcome to ${BRAND_NAME} — your workspace for ${args.orgName} is live.`,
    "",
    "Accept your invitation to finish setting up your login:",
    acceptUrl,
    "",
    `Your portal will live at: ${portalUrl}`,
    "",
    "Reply any time with questions.",
    "",
    BRAND_NAME,
  ].join("\n");

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.prospectEmail,
      subject: sanitizeSubject(`Welcome to ${BRAND_NAME}`),
      html,
      text,
      replyTo: BRAND_EMAIL,
      headers: {
        "X-Entity-Ref-ID": `proposal-welcome-${args.orgSlug}`,
      },
      tags: [
        { name: "template", value: "proposal-welcome" },
        { name: "category", value: "transactional" },
      ],
    });
    if (result.error) {
      return {
        ok: false,
        error: result.error.message ?? "Resend rejected the send",
      };
    }
    return { ok: true, messageId: result.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Welcome email send failed",
    };
  }
}
