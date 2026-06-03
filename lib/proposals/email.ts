import "server-only";
import { prisma } from "@/lib/db";
import {
  buildBaseHtml,
  escapeHtml,
  getResend,
  isValidEmail,
  sanitizeSubject,
  FROM_EMAIL,
  BRAND_EMAIL,
} from "@/lib/email/shared";
import { computeProposalTotalsFromRow } from "./totals";

// ---------------------------------------------------------------------------
// Proposal email sender.
//
// One transactional touchpoint: when an operator clicks "Send" on a finalized
// proposal we email the prospect with the rendered PDF as an attachment and
// a CTA to the public share URL where they can review + click through to
// Stripe Checkout.
//
// Design rules:
//   - Sender: LeaseStack default From (DKIM/DMARC aligned).
//   - Subject: "Your proposal from LeaseStack — Proposal #${number}".
//   - Body: TL;DR pricing summary (recurring/mo + one-time + trial) then a
//     primary "Open proposal" button and a secondary "Download PDF" link.
//     The "Download PDF" link points at the share URL with `?download=pdf`
//     because some prospects will read on a phone where the attachment is
//     awkward to open.
//   - PDF: attached as `LeaseStack-Proposal-<number>.pdf`. Resend accepts
//     attachments as `{ filename, content }` where content is a Buffer.
//   - Light branding only: wordmark in the buildBaseHtml header, otherwise
//     corporate-minimal. We don't pass `orgId` because proposals are pre-
//     org — there's no white-label brand to apply yet.
//   - Best-effort audit: every successful send records sentAt + a Resend
//     message ID on the proposal so the admin UI can show "Sent ___ ago"
//     without an external lookup.
// ---------------------------------------------------------------------------

export type SendProposalEmailArgs = {
  proposalId: string;
  shareUrl: string;
  /**
   * Optional rendered PDF. When provided we attach it as
   * LeaseStack-Proposal-<number>.pdf. When omitted the email still ships
   * — the prospect can download from the share page. Making this optional
   * lets the UI/actions agents call us before the PDF agent finalizes
   * caching; once the PDF is ready they re-fetch + re-send with the
   * buffer attached.
   */
  pdfBuffer?: Buffer;
};

export type SendProposalEmailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

function formatCents(cents: number): string {
  const dollars = Math.round(cents) / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function cadenceLabel(cadence: "MONTHLY" | "ANNUAL" | null): string {
  if (cadence === "ANNUAL") return "/yr";
  if (cadence === "MONTHLY") return "/mo";
  return "";
}

/**
 * Send the proposal email to the prospect. Returns `{ ok }` rather than
 * throwing so the calling action can decide whether to mark the proposal
 * SENT regardless of the deliverability outcome. (Per the spec: a failing
 * email send should still mark the proposal as sent so the operator can
 * see the failure and retry — losing the SENT flag would hide the bug.)
 */
export async function sendProposalEmail(
  args: SendProposalEmailArgs,
): Promise<SendProposalEmailResult> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    include: { lineItems: true },
  });
  if (!proposal) {
    return { ok: false, error: `Proposal ${args.proposalId} not found` };
  }
  if (!isValidEmail(proposal.prospectEmail)) {
    return {
      ok: false,
      error: `Proposal ${proposal.number} has an invalid prospect email`,
    };
  }

  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Resend not configured" };
  }

  const totals = computeProposalTotalsFromRow(proposal);
  const prospectFirstName =
    proposal.prospectName.trim().split(/\s+/)[0] ?? proposal.prospectName;

  // ── Build the TL;DR ────────────────────────────────────────────────
  const recurringLine =
    totals.recurringTotal > 0
      ? `<strong>${escapeHtml(formatCents(totals.recurringTotal))}${escapeHtml(cadenceLabel(totals.cadence))}</strong> recurring`
      : null;
  const oneTimeLine =
    totals.oneTimeTotal > 0
      ? `<strong>${escapeHtml(formatCents(totals.oneTimeTotal))}</strong> one-time`
      : null;
  const trialLine = totals.hasTrial
    ? `<strong>${totals.trialDays}-day trial</strong> — first invoice runs after the trial`
    : null;

  const tldrItems = [recurringLine, oneTimeLine, trialLine].filter(
    (x): x is string => x != null,
  );

  const tldrHtml =
    tldrItems.length > 0
      ? `<ul style="margin:0 0 12px;padding:0 0 0 18px;font-size:14px;line-height:1.7;color:#1E2A3A;">
          ${tldrItems.map((i) => `<li>${i}</li>`).join("")}
        </ul>`
      : "";

  const publicMessageHtml = proposal.publicMessage
    ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#1E2A3A;">${escapeHtml(proposal.publicMessage)}</p>`
    : "";

  const downloadUrl = `${args.shareUrl}${args.shareUrl.includes("?") ? "&" : "?"}download=pdf`;

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Hi ${escapeHtml(prospectFirstName)},
    </p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Your LeaseStack proposal is ready. Quick summary:
    </p>
    ${tldrHtml}
    ${publicMessageHtml}
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Open the proposal to review the full line-item breakdown and accept securely with Stripe.
      A PDF copy is attached for your records, or
      <a href="${escapeHtml(downloadUrl)}" style="color:#2563EB;text-decoration:underline;">download it here</a>.
    </p>
    <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#1E2A3A;">
      Reply to this email any time with questions — happy to walk through it.
    </p>
  `;

  const html = buildBaseHtml({
    headline: `Proposal #${proposal.number}`,
    bodyHtml,
    ctaText: "Open proposal",
    ctaUrl: args.shareUrl,
    preheader:
      tldrItems.length > 0
        ? `Your LeaseStack proposal — ${tldrItems
            .map((s) => s.replace(/<[^>]+>/g, ""))
            .join(" · ")}`
        : `Your LeaseStack proposal #${proposal.number}`,
    title: `Proposal #${proposal.number} from LeaseStack`,
  });

  // Plain-text fallback — every transactional email needs one for spam
  // scorers and accessibility tooling.
  const text = [
    `Hi ${prospectFirstName},`,
    "",
    "Your LeaseStack proposal is ready.",
    "",
    ...tldrItems.map((s) => `- ${s.replace(/<[^>]+>/g, "")}`),
    ...(proposal.publicMessage ? ["", proposal.publicMessage] : []),
    "",
    `Open the proposal: ${args.shareUrl}`,
    `Download PDF: ${downloadUrl}`,
    "",
    "Reply to this email any time with questions.",
    "",
    "LeaseStack",
  ].join("\n");

  const subject = sanitizeSubject(
    `Your proposal from LeaseStack — Proposal #${proposal.number}`,
  );

  const filename = `LeaseStack-Proposal-${proposal.number}.pdf`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: proposal.prospectEmail,
      subject,
      html,
      text,
      replyTo: BRAND_EMAIL,
      headers: {
        "X-Entity-Ref-ID": `proposal-${proposal.id}-${proposal.checkoutVersion}`,
      },
      tags: [
        { name: "template", value: "proposal-send" },
        { name: "category", value: "transactional" },
        { name: "proposalId", value: proposal.id },
      ],
      ...(args.pdfBuffer
        ? {
            attachments: [
              {
                filename,
                content: args.pdfBuffer,
              },
            ],
          }
        : {}),
    });

    if (result.error) {
      return {
        ok: false,
        error: result.error.message ?? "Resend rejected the send",
      };
    }

    const messageId = result.data?.id;

    // review-fix: status + sentAt mutation removed. The action layer
    // (`_actions/lifecycle.sendProposal`) is the single owner of the
    // DRAFT→SENT transition + `sentAt` stamp, and it does so inside a
    // transaction alongside `issueShareToken`. The email helper used to
    // race-write both fields here, which clobbered the action's later
    // timestamp and silently transitioned VIEWED→VIEWED on resend.
    return { ok: true, messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
