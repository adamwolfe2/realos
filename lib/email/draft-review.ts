import "server-only";
import {
  getResend,
  isValidEmail,
  FROM_EMAIL,
  APP_URL,
  BRAND_NAME,
} from "@/lib/email/shared";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Real-time email on content draft review. Sent when admin
// approves / requests changes / rejects / ships an operator's draft so
// the operator doesn't need to be in the portal to find out.
//
// Sends one email per org member (each gets their personal copy).
// Fire-and-forget from the admin review routes — failure shouldn't
// block the API response. Idempotent in the sense that re-running
// would send duplicates (not deduped); callers should call exactly
// once per status transition.
// ---------------------------------------------------------------------------

type ReviewStatus = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED" | "SHIPPED";

type Input = {
  orgId: string;
  draftId: string;
  status: ReviewStatus;
  format: string;
  propertyName: string | null;
  reviewNotes: string | null;
};

function e(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function subjectFor(input: Input): string {
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const prop = input.propertyName ? ` for ${input.propertyName}` : "";
  switch (input.status) {
    case "APPROVED":
      return `Approved: ${fmt}${prop}`;
    case "SHIPPED":
      return `Shipped: ${fmt}${prop}`;
    case "CHANGES_REQUESTED":
      return `Changes requested on ${fmt}${prop}`;
    case "REJECTED":
      return `Rejected: ${fmt}${prop}`;
  }
}

function headlineFor(input: Input): string {
  switch (input.status) {
    case "APPROVED":
      return "Your draft is approved";
    case "SHIPPED":
      return "Your draft is live";
    case "CHANGES_REQUESTED":
      return "We need a small change";
    case "REJECTED":
      return "Draft rejected";
  }
}

function ctaLabel(input: Input): string {
  if (input.status === "CHANGES_REQUESTED") return "Review notes + re-submit";
  return "View the final draft";
}

function bodyText(input: Input): string {
  const fmt = input.format.replace(/_/g, " ").toLowerCase();
  const prop = input.propertyName ? ` for ${input.propertyName}` : "";
  switch (input.status) {
    case "APPROVED":
      return `Your ${fmt}${prop} is approved. ${BRAND_NAME} is preparing to ship it to your site.`;
    case "SHIPPED":
      return `Your ${fmt}${prop} is now live. Open the draft to see the final content.`;
    case "CHANGES_REQUESTED":
      return `Our reviewer left specific notes on your ${fmt}${prop}. Open the draft to read them and re-submit.`;
    case "REJECTED":
      return `We couldn't move forward with this ${fmt}${prop}. The notes inside explain why.`;
  }
}

function buildHtml(input: Input, draftUrl: string): string {
  const headline = headlineFor(input);
  const body = bodyText(input);
  const notesBlock = input.reviewNotes
    ? `<table cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid #FCD34D;background:#FEF3C7;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400E;">Notes from reviewer</p>
            <p style="margin:6px 0 0;font-size:13px;color:#1F2937;white-space:pre-wrap;">${e(input.reviewNotes)}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${e(subjectFor(input))}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="background:#2563EB;padding:24px 32px;">
              <p style="margin:0;color:#FFFFFF;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">${e(BRAND_NAME)}</p>
              <p style="margin:8px 0 0;color:#BFDBFE;font-size:13px;">Content draft review</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#111111;">${e(headline)}</h1>
              <p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.55;">${e(body)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              ${notesBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px;">
              <a href="${e(draftUrl)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:4px;letter-spacing:0.04em;">${e(ctaLabel(input))}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #E5E7EB;background:#F9FAFB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                Powered by <a href="https://leasestack.co" style="color:#94A3B8;text-decoration:none;">${e(BRAND_NAME)}</a>
                &nbsp;&middot;&nbsp;
                <a href="${e(APP_URL)}/portal/settings/notifications" style="color:#94A3B8;text-decoration:none;">Notification settings</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendDraftReviewEmail(input: Input): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] };

  const resend = getResend();
  if (!resend) {
    result.errors.push("RESEND_API_KEY not configured");
    return result;
  }

  const members = await prisma.user
    .findMany({
      where: { orgId: input.orgId },
      select: { email: true },
    })
    .catch(() => [] as Array<{ email: string }>);

  const emails = members.map((m) => m.email).filter(isValidEmail);
  if (emails.length === 0) {
    result.skipped += 1;
    return result;
  }

  const draftUrl = `${APP_URL}/portal/seo/agent/drafts/${input.draftId}`;
  const subject = subjectFor(input);
  const html = buildHtml(input, draftUrl);

  // One send per recipient so each gets a personal copy. Transactional —
  // no marketing unsubscribe header set (only operational + product).
  const results = await Promise.allSettled(
    emails.map((email) =>
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
        tags: [
          { name: "template", value: "draft-review" },
          { name: "status", value: input.status.toLowerCase() },
          { name: "category", value: "transactional" },
        ],
      }),
    ),
  );

  for (const r of results) {
    if (r.status === "fulfilled" && !r.value.error) {
      result.sent += 1;
    } else if (r.status === "fulfilled" && r.value.error) {
      result.errors.push(r.value.error.message);
    } else if (r.status === "rejected") {
      result.errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }
  return result;
}
