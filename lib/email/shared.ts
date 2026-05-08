// ---------------------------------------------------------------------------
// Shared email infrastructure: Resend client, validation, base HTML template,
// brand constants. Distribution-era portal-config dependency removed during
// the hard fork; env vars are read directly here.
// ---------------------------------------------------------------------------
import { Resend } from "resend";
import { getSiteUrl, BRAND_NAME, BRAND_LOCATION, BRAND_COLOR } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Brand constants (used by every domain email module)
// ---------------------------------------------------------------------------

// Some Vercel env vars are stored with a trailing \n — trim defensively.
export const FROM_EMAIL = (
  process.env.RESEND_FROM_EMAIL ?? `${BRAND_NAME} <hello@leasestack.co>`
).trim();
export const APP_URL = getSiteUrl();
export const OPS_NAME = process.env.OPS_NAME ?? `${BRAND_NAME} Team`;
export { BRAND_NAME, BRAND_LOCATION, BRAND_COLOR };
export const BRAND_EMAIL = process.env.ADMIN_EMAIL ?? "hello@leasestack.co";

// ---------------------------------------------------------------------------
// Resend client
// ---------------------------------------------------------------------------

export function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

// ---------------------------------------------------------------------------
// sendBrandedEmail — single send-helper used by every transactional email
// in the platform. Wraps Resend with the deliverability defaults that
// Gmail / Yahoo / Outlook expect from a modern transactional sender:
//
//   1. List-Unsubscribe headers (RFC 2369 + RFC 8058 one-click) — Gmail
//      and Yahoo's bulk-mail filters explicitly downrank senders without
//      these. Single biggest factor for landing in spam.
//
//   2. X-Entity-Ref-ID — opaque per-message identifier that helps
//      receiving mailers thread messages and gives Resend a handle to
//      track per-send delivery in their dashboard.
//
//   3. Tags — Resend categorizes deliverability stats per-template, so
//      we can see "invite has 12% spam rate, fix that template" instead
//      of an aggregate domain number.
//
//   4. Tracking disabled — click-tracking wraps every link in a
//      track.resend.com redirect, which (a) hurts deliverability on a
//      young sending domain because the recipient's filter associates
//      the redirect with bulk patterns, and (b) breaks the click-out
//      experience for users who hover the link before clicking.
//
//   5. Reply-To always set to a brand-aligned address (not the
//      inviter's gmail) so DMARC alignment doesn't blow up. We support
//      a custom reply-to override but default to the BRAND_EMAIL.
//
// `category: "transactional"` (invite, password reset, security) → only
//   `List-Unsubscribe: mailto:`. Most clients honor this for
//   transactional and don't render an Unsubscribe button on the message.
//
// `category: "broadcast"` (digests, weekly reports, lead nurture) →
//   adds the URL form + List-Unsubscribe-Post for one-click. Gmail
//   shows an Unsubscribe button in the inbox preview.
// ---------------------------------------------------------------------------

export type EmailCategory = "transactional" | "broadcast";

type BrandedSendInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Used for List-Unsubscribe header behavior. Defaults to "transactional". */
  category?: EmailCategory;
  /** Used for Resend tags + X-Entity-Ref-ID. Should be a kebab-case template name. */
  template?: string;
  /** Optional opaque ID for X-Entity-Ref-ID. Falls back to template+timestamp. */
  entityRefId?: string;
  /** URL that supports both GET (visible in body) and POST (one-click). Required for "broadcast". */
  unsubscribeUrl?: string;
  /** Extra tags for Resend filtering. Merged with the default { template, category } tags. */
  tags?: Array<{ name: string; value: string }>;
};

export type BrandedSendResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

const UNSUBSCRIBE_MAILBOX =
  process.env.UNSUBSCRIBE_EMAIL?.trim() || "unsubscribe@leasestack.co";

export async function sendBrandedEmail(
  opts: BrandedSendInput,
): Promise<BrandedSendResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Resend not configured" };
  }

  const category: EmailCategory = opts.category ?? "transactional";
  const template = opts.template ?? "generic";
  const refId =
    opts.entityRefId ?? `${template}-${Date.now().toString(36)}`;

  // Suppression check — never re-mail an address that's opted out.
  // Lazy-imported to keep the prisma client out of the cold-start path
  // for handlers that build emails but don't always send them.
  const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
  try {
    const { isEmailSuppressed } = await import("./suppression");
    if (await isEmailSuppressed(recipients)) {
      return {
        ok: false,
        error: `Recipient is on the email suppression list (${template})`,
      };
    }
  } catch (err) {
    // Suppression check is best-effort. Better to send than to crash
    // because the import or DB query failed.
    console.warn(`[email:${template}] suppression check failed:`, err);
  }

  // Resolve unsubscribe URL. For broadcast emails we auto-build a
  // signed one-click URL keyed to the recipient if the caller didn't
  // provide one — that's what unlocks the Gmail visible
  // "Unsubscribe" button. For transactional we don't auto-build
  // because the recipient just took an action that prompted the
  // email and shouldn't be invited to opt out of it.
  let unsubUrl = opts.unsubscribeUrl;
  if (!unsubUrl && category === "broadcast" && recipients.length === 1) {
    try {
      const { buildEmailUnsubUrl } = await import("./suppression");
      unsubUrl = buildEmailUnsubUrl(recipients[0]);
    } catch {
      // ignore — fall through to mailto-only header
    }
  }

  // List-Unsubscribe header. Gmail's RFC 8058 one-click only fires on
  // the URL form; the mailto form is the universal fallback.
  const unsubParts: string[] = [`<mailto:${UNSUBSCRIBE_MAILBOX}>`];
  if (unsubUrl) {
    unsubParts.unshift(`<${unsubUrl}>`);
  }
  const headers: Record<string, string> = {
    "List-Unsubscribe": unsubParts.join(", "),
    "X-Entity-Ref-ID": refId,
  };
  if (category === "broadcast" && unsubUrl) {
    // RFC 8058 one-click. The unsubscribeUrl MUST accept POST and
    // respond 200 OK with empty body — see /api/unsub/one-click.
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  const tags: Array<{ name: string; value: string }> = [
    { name: "template", value: template },
    { name: "category", value: category },
    ...(opts.tags ?? []),
  ];

  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: sanitizeSubject(opts.subject),
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
      replyTo: opts.replyTo ?? BRAND_EMAIL,
      headers,
      tags,
    });
    if (r.error) {
      console.error(
        `[email:${template}] Resend rejected send:`,
        r.error,
      );
      return { ok: false, error: r.error.message ?? "Resend API error" };
    }
    return { ok: true, id: r.data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[email:${template}] Resend send threw:`, msg);
    return { ok: false, error: msg };
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function isValidEmail(email: string | undefined | null): email is string {
  return !!email && email.includes("@");
}

// Resend (and SMTP) reject subject lines containing CR/LF as a
// header-injection guard. We've seen trailing \n flow in from env-var
// substitutions (BRAND_NAME) into subject lines and silently kill invites.
// Every transactional email should run subjects through this before send.
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
}

// Escape user-provided strings before interpolating them into HTML
// email bodies. Mirrors the helper in report-email.ts so any caller of
// buildBaseHtml can sanitize without re-implementing.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// buildBaseHtml -- branded email shell used by every transactional email.
// ---------------------------------------------------------------------------

export interface BaseHtmlOptions {
  headline: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  alertBannerHtml?: string;
  /** Show "Unsubscribe / manage preferences" link in the footer. Required for broadcast emails (RFC 8058 visible link). */
  includeUnsubscribe?: boolean;
  /** URL the visible Unsubscribe link points at. Required when includeUnsubscribe is true. */
  unsubscribeUrl?: string;
  /** Inbox preview text. Hidden in the rendered email body but used by Gmail/Apple Mail/Outlook to show a 1-line summary in the inbox list. CRITICAL for open rate. */
  preheader?: string;
  /** Browser tab title + accessibility. Some spam scanners deduct points for missing <title>. */
  title?: string;
  /** Sentence-case the CTA button instead of all-caps (default true going forward — all-caps reads as bulk/spam to filters). */
  ctaCase?: "upper" | "sentence";
  theme?: {
    outerBg?: string;
    innerBg?: string;
    headerBg?: string;
    headerText?: string;
    footerBg?: string;
    footerText?: string;
    footerSubText?: string;
    headlineColor?: string;
    border?: string;
  };
}

export function buildBaseHtml({
  headline,
  bodyHtml,
  ctaText,
  ctaUrl,
  alertBannerHtml,
  includeUnsubscribe,
  unsubscribeUrl,
  preheader,
  title,
  ctaCase = "sentence",
  theme,
}: BaseHtmlOptions): string {
  const outerBg = theme?.outerBg ?? "#F9F7F4";
  const innerBg = theme?.innerBg ?? "#FFFFFF";
  const headerBg = theme?.headerBg ?? BRAND_COLOR;
  const headerText = theme?.headerText ?? "#FFFFFF";
  const footerBg = theme?.footerBg ?? "#F9F7F4";
  const footerText = theme?.footerText ?? "#0A0A0A";
  const footerSubText = theme?.footerSubText ?? "#C8C0B4";
  const headlineColor = theme?.headlineColor ?? "#0A0A0A";
  const border = theme?.border ?? "#E5E1DB";

  // CTA button. Default: sentence-case ("Accept invitation"). All-caps
  // ("ACCEPT INVITATION") reads as bulk-mail and is a known spam-score
  // contributor — only use for high-conversion broadcast where the
  // headline already signals "this is a single transactional event."
  const ctaTransform = ctaCase === "upper" ? "uppercase" : "none";
  const ctaLetterSpacing = ctaCase === "upper" ? "0.06em" : "0";
  const ctaBlock =
    ctaText && ctaUrl
      ? `<tr><td style="padding:8px 32px 32px;">
          <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND_COLOR};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;padding:14px 28px;letter-spacing:${ctaLetterSpacing};text-transform:${ctaTransform};border-radius:6px;">${ctaText}</a>
        </td></tr>`
      : "";

  const alertBlock = alertBannerHtml
    ? `<tr><td style="background-color:#FFFBEB;border-bottom:2px solid #D97706;padding:14px 32px;">
        ${alertBannerHtml}
      </td></tr>`
    : "";

  // Support contact line for the footer. Reads from BRAND_EMAIL env (or
  // the default). Always rendered so the recipient never wonders where to
  // ask a question — required for trust, and a soft CAN-SPAM hygiene win.
  const supportEmail = process.env.ADMIN_EMAIL?.trim() || "hello@leasestack.co";
  const tagline = "Real estate operator portal";

  // Preheader (inbox preview text). Hidden in the rendered body via
  // a combination of styles + the &zwnj; trick so Gmail/Apple Mail/
  // Outlook show it in the inbox list. Without this, the first
  // visible text — usually "LEASESTACK / Real estate operator portal"
  // header — wastes the preview slot.
  const preheaderHtml = preheader
    ? `<div style="display:none !important;visibility:hidden;mso-hide:all;font-size:1px;color:${innerBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}${" ‌".repeat(200)}</div>`
    : "";

  // <title> for accessibility + minor spam-scanner credit. Default to
  // the headline so older callers still produce a populated tag.
  const titleText = escapeHtml(title ?? headline);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${titleText}</title>
</head>
<body style="margin:0;padding:0;background-color:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  ${preheaderHtml}
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${outerBg};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${innerBg};border:1px solid ${border};">
        <tr><td style="background-color:${headerBg};padding:22px 32px 20px;">
          <p style="margin:0;color:${headerText};font-size:12px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">${BRAND_NAME}</p>
          <p style="margin:4px 0 0;color:${headerText};opacity:0.65;font-size:11px;letter-spacing:0.04em;">${tagline}</p>
        </td></tr>
        ${alertBlock}
        <tr><td style="padding:32px 32px 24px;">
          <h1 style="margin:0 0 20px;color:${headlineColor};font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.3;">${headline}</h1>
          ${bodyHtml}
        </td></tr>
        ${ctaBlock}
        <tr><td style="padding:24px 32px;border-top:1px solid ${border};background-color:${footerBg};">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;">
                <p style="margin:0;color:${footerText};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${BRAND_NAME}</p>
                <p style="margin:6px 0 0;color:${footerSubText};font-size:12px;line-height:1.5;">
                  <a href="${APP_URL}" style="color:${footerSubText};text-decoration:none;">${APP_URL.replace(/^https?:\/\//, "")}</a>
                  ${BRAND_LOCATION ? `<br/>${BRAND_LOCATION}` : ""}
                </p>
              </td>
              <td style="vertical-align:top;text-align:right;">
                <p style="margin:0;color:${footerSubText};font-size:11px;letter-spacing:0.04em;">Questions?</p>
                <p style="margin:4px 0 0;font-size:12px;">
                  <a href="mailto:${supportEmail}" style="color:${footerText};text-decoration:underline;">${supportEmail}</a>
                </p>
              </td>
            </tr>
          </table>
          ${
            includeUnsubscribe
              ? `<p style="margin:14px 0 0;border-top:1px solid ${border};padding-top:12px;">
                  <a href="${unsubscribeUrl ?? `${APP_URL}/portal/settings`}" style="color:${footerSubText};font-size:11px;text-decoration:underline;">Unsubscribe</a>
                  <span style="color:${footerSubText};font-size:11px;"> · </span>
                  <a href="${APP_URL}/portal/settings" style="color:${footerSubText};font-size:11px;text-decoration:underline;">Manage email preferences</a>
                </p>`
              : ""
          }
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Shared email data interface kept as a light envelope type for the few
// transactional emails we still send from the platform (intake confirmations,
// build status, billing). Real-estate lead + chatbot notifications arrive in
// Sprint 10.
// ---------------------------------------------------------------------------

export interface OrderEmailData {
  orderNumber: string;
  orderId?: string;
  customerName: string;
  customerEmail: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  total: number;
}

// ---------------------------------------------------------------------------
// shouldSendEmail: checks notification preferences. Placeholder semantics
// until Sprint 10 rebuilds per-tenant email preferences.
// ---------------------------------------------------------------------------

export function shouldSendEmail(
  prefs:
    | {
        emailLeadAlerts?: boolean;
        emailVisitorDigest?: boolean;
        emailWeeklyDigest?: boolean;
      }
    | null
    | undefined,
  type: "leads" | "visitors" | "weekly"
): boolean {
  if (!prefs) return true;
  switch (type) {
    case "leads":
      return prefs.emailLeadAlerts !== false;
    case "visitors":
      return prefs.emailVisitorDigest !== false;
    case "weekly":
      return prefs.emailWeeklyDigest !== false;
    default:
      return true;
  }
}
