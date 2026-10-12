import "server-only";
import {
  buildBaseHtml,
  getResend,
  isValidEmail,
  sanitizeSubject,
  FROM_EMAIL,
  BRAND_EMAIL,
  APP_URL,
} from "./shared";

type SendResult = { ok: boolean; id?: string; error?: string };

// Pixel provisioning notifications. Transactional category — sent in
// response to a specific request lifecycle event (submit / fulfillment).
async function safeSend(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  template?: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };
  const template = opts.template ?? "ops-notification";
  const refId = `${template}-${Date.now().toString(36)}`;
  const unsubMailbox =
    process.env.UNSUBSCRIBE_EMAIL?.trim() || "unsubscribe@leasestack.co";
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: sanitizeSubject(opts.subject),
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      headers: {
        "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
        "X-Entity-Ref-ID": refId,
      },
      tags: [
        { name: "template", value: template },
        { name: "category", value: "transactional" },
      ],
    });
    return { ok: true, id: r.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Ops heads-up for marketplace module requests: paid add-on activation
// (billing page) or "notify me" interest in an unreleased module.
export async function sendModuleRequestOpsEmail(input: {
  orgId: string;
  orgName: string;
  moduleName: string;
  intent: "notify" | "activate";
  requestedByEmail?: string | null;
}): Promise<SendResult> {
  const to = BRAND_EMAIL;
  if (!isValidEmail(to)) return { ok: false, error: "Invalid ops recipient" };
  const clientUrl = `${APP_URL}/admin/clients/${input.orgId}`;
  const activate = input.intent === "activate";
  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      <strong>${escape(input.orgName)}</strong> ${
        activate
          ? `asked to add <strong>${escape(input.moduleName)}</strong> to their paid plan. Add the Stripe item, enable the module, and confirm with them.`
          : `wants to be notified when <strong>${escape(input.moduleName)}</strong> is available.`
      }
    </p>
    ${
      input.requestedByEmail
        ? `<p style="margin:0;font-size:13px;color:#374151;">Requested by ${escape(input.requestedByEmail)}</p>`
        : ""
    }
  `;
  return safeSend({
    to,
    subject: `${activate ? "Add-on request" : "Module interest"}: ${input.orgName} / ${input.moduleName}`,
    html: buildBaseHtml({
      headline: activate ? "Add-on activation request" : "Module interest",
      bodyHtml,
      ctaText: "Open client",
      ctaUrl: clientUrl,
    }),
    template: activate ? "addon-request-ops" : "module-interest-ops",
  });
}
