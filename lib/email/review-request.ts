import "server-only";
import { buildBaseHtml, getResend, isValidEmail, FROM_EMAIL } from "./shared";
import { buildUnsubUrl } from "./lead-sequences";

type SendResult = { ok: boolean; id?: string; error?: string };

export async function sendReviewRequestEmail({
  to,
  firstName,
  propertyName,
  googleReviewUrl,
  leadId,
}: {
  to: string;
  firstName: string | null;
  propertyName: string;
  googleReviewUrl: string;
  leadId?: string;
}): Promise<SendResult> {
  if (!isValidEmail(to)) return { ok: false, error: "Invalid recipient" };

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi there,";

  // Single-click opt-out paragraph appended to the body so recipients can
  // unsubscribe without replying. CAN-SPAM and most state laws expect this.
  const unsubLine = leadId
    ? `<p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">Don't want emails like this? <a href="${buildUnsubUrl(leadId)}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>.</p>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">${greeting}</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Hope you're settling in well at ${propertyName}! We'd love to hear about your experience.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
      Would you mind taking 60 seconds to leave us a Google review? It makes a huge difference for future residents.
    </p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#87867f;">
      Takes less than a minute. Thank you for being part of our community.
    </p>
    ${unsubLine}
  `;

  const html = buildBaseHtml({
    headline: `Quick favor from ${propertyName}`,
    bodyHtml,
    ctaText: "Leave a Review",
    ctaUrl: googleReviewUrl,
  });

  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };

  const unsubMailbox =
    process.env.UNSUBSCRIBE_EMAIL?.trim() || "unsubscribe@leasestack.co";
  try {
    const r = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Quick favor: Would you leave us a review?",
      html,
      headers: {
        "List-Unsubscribe": `<mailto:${unsubMailbox}>`,
        "X-Entity-Ref-ID": `review-request-${Date.now().toString(36)}`,
      },
      tags: [
        { name: "template", value: "review-request" },
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
