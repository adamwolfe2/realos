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
// Validation
// ---------------------------------------------------------------------------

export function isValidEmail(email: string | undefined | null): email is string {
  return !!email && email.includes("@");
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
  includeUnsubscribe?: boolean;
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

  const ctaBlock =
    ctaText && ctaUrl
      ? `<tr><td style="padding:8px 32px 32px;">
          <a href="${ctaUrl}" style="display:inline-block;background-color:${BRAND_COLOR};color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:14px 28px;letter-spacing:0.06em;text-transform:uppercase;">${ctaText}</a>
        </td></tr>`
      : "";

  const alertBlock = alertBannerHtml
    ? `<tr><td style="background-color:#FFFBEB;border-bottom:2px solid #D97706;padding:14px 32px;">
        ${alertBannerHtml}
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${outerBg};padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${innerBg};border:1px solid ${border};">
        <tr><td style="background-color:${headerBg};padding:24px 32px;">
          <p style="margin:0;color:${headerText};font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">${BRAND_NAME}</p>
        </td></tr>
        ${alertBlock}
        <tr><td style="padding:32px 32px 24px;">
          <h1 style="margin:0 0 20px;color:${headlineColor};font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.3;">${headline}</h1>
          ${bodyHtml}
        </td></tr>
        ${ctaBlock}
        <tr><td style="padding:20px 32px;border-top:1px solid ${border};background-color:${footerBg};">
          <p style="margin:0;color:${footerText};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">${BRAND_NAME}</p>
          <p style="margin:4px 0 0;color:${footerSubText};font-size:12px;">${APP_URL.replace(/^https?:\/\//, "")}${BRAND_LOCATION ? ` &nbsp;&middot;&nbsp; ${BRAND_LOCATION}` : ""}</p>
          ${includeUnsubscribe ? `<p style="margin:8px 0 0;"><a href="${APP_URL}/portal/settings" style="color:${footerSubText};font-size:11px;text-decoration:underline;">Unsubscribe or manage email preferences</a></p>` : ""}
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
