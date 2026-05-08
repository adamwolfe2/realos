import "server-only";
import { getResend, FROM_EMAIL, BRAND_EMAIL } from "./shared";
import { buildReportEmail, shareReportUrl, type ReportEmailInput } from "./report-email";
import type { ReportSnapshot } from "@/lib/reports/generate";

export interface SendReportInput {
  to: string[];
  orgName: string;
  orgLogoUrl?: string | null;
  snapshot: ReportSnapshot;
  shareToken: string;
  headline?: string | null;
  notes?: string | null;
  recipientName?: string | null;
  senderName?: string | null;
  replyTo?: string | null;
}

export interface SendReportResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  previewHtml?: string;
  previewSubject?: string;
  skipped?: "no_resend_key";
}

/**
 * Send a Weekly / Monthly / custom client report via Resend. Gracefully
 * degrades when RESEND_API_KEY isn't set — returns the rendered preview so
 * operators can still copy it into their own mail client until the sending
 * domain lands.
 */
export async function sendReportEmail(input: SendReportInput): Promise<SendReportResult> {
  const emailInput: ReportEmailInput = {
    orgName: input.orgName,
    orgLogoUrl: input.orgLogoUrl,
    headline: input.headline,
    notes: input.notes,
    snapshot: input.snapshot,
    shareUrl: shareReportUrl(input.shareToken),
    recipientName: input.recipientName,
    senderName: input.senderName,
  };

  const { subject, html, text } = buildReportEmail(emailInput);
  const resend = getResend();

  if (!resend) {
    return {
      ok: false,
      skipped: "no_resend_key",
      previewHtml: html,
      previewSubject: subject,
    };
  }

  // Client reports are broadcast-category — they go to a list of
  // recipients on a recurring schedule, so they get the full RFC 8058
  // one-click unsubscribe header set. This is what allows Gmail to
  // render the visible "Unsubscribe" button in the inbox preview, which
  // is a STRONG positive deliverability signal (Gmail interprets it as
  // "this sender is bulk-mail compliant and respects unsubscribe").
  const refId = `client-report-${input.shareToken}`;
  const unsubMailbox =
    process.env.UNSUBSCRIBE_EMAIL?.trim() || "unsubscribe@leasestack.co";
  const unsubUrl = `${shareReportUrl(input.shareToken).replace(/\/r\/.+$/, "")}/unsub`;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<${unsubUrl}>, <mailto:${unsubMailbox}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "X-Entity-Ref-ID": refId,
  };

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject,
      html,
      text,
      replyTo: input.replyTo ?? BRAND_EMAIL,
      headers,
      tags: [
        { name: "template", value: `client-report-${input.snapshot.kind}` },
        { name: "category", value: "broadcast" },
      ],
    });

    if (error) {
      return { ok: false, error: error.message, previewHtml: html, previewSubject: subject };
    }

    return { ok: true, messageId: data?.id, previewSubject: subject };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, previewHtml: html, previewSubject: subject };
  }
}
