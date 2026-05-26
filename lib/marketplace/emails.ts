import "server-only";

import {
  buildBaseHtml,
  getResend,
  FROM_EMAIL,
  APP_URL,
  BRAND_NAME,
} from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// Marketplace transactional emails
//
// sendSignInLinkEmail     — magic-link sign-in
// sendLeadDeliveryEmail   — fires when a purchase flips to PAID; carries full PII
// ---------------------------------------------------------------------------

export async function sendSignInLinkEmail(args: {
  to: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "resend_not_configured" };
  }

  const verifyUrl = `${APP_URL}/api/marketplace/auth/verify?token=${encodeURIComponent(args.token)}`;

  const html = buildBaseHtml({
    preheader: `Your one-time sign-in link for the ${BRAND_NAME} Marketplace.`,
    title: "Your sign-in link",
    headline: "Sign in to the Marketplace",
    bodyHtml: `
      <p style="font-size:15px;line-height:1.6;color:#1E2A3A;margin:0 0 16px;">
        Click the button below to sign in to the ${BRAND_NAME} Marketplace.
        This link expires in 30 minutes and can only be used once.
      </p>
      <div style="margin:24px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block;background-color:#2563EB;color:#ffffff;
                  font-family:Inter,sans-serif;font-size:14px;font-weight:600;
                  padding:12px 22px;border-radius:8px;text-decoration:none;">
          Sign in to the Marketplace →
        </a>
      </div>
      <p style="font-size:13px;line-height:1.55;color:#64748B;margin:0 0 8px;">
        If the button doesn't work, paste this URL into your browser:
      </p>
      <p style="font-size:12px;line-height:1.55;color:#64748B;margin:0;
                word-break:break-all;font-family:ui-monospace,SFMono-Regular,monospace;">
        ${verifyUrl}
      </p>
      <p style="font-size:13px;line-height:1.55;color:#64748B;margin:24px 0 0;">
        If you didn't request this, you can safely ignore the message.
      </p>
    `,
  });

  try {
    const sent = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `Your ${BRAND_NAME} Marketplace sign-in link`,
      html,
    });
    if (sent.error) {
      return { ok: false, error: sent.error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Seller sign-in link — same shape as the buyer one, different verify endpoint.
export async function sendSellerSignInLinkEmail(args: {
  to: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "resend_not_configured" };
  }
  const verifyUrl = `${APP_URL}/api/marketplace/seller-auth/verify?token=${encodeURIComponent(args.token)}`;
  const html = buildBaseHtml({
    preheader: `Your ${BRAND_NAME} Marketplace seller sign-in link.`,
    title: "Your seller sign-in link",
    headline: "Sign in to the Marketplace · Seller",
    bodyHtml: `
      <p style="font-size:15px;line-height:1.6;color:#1E2A3A;margin:0 0 16px;">
        Click the button below to sign in to your ${BRAND_NAME} Marketplace
        seller dashboard. Manage imported leads, see what's sold, and
        track payouts.
      </p>
      <div style="margin:24px 0;">
        <a href="${verifyUrl}"
           style="display:inline-block;background-color:#2563EB;color:#ffffff;
                  font-family:Inter,sans-serif;font-size:14px;font-weight:600;
                  padding:12px 22px;border-radius:8px;text-decoration:none;">
          Sign in to your seller dashboard →
        </a>
      </div>
      <p style="font-size:12px;line-height:1.55;color:#64748B;margin:0;
                word-break:break-all;font-family:ui-monospace,SFMono-Regular,monospace;">
        ${verifyUrl}
      </p>
      <p style="font-size:13px;line-height:1.55;color:#64748B;margin:24px 0 0;">
        This link expires in 30 minutes and can only be used once.
      </p>
    `,
  });
  try {
    const sent = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `Your ${BRAND_NAME} Marketplace seller sign-in link`,
      html,
    });
    if (sent.error) return { ok: false, error: sent.error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendLeadDeliveryEmail(args: {
  to: string;
  buyerName: string | null;
  leadId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  market: string;
  propertyType: string;
  intentScore: number;
  signal: string | null;
  budgetLabel: string | null;
  timeline: string | null;
  pricePaidCents: number;
  receiptUrl: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "resend_not_configured" };
  }

  const dashboardUrl = `${APP_URL}/marketplace/buyer`;

  const html = buildBaseHtml({
    preheader: `${args.fullName} · ${args.market} · ${args.intentScore} intent`,
    title: "Your lead is ready",
    headline: `Your lead is ready: ${args.fullName}`,
    bodyHtml: `
      <p style="font-size:15px;line-height:1.6;color:#1E2A3A;margin:0 0 20px;">
        ${args.buyerName ? `Hi ${escapeHtml(args.buyerName.split(" ")[0])}, ` : ""}your purchase is confirmed.
        Full contact details below.
      </p>

      <table cellpadding="0" cellspacing="0" border="0"
             style="width:100%;border-collapse:separate;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;">
        ${row("Name",      args.fullName)}
        ${row("Email",     args.email ?? "—")}
        ${row("Phone",     args.phone ?? "—")}
        ${row("Market",    args.market)}
        ${row("Property",  prettyType(args.propertyType))}
        ${row("Intent",    `${args.intentScore} / 100`)}
        ${args.signal     ? row("Signal",    args.signal) : ""}
        ${args.budgetLabel ? row("Budget",    args.budgetLabel) : ""}
        ${args.timeline   ? row("Timeline",  args.timeline) : ""}
        ${row("Price paid", `$${(args.pricePaidCents / 100).toFixed(2)}`, true)}
      </table>

      <p style="font-size:13px;line-height:1.55;color:#64748B;margin:24px 0 8px;">
        Lead reference: <span style="font-family:ui-monospace,SFMono-Regular,monospace;color:#1E2A3A;">${args.leadId}</span>
      </p>
      ${args.receiptUrl
        ? `<p style="font-size:13px;line-height:1.55;color:#64748B;margin:0 0 16px;">
             <a href="${args.receiptUrl}" style="color:#2563EB;text-decoration:none;">View Stripe receipt →</a>
           </p>`
        : ""}

      <div style="margin:24px 0;">
        <a href="${dashboardUrl}"
           style="display:inline-block;background-color:#2563EB;color:#ffffff;
                  font-family:Inter,sans-serif;font-size:14px;font-weight:600;
                  padding:10px 18px;border-radius:8px;text-decoration:none;">
          Open your dashboard →
        </a>
      </div>
    `,
  });

  try {
    const sent = await resend.emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: `Your lead is ready · ${args.fullName} · ${args.market}`,
      html,
    });
    if (sent.error) {
      return { ok: false, error: sent.error.message };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function row(label: string, value: string, strong = false): string {
  return `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #F1F5F9;width:120px;
                 font-family:ui-monospace,SFMono-Regular,monospace;font-size:10.5px;
                 letter-spacing:0.08em;text-transform:uppercase;color:#94A3B8;font-weight:600;">
        ${label}
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #F1F5F9;
                 font-family:Inter,sans-serif;font-size:14px;
                 color:${strong ? "#2563EB" : "#1E2A3A"};
                 font-weight:${strong ? "600" : "500"};">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
}

function prettyType(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
