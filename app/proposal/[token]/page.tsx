import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";
import { normalizeTimeline } from "@/lib/proposals/types";
import { BRAND, BRAND_EMAIL, BRAND_NAME } from "@/lib/brand";
import { ViewPing } from "./_components/view-ping";
import { AcceptButton } from "./_components/accept-button";
import { LineSection, SummaryRow } from "./_components/line-section";
import {
  BriefShellHeader,
  BriefShellFooter,
} from "@/components/audit/brief-shell";
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
  const timeline = normalizeTimeline(proposal.timeline);
  const askQuestionHref = `mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(
    `Question about ${proposal.number}`,
  )}`;
  const declineHref = `mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(
    `Declining ${proposal.number}`,
  )}`;
  const pdfHref = `/proposal/${encodeURIComponent(token)}/pdf`;

  const subjectName =
    proposal.prospectCompany || proposal.prospectName || "Prospect";
  const generatedAtIso = (proposal.sentAt ?? proposal.createdAt).toISOString();
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <ViewPing token={token} />
      {/* Shared LeaseStack-branded header — same shell the /brief and
          /audit routes use so prospects see the same visual identity
          across every artifact we send them. */}
      <BriefShellHeader
        subjectName={subjectName}
        generatedAtIso={generatedAtIso}
        label="Proposal"
      />
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 pt-5 text-xs text-[#6B7280]">
        <span className="font-mono tabular-nums">{proposal.number}</span>
        <a
          href={pdfHref}
          className="text-[#2563EB] hover:underline"
          rel="noopener"
        >
          Download PDF
        </a>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6 sm:py-10">
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

        {/* Scope of work */}
        {proposal.scopeNarrative ? (
          <section className="mb-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B7280] mb-3">
              Scope of work
            </h2>
            <div className="prose prose-sm max-w-none text-[#1F2937] leading-relaxed whitespace-pre-line text-[15px]">
              {proposal.scopeNarrative}
            </div>
          </section>
        ) : null}

        {/* Delivery timeline */}
        {timeline.length > 0 ? (
          <section className="mb-10">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6B7280] mb-3">
              Delivery timeline
            </h2>
            <ol className="border border-[#EAECEF] rounded-lg overflow-hidden bg-white">
              {timeline.map((p, idx) => (
                <li
                  key={idx}
                  className="grid grid-cols-12 gap-4 p-4 border-b border-[#EAECEF] last:border-b-0"
                >
                  <div className="col-span-12 md:col-span-3">
                    <div className="font-semibold text-[15px] text-[#111827]">
                      {p.phase}
                    </div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5 tabular-nums">
                      {p.startWeek === p.endWeek
                        ? `Week ${p.startWeek}`
                        : `Week ${p.startWeek}–${p.endWeek}`}
                    </div>
                  </div>
                  <div className="col-span-12 md:col-span-9">
                    {p.deliverables.length === 0 ? (
                      <span className="text-[13px] text-[#9CA3AF]">—</span>
                    ) : (
                      <ul className="space-y-1 text-[14px] text-[#374151] leading-relaxed">
                        {p.deliverables.map((d, dIdx) => (
                          <li key={dIdx} className="flex gap-2">
                            <span className="text-[#9CA3AF] shrink-0">•</span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[11.5px] text-[#9CA3AF]">
              Weeks count from the day this proposal is signed and paid.
            </p>
          </section>
        ) : null}

        {/* Lines — single full-width column. Adam 2026-06-03: the
            previous two-column grid (lines left, sticky summary right)
            wasted horizontal real estate and pinned the Accept button
            to a small floating card. Promoting lines to full width and
            dropping the summary to a payment band below the items reads
            cleaner end-to-end + matches the brief / audit page rhythm. */}
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

        {/* Payment band — full-width totals + Accept button anchored at
            the bottom of the proposal body. Two-column inside: summary
            list on the left, "Due today" big number + button on the
            right. Sticky-on-the-right card is gone. */}
        <section
          className="mt-12 rounded-2xl border border-[#EAECEF] bg-white p-6 sm:p-8 shadow-sm"
          aria-label="Accept and pay"
        >
          <div className="grid gap-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Summary
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
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
              {totals.hasTrial && totals.recurringTotal > 0 ? (
                <p className="mt-4 max-w-md text-xs leading-relaxed text-[#6B7280]">
                  Your {totals.trialDays}-day trial starts at acceptance.
                  Your card will be charged{" "}
                  {formatCents(totals.recurringTotal, currency)}
                  {cadenceLabel(cadence)} when the trial ends. Cancel
                  anytime before then and you won&apos;t be billed.
                </p>
              ) : null}
            </div>

            <div className="sm:text-right">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Due today
              </span>
              <span className="mt-1 block text-3xl font-semibold tabular-nums text-[#0F172A]">
                {formatCents(totals.firstInvoiceTotal, currency)}
              </span>
              <div className="mt-5 sm:max-w-[280px] sm:ml-auto space-y-3">
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
          </div>
        </section>

        {/* Contact line — kept above the shared shell footer for the
            "Questions / Privacy / Terms" affordances. */}
        <div className="mt-12 border-t border-[#EAECEF] pt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7280]">
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
      </div>

      {/* Shared shell footer — same on every prospect artifact (brief,
          audit, proposal). Adds the canonical wordmark + traceability. */}
      <BriefShellFooter
        reportId={proposal.number}
        generatedAtIso={generatedAtIso}
        liveApiCalls={0}
      />
    </main>
  );
}

