import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";
import { BRAND, BRAND_EMAIL, BRAND_NAME } from "@/lib/brand";
import { ViewPing } from "./_components/view-ping";
import { AcceptButton } from "./_components/accept-button";
import { LineSection, SummaryRow } from "./_components/line-section";
import {
  cadenceLabel,
  cadenceWord,
  formatCents,
  formatDate,
} from "./_lib/format";

// ---------------------------------------------------------------------------
// Public proposal share page.
//
// Resolution rules (single null check, no oracle):
//   - resolveLiveShareToken returns null → /proposal/expired
//   - status === ACCEPTED                 → /proposal/[token]/success
//   - status === VOIDED/EXPIRED/CANCELED  → /proposal/expired
//   - status === DRAFT                    → /proposal/expired (not yet sent)
//   - status === SENT or VIEWED           → render
//
// Anti-enumeration: the redirect target is the same friendly /expired
// page for not-found / revoked-token / draft / voided / canceled / expired.
// The status-pill near the proposal number only ever shows SENT or
// VIEWED-equivalent context — anything else is redirected before render.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Proposal · ${BRAND_NAME}`,
  description: `Review and accept your ${BRAND_NAME} proposal.`,
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ProposalSharePage({ params }: PageProps) {
  const { token } = await params;

  const resolved = await resolveLiveShareToken(token);
  if (!resolved) {
    // Revoked tokens whose original proposal was ACCEPTED get a friendlier
    // landing on the success page so a prospect bookmarking the link
    // post-payment still lands somewhere helpful. One extra read is fine.
    const acceptedSibling = await prisma.proposalShareToken
      .findUnique({
        where: { token },
        select: {
          proposal: { select: { status: true } },
        },
      })
      .catch(() => null);
    if (
      acceptedSibling?.proposal?.status === ProposalStatus.ACCEPTED
    ) {
      redirect(`/proposal/${encodeURIComponent(token)}/success`);
    }
    redirect("/proposal/expired");
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: resolved.proposalId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!proposal) {
    redirect("/proposal/expired");
  }

  if (proposal.status === ProposalStatus.ACCEPTED) {
    redirect(`/proposal/${encodeURIComponent(token)}/success`);
  }
  if (
    proposal.status !== ProposalStatus.SENT &&
    proposal.status !== ProposalStatus.VIEWED
  ) {
    redirect("/proposal/expired");
  }

  const totals = computeProposalTotalsFromRow(proposal);
  const recurringLines = proposal.lineItems.filter((l) => l.recurring);
  const oneTimeLines = proposal.lineItems.filter((l) => !l.recurring);
  const currency = proposal.currency || "usd";
  const cadence = totals.cadence;
  const askQuestionHref = `mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(
    `Question about ${proposal.number}`,
  )}`;
  const declineHref = `mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(
    `Declining ${proposal.number}`,
  )}`;
  const pdfHref = `/proposal/${encodeURIComponent(token)}/pdf`;

  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <ViewPing token={token} />
      {/* Header */}
      <header className="border-b border-[#EAECEF]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 sm:py-6">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
              {BRAND_NAME}
            </span>
            <span className="hidden text-xs text-[#6B7280] sm:inline">
              Proposal
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#6B7280]">
            <span className="font-mono tabular-nums">{proposal.number}</span>
            <a
              href={pdfHref}
              className="hidden text-[#2563EB] hover:underline sm:inline"
              rel="noopener"
            >
              Download PDF
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
        {/* Status pill */}
        <div className="mb-6 flex items-center gap-2 text-xs text-[#6B7280]">
          <span
            className={`inline-flex items-center rounded-full border border-[#EAECEF] bg-[#F9FAFB] px-2.5 py-0.5 font-medium text-[#374151]`}
          >
            {proposal.status === ProposalStatus.SENT ? "New" : "Reviewed"}
          </span>
          {proposal.sentAt ? (
            <span>Sent {formatDate(proposal.sentAt)}</span>
          ) : null}
          {proposal.expiresAt ? (
            <span>· Expires {formatDate(proposal.expiresAt)}</span>
          ) : null}
        </div>

        {/* Greeting */}
        <section className="mb-10">
          <p className="text-sm font-medium uppercase tracking-wider text-[#6B7280]">
            Prepared for
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
            {proposal.prospectCompany || proposal.prospectName}
          </h1>
          {proposal.prospectCompany ? (
            <p className="mt-1 text-sm text-[#6B7280]">
              Attn: {proposal.prospectName}
            </p>
          ) : null}
        </section>

        {/* Public message */}
        {proposal.publicMessage ? (
          <section className="mb-10 rounded-lg border border-[#EAECEF] bg-[#F9FAFB] p-5 text-[15px] leading-relaxed text-[#374151]">
            <p className="whitespace-pre-line">{proposal.publicMessage}</p>
          </section>
        ) : null}

        {/* Body grid: lines + totals */}
        <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:gap-12">
          {/* Lines */}
          <div className="space-y-10">
            {recurringLines.length > 0 ? (
              <LineSection
                title={`Recurring · ${cadenceWord(cadence)}`}
                lines={recurringLines}
                currency={currency}
                cadence={cadence}
              />
            ) : null}
            {oneTimeLines.length > 0 ? (
              <LineSection
                title="One-time"
                lines={oneTimeLines}
                currency={currency}
                cadence={null}
              />
            ) : null}
          </div>

          {/* Totals card */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-xl border border-[#EAECEF] bg-white p-6 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Summary
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {totals.recurringSubtotal > 0 ? (
                  <SummaryRow
                    label={`Recurring ${cadenceWord(cadence)}`}
                    value={`${formatCents(
                      totals.recurringTotal,
                      currency,
                    )}${cadenceLabel(cadence)}`}
                  />
                ) : null}
                {totals.oneTimeSubtotal > 0 ? (
                  <SummaryRow
                    label="One-time"
                    value={formatCents(totals.oneTimeTotal, currency)}
                  />
                ) : null}
                {totals.recurringDiscount + totals.oneTimeDiscount > 0 ? (
                  <SummaryRow
                    label={
                      proposal.discountReason
                        ? `Discount · ${proposal.discountReason}`
                        : "Discount"
                    }
                    value={`−${formatCents(
                      totals.recurringDiscount + totals.oneTimeDiscount,
                      currency,
                    )}`}
                    muted
                  />
                ) : null}
                {totals.hasTrial ? (
                  <SummaryRow
                    label="Free trial"
                    value={`${totals.trialDays} days`}
                    muted
                  />
                ) : null}
              </dl>

              <div className="mt-5 border-t border-[#EAECEF] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                    Due today
                  </span>
                  <span className="text-xl font-semibold tabular-nums text-[#0F172A]">
                    {formatCents(totals.firstInvoiceTotal, currency)}
                  </span>
                </div>
                {totals.hasTrial && totals.recurringTotal > 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-[#6B7280]">
                    Your {totals.trialDays}-day trial starts at acceptance.
                    Your card will be charged{" "}
                    {formatCents(totals.recurringTotal, currency)}
                    {cadenceLabel(cadence)} when the trial ends. Cancel
                    anytime before then and you won&apos;t be billed.
                  </p>
                ) : null}
              </div>

              <div className="mt-6 space-y-3">
                <AcceptButton token={token} agencyEmail={BRAND_EMAIL} />
                <div className="flex items-center justify-between text-xs text-[#6B7280]">
                  <a
                    href={askQuestionHref}
                    className="hover:text-[#2563EB] hover:underline"
                  >
                    Ask a question
                  </a>
                  <a
                    href={declineHref}
                    className="hover:text-[#2563EB] hover:underline"
                  >
                    Decline
                  </a>
                </div>
              </div>
            </div>
            <p className="mt-3 px-1 text-center text-[11px] text-[#6B7280] sm:hidden">
              <a href={pdfHref} className="hover:underline" rel="noopener">
                Download PDF
              </a>
            </p>
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-[#EAECEF] pt-6 text-xs text-[#6B7280]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Questions?{" "}
              <a
                href={`mailto:${BRAND_EMAIL}`}
                className="text-[#2563EB] hover:underline"
              >
                {BRAND_EMAIL}
              </a>
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/privacy"
                className="hover:text-[#2563EB] hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-[#2563EB] hover:underline"
              >
                Terms
              </Link>
              <a
                href={BRAND.url}
                className="hover:text-[#2563EB] hover:underline"
                rel="noopener"
              >
                {BRAND_NAME}
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

