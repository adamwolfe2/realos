import { NextResponse } from "next/server";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { issueShareToken } from "@/lib/proposals/share-token";
import { renderProposalPdf } from "@/lib/proposals/pdf/render";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";

// gap-fix (audit 2026-06-02): @react-pdf/renderer requires the Node
// runtime — pin explicitly. Next 16 defaults to Node for API routes
// today but the default can flip with a config change; this lock is
// cheap insurance.
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/admin/proposals/[id]/resend
//
// Issues a fresh share token + re-sends the email. Allowed only when the
// proposal is SENT or VIEWED (not DRAFT — those use Send; not ACCEPTED).
//
// Rate-limit: max 5 resends per proposal per hour. Backed by a count over
// the existing ProposalShareToken rows so we don't need a separate table.
// ---------------------------------------------------------------------------

const MAX_RESENDS_PER_HOUR = 5;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await requireAgency();
  const { id } = await ctx.params;

  // Load the full proposal with lineItems so we can render the PDF
  // for the attachment. Selecting only id/status here would force a
  // second round-trip when the PDF render needs the full row.
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: { lineItems: true },
  });
  if (!proposal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    proposal.status !== ProposalStatus.SENT &&
    proposal.status !== ProposalStatus.VIEWED
  ) {
    return NextResponse.json(
      { error: `Cannot resend; proposal is ${proposal.status}` },
      { status: 409 },
    );
  }
  if (!proposal.prospectEmail) {
    return NextResponse.json(
      { error: "Prospect email missing" },
      { status: 422 },
    );
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentTokens = await prisma.proposalShareToken.count({
    where: { proposalId: id, createdAt: { gte: oneHourAgo } },
  });
  if (recentTokens >= MAX_RESENDS_PER_HOUR) {
    return NextResponse.json(
      { error: "Resend rate limit reached. Try again in an hour." },
      { status: 429 },
    );
  }

  const token = await issueShareToken(id);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://leasestack.co";
  const shareUrl = `${baseUrl.replace(/\/+$/, "")}/proposal/${token}`;

  // gap-fix (audit 2026-06-02): render PDF for the resend attachment
  // too — same UX as the initial Send. Best-effort: an attachment
  // failure still ships the email so the prospect at least gets the
  // link, but log so an operator can see why the attachment dropped.
  let pdfBuffer: Buffer | undefined;
  try {
    pdfBuffer = await renderProposalPdf({
      proposal,
      totals: computeProposalTotalsFromRow(proposal),
    });
  } catch (err) {
    console.error("[resend] pdf render failed (sending without attachment):", err);
  }

  try {
    const mod = await import("@/lib/proposals/email");
    if (typeof mod.sendProposalEmail === "function") {
      await mod.sendProposalEmail({ proposalId: id, shareUrl, pdfBuffer });
    }
  } catch (err) {
    console.error("[resend] email send failed:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, shareUrl });
}
