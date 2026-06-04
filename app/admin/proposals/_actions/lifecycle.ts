"use server";

import { revalidatePath } from "next/cache";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAgency } from "@/lib/tenancy/scope";
import { generateProposalNumber } from "@/lib/proposals/numbering";
import {
  issueShareToken,
  revokeShareTokens,
} from "@/lib/proposals/share-token";

// ---------------------------------------------------------------------------
// Lifecycle actions: send / void / duplicate. Each calls requireAgency() and
// enforces status gates internally — never trust the UI to gate alone.
// ---------------------------------------------------------------------------

function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    "https://leasestack.co";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

export async function sendProposal(args: {
  proposalId: string;
}): Promise<{ shareUrl: string; emailed: boolean }> {
  await requireAgency();
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    include: { lineItems: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== ProposalStatus.DRAFT) {
    throw new Error(
      `Cannot send proposal in status ${proposal.status}; use Duplicate to revise`,
    );
  }
  if (proposal.lineItems.length === 0) {
    throw new Error("Add at least one line item before sending");
  }
  // prospectEmail is OPTIONAL as of 2026-06-03. When set, we send the
  // proposal email + bind a Stripe Customer to it on checkout. When
  // empty, we still mint a share token + flip to SENT — the proposal
  // becomes a "publish + share the link" artifact, Stripe collects
  // email at checkout time. Adam asked for the Stripe-Payment-Link
  // pattern for proposals.

  // review-fix: atomic token issue + status flip. Previously these were 3
  // independent writes — issue token, send email, then flip status — and
  // a failure between (1) and (3) would leave a live share token pointing
  // at a DRAFT proposal (the public route rejects DRAFTs, so the prospect
  // would see /proposal/expired with NO email arriving). Both writes
  // happen inside the same transaction; email is sent AFTER commit so a
  // transient Resend error doesn't roll back the status transition.
  const token = await prisma.$transaction(async (tx) => {
    const issued = await issueShareToken(args.proposalId, { tx });
    await tx.proposal.update({
      where: { id: args.proposalId },
      data: { status: ProposalStatus.SENT, sentAt: new Date() },
    });
    return issued;
  });

  const shareUrl = `${resolveBaseUrl().replace(/\/+$/, "")}/proposal/${token}`;

  // gap-fix (audit 2026-06-02): render the PDF here so it lands in the
  // outbound email as an attachment. Previously we sent { proposalId,
  // shareUrl } and the email helper, lacking a buffer, shipped without
  // an attachment — exactly the headline failure Adam called out
  // ("send to client with proposal PDF and everything laid out").
  //
  // Best-effort: a PDF render failure logs + Sentry but DOES NOT block
  // the email send — prospect still gets a link, agency operator can
  // resend with attachment later. Best-effort: rendering is wrapped so
  // a prisma row not found / @react-pdf font load failure doesn't
  // unwind the status transition.
  let pdfBuffer: Buffer | undefined;
  try {
    const [pdfMod, totalsMod] = await Promise.all([
      import("@/lib/proposals/pdf/render"),
      import("@/lib/proposals/totals"),
    ]);
    if (typeof pdfMod.renderProposalPdf === "function") {
      pdfBuffer = await pdfMod.renderProposalPdf({
        proposal,
        totals: totalsMod.computeProposalTotalsFromRow(proposal),
      });
    }
  } catch (err) {
    console.error("[sendProposal] pdf render failed (sending without attachment):", err);
  }

  // Email send is best-effort POST-commit. A throw here is logged but
  // does not undo the SENT transition — the operator hits Resend from
  // the detail page. Skipped entirely when prospectEmail is empty
  // (the "share-link only" flow).
  let emailed = false;
  if (proposal.prospectEmail) {
    try {
      const mod = await import("@/lib/proposals/email");
      if (typeof mod.sendProposalEmail === "function") {
        await mod.sendProposalEmail({
          proposalId: args.proposalId,
          shareUrl,
          pdfBuffer,
        });
        emailed = true;
      }
    } catch (err) {
      console.error("[sendProposal] email send failed (status already SENT):", err);
    }
  }

  revalidatePath(`/admin/proposals/${args.proposalId}`);
  revalidatePath("/admin/proposals");
  return { shareUrl, emailed };
}

export async function voidProposal(args: {
  proposalId: string;
  reason: string;
}): Promise<{ ok: true }> {
  await requireAgency();
  const proposal = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    select: { status: true },
  });
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status === ProposalStatus.ACCEPTED) {
    throw new Error("Cannot void an accepted proposal");
  }
  await prisma.proposal.update({
    where: { id: args.proposalId },
    data: {
      status: ProposalStatus.CANCELED,
      voidedAt: new Date(),
      voidReason: args.reason || "voided by agency",
      canceledAt: new Date(),
    },
  });
  await revokeShareTokens(args.proposalId);
  revalidatePath(`/admin/proposals/${args.proposalId}`);
  revalidatePath("/admin/proposals");
  return { ok: true };
}

export async function duplicateProposal(args: {
  proposalId: string;
}): Promise<{ newProposalId: string }> {
  const scope = await requireAgency();
  const source = await prisma.proposal.findUnique({
    where: { id: args.proposalId },
    include: { lineItems: true },
  });
  if (!source) throw new Error("Proposal not found");

  for (let attempt = 0; attempt < 2; attempt++) {
    const number = await generateProposalNumber();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const cloned = await tx.proposal.create({
          data: {
            number,
            status: ProposalStatus.DRAFT,
            prospectName: source.prospectName,
            prospectEmail: source.prospectEmail,
            prospectCompany: source.prospectCompany,
            prospectOrgId: source.prospectOrgId,
            intakeId: source.intakeId,
            cadence: source.cadence,
            trialDays: source.trialDays,
            currency: source.currency,
            discountAmountCents: source.discountAmountCents,
            discountReason: source.discountReason,
            discountScope: source.discountScope,
            publicMessage: source.publicMessage,
            internalNotes: source.internalNotes,
            createdById: scope.userId,
          },
          select: { id: true },
        });
        if (source.lineItems.length > 0) {
          await tx.proposalLineItem.createMany({
            data: source.lineItems.map((l) => ({
              proposalId: cloned.id,
              kind: l.kind,
              catalogItemId: l.catalogItemId,
              label: l.label,
              description: l.description,
              unitPriceCents: l.unitPriceCents,
              quantity: l.quantity,
              recurring: l.recurring,
              sortOrder: l.sortOrder,
            })),
          });
        }
        await tx.proposal.update({
          where: { id: cloned.id },
          data: {
            recurringSubtotalCents: source.recurringSubtotalCents,
            oneTimeSubtotalCents: source.oneTimeSubtotalCents,
          },
        });
        return cloned;
      });
      revalidatePath("/admin/proposals");
      return { newProposalId: created.id };
    } catch (err) {
      const isUnique =
        err != null &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2002";
      if (!isUnique) throw err;
    }
  }
  throw new Error("Failed to clone proposal after retry");
}
