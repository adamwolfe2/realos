import "server-only";
import {
  sendBrandedEmail,
  buildBaseHtml,
  isValidEmail,
  APP_URL,
  BRAND_NAME,
  escapeHtml,
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
//
// Branding: routes through sendBrandedEmail + buildBaseHtml so this
// renders in the same header / footer / accent treatment as every
// other transactional email. Was a hand-rolled HTML shell before #26.
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

function buildBody(input: Input): string {
  const notesBlock = input.reviewNotes
    ? `<table cellpadding="0" cellspacing="0" style="margin-top:18px;border:1px solid #FCD34D;background:#FEF3C7;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:12px 14px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#92400E;">Notes from reviewer</p>
            <p style="margin:6px 0 0;font-size:13px;color:#1F2937;white-space:pre-wrap;">${escapeHtml(input.reviewNotes)}</p>
          </td>
        </tr>
      </table>`
    : "";

  return `<p style="margin:0;font-size:14px;color:#374151;line-height:1.55;">${escapeHtml(bodyText(input))}</p>${notesBlock}`;
}

export async function sendDraftReviewEmail(input: Input): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const result = { sent: 0, skipped: 0, errors: [] as string[] };

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
  const headline = headlineFor(input);
  const cta = ctaLabel(input);

  // One send per recipient so each gets a personal copy. Routed through
  // sendBrandedEmail so the org's effective brand (LeaseStack or
  // white-label) is applied to the header / footer.
  const sends = await Promise.allSettled(
    emails.map(async (email) => {
      const html = buildBaseHtml({
        headline,
        bodyHtml: buildBody(input),
        ctaText: cta,
        ctaUrl: draftUrl,
        preheader: bodyText(input),
        title: subject,
      });
      return sendBrandedEmail({
        to: email,
        subject,
        html,
        category: "transactional",
        template: "draft-review",
        orgId: input.orgId,
        tags: [{ name: "status", value: input.status.toLowerCase() }],
      });
    }),
  );

  for (const r of sends) {
    if (r.status === "fulfilled" && r.value.ok) {
      result.sent += 1;
    } else if (r.status === "fulfilled" && !r.value.ok) {
      result.errors.push(r.value.error);
    } else if (r.status === "rejected") {
      result.errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }
  return result;
}
