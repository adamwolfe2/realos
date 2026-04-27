/**
 * send-agency-welcome.ts — fire a one-off LeaseStack-branded welcome email
 * to a teammate / auditor who already has a Clerk account (e.g. created via
 * the Clerk dashboard "Create user" flow). They don't need a magic-link
 * invitation token, they just need to know:
 *   - their account is provisioned
 *   - what role they have
 *   - where to sign in
 *
 * Usage:
 *   set -a; source .env.local; set +a
 *   pnpm exec tsx scripts/send-agency-welcome.ts \
 *     --email jsoc@uoregon.edu \
 *     --inviter "Adam Wolfe" \
 *     [--purpose "platform audit"] \
 *     [--app-url https://leasestack.co]
 *
 * The sign-in URL defaults to the prod site (https://leasestack.co), NOT
 * NEXT_PUBLIC_APP_URL — that env var is usually set to localhost during
 * local dev and we don't want that landing in a recipient's inbox.
 */

import "dotenv/config";
import { Resend } from "resend";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const to = arg("--email")?.toLowerCase();
  const inviter = arg("--inviter") ?? "The LeaseStack team";
  const purpose = arg("--purpose") ?? null;
  if (!to) throw new Error("--email is required");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const brandName = process.env.BRAND_NAME ?? "LeaseStack";
  // Hard default to the production site. NEXT_PUBLIC_APP_URL is usually
  // localhost in .env.local — never use it for outbound mail.
  const appUrl =
    arg("--app-url") ??
    process.env.PUBLIC_SITE_URL ??
    "https://leasestack.co";
  const signInUrl = `${appUrl}/sign-in`;
  const from =
    process.env.RESEND_FROM_EMAIL ?? `${brandName} <hello@leasestack.co>`;
  const brandEmail = process.env.ADMIN_EMAIL ?? "hello@leasestack.co";

  const resend = new Resend(apiKey);

  const purposeLine = purpose
    ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;">You've been added so you can run a <strong>${escape(
        purpose
      )}</strong> across our tenants and surfaces.</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background-color:#F9F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F7F4;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E5E1DB;">
        <tr><td style="background-color:#0A0A0A;padding:24px 32px;">
          <p style="margin:0;color:#FFFFFF;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">${escape(
            brandName
          )}</p>
        </td></tr>
        <tr><td style="padding:32px 32px 24px;">
          <h1 style="margin:0 0 20px;color:#0A0A0A;font-family:Georgia,serif;font-size:24px;font-weight:700;line-height:1.3;">Welcome to ${escape(
            brandName
          )} Agency</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;"><strong>${escape(
            inviter
          )}</strong> added you to the ${escape(
    brandName
  )} agency cockpit as a super admin. You'll have full access to tenants, leads, audit logs, and impersonation.</p>
          ${purposeLine}
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Your account is already provisioned. Sign in with the credentials ${escape(
            inviter
          )} shared with you.</p>
        </td></tr>
        <tr><td style="padding:8px 32px 32px;">
          <a href="${signInUrl}" style="display:inline-block;background-color:#0A0A0A;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:14px 28px;letter-spacing:0.06em;text-transform:uppercase;">Sign in to ${escape(
    brandName
  )}</a>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #E5E1DB;background-color:#F9F7F4;">
          <p style="margin:0;color:#0A0A0A;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;">${escape(
            brandName
          )}</p>
          <p style="margin:4px 0 0;color:#C8C0B4;font-size:12px;">${appUrl.replace(
            /^https?:\/\//,
            ""
          )}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to ${brandName} Agency`,
    "",
    `${inviter} added you to the ${brandName} agency cockpit as a super admin.`,
    purpose ? `Purpose: ${purpose}.` : "",
    "",
    `Your account is already provisioned. Sign in with the credentials ${inviter} shared with you.`,
    "",
    `Sign in: ${signInUrl}`,
    "",
    brandName,
    appUrl,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await resend.emails.send({
    from,
    to,
    subject: `Welcome to ${brandName} Agency`,
    html,
    text,
    replyTo: brandEmail,
  });

  if (result.error) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }

  console.log(`OK welcome email sent to ${to} (id: ${result.data?.id})`);
}

function escape(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

main().catch((err) => {
  console.error("send-agency-welcome failed:", err);
  process.exit(1);
});
