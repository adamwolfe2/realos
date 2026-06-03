import type { Metadata } from "next";
import Link from "next/link";
import { ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveLiveShareToken } from "@/lib/proposals/share-token";
import { computeProposalTotalsFromRow } from "@/lib/proposals/totals";
import { BRAND, BRAND_EMAIL, BRAND_NAME } from "@/lib/brand";
import {
  cadenceLabel,
  cadenceWord,
  formatCents,
  formatDate,
} from "../_lib/format";

// ---------------------------------------------------------------------------
// /proposal/[token]/success
//
// Lands here after Stripe Checkout completes. Two states:
//   - status === ACCEPTED → render the receipt-style recap
//   - any other valid status → render a "Finalizing your account" pending
//     state (webhook hasn't fired yet, or sub-mode session completed
//     pre-invoice-paid). The page does NOT auto-refresh in v1 — the
//     prospect will get an email once provisioning finishes.
//
// Anti-enumeration: the share-token resolver returns null for not-found /
// revoked / expired. We also resolve revoked tokens whose underlying
// proposal is ACCEPTED here (the prospect bookmarked the link post-payment
// and the agency revoked the token), so this page shows the recap even
// after revocation.
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: `Payment received · ${BRAND_NAME}`,
  description: `Your ${BRAND_NAME} proposal has been accepted.`,
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

async function resolveProposalIdForSuccess(
  token: string,
): Promise<string | null> {
  const live = await resolveLiveShareToken(token);
  if (live) return live.proposalId;

  // Allow revoked tokens through to the success page IFF the underlying
  // proposal is ACCEPTED. Bookmark-after-payment shouldn't 404.
  const row = await prisma.proposalShareToken
    .findUnique({
      where: { token },
      select: {
        proposalId: true,
        proposal: { select: { status: true } },
      },
    })
    .catch(() => null);
  if (row?.proposal?.status === ProposalStatus.ACCEPTED) {
    return row.proposalId;
  }
  return null;
}

export default async function ProposalSuccessPage({ params }: PageProps) {
  const { token } = await params;
  const proposalId = await resolveProposalIdForSuccess(token);

  if (!proposalId) {
    return <ExpiredFallback />;
  }

  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: {
      lineItems: { orderBy: { sortOrder: "asc" } },
      acceptance: true,
    },
  });
  if (!proposal) {
    return <ExpiredFallback />;
  }

  if (proposal.status !== ProposalStatus.ACCEPTED) {
    return <PendingState proposalNumber={proposal.number} />;
  }

  const totals = computeProposalTotalsFromRow(proposal);
  const currency = proposal.currency || "usd";
  const cadence = totals.cadence;
  const amountPaid =
    proposal.acceptance?.amountPaidCents ?? totals.firstInvoiceTotal;
  const acceptedAt = proposal.acceptedAt ?? proposal.acceptance?.acceptedAt;
  const nextBillingDate =
    totals.hasTrial && acceptedAt
      ? new Date(
          acceptedAt.getTime() + totals.trialDays * 24 * 60 * 60 * 1000,
        )
      : null;

  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <header className="border-b border-[#EAECEF]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 sm:py-6">
          <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
            {BRAND_NAME}
          </span>
          <span className="font-mono text-xs tabular-nums text-[#6B7280]">
            {proposal.number}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <section className="mb-10">
          <p className="text-sm font-medium uppercase tracking-wider text-[#2563EB]">
            Payment received
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            Welcome aboard.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#374151]">
            Thanks, {proposal.prospectName.split(" ")[0]}. Your{" "}
            {BRAND_NAME} proposal has been accepted and payment has been
            confirmed.
          </p>
        </section>

        <section className="mb-10 rounded-xl border border-[#2563EB]/30 bg-[#EFF6FF] p-5">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            Check your email for your portal invite
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[#374151]">
            We&apos;re provisioning your {BRAND_NAME} workspace now. You
            should receive your sign-in invite at{" "}
            <span className="font-medium text-[#0F172A]">
              {proposal.prospectEmail}
            </span>{" "}
            within a few minutes. If it doesn&apos;t arrive, check spam or
            reach out to us at{" "}
            <a
              href={`mailto:${BRAND_EMAIL}`}
              className="text-[#2563EB] hover:underline"
            >
              {BRAND_EMAIL}
            </a>
            .
          </p>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
              What you purchased
            </h2>
            <ul className="mt-3 divide-y divide-[#EAECEF] border-y border-[#EAECEF]">
              {proposal.lineItems.map((line) => {
                const total =
                  Math.max(0, Math.floor(line.unitPriceCents)) *
                  Math.max(1, Math.floor(line.quantity));
                return (
                  <li
                    key={line.id}
                    className="flex items-start justify-between gap-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium text-[#0F172A]">
                        {line.label}
                        {line.quantity > 1 ? (
                          <span className="ml-1 text-xs font-normal text-[#6B7280]">
                            × {line.quantity}
                          </span>
                        ) : null}
                      </p>
                      {line.description ? (
                        <p className="mt-1 text-sm text-[#6B7280]">
                          {line.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[15px] font-medium tabular-nums text-[#0F172A]">
                      {formatCents(total, currency)}
                      {line.recurring ? (
                        <span className="text-xs font-normal text-[#6B7280]">
                          {cadenceLabel(cadence)}
                        </span>
                      ) : null}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-xl border border-[#EAECEF] bg-[#F9FAFB] p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Receipt
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-[#6B7280]">Paid today</dt>
                  <dd className="font-semibold tabular-nums text-[#0F172A]">
                    {formatCents(amountPaid, currency)}
                  </dd>
                </div>
                {acceptedAt ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[#6B7280]">Accepted</dt>
                    <dd className="tabular-nums text-[#374151]">
                      {formatDate(acceptedAt)}
                    </dd>
                  </div>
                ) : null}
                {totals.recurringTotal > 0 ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[#6B7280]">
                      {cadenceWord(cadence)}{" "}
                      {cadence === "ANNUAL" ? "renewal" : "billing"}
                    </dt>
                    <dd className="tabular-nums text-[#374151]">
                      {formatCents(totals.recurringTotal, currency)}
                      {cadenceLabel(cadence)}
                    </dd>
                  </div>
                ) : null}
                {nextBillingDate ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[#6B7280]">Trial ends</dt>
                    <dd className="tabular-nums text-[#374151]">
                      {formatDate(nextBillingDate)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="mt-4 rounded-xl border border-[#EAECEF] bg-white p-5 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                Your contact
              </h3>
              <p className="mt-2 text-[#374151]">{BRAND_NAME} team</p>
              <p>
                <a
                  href={`mailto:${BRAND_EMAIL}`}
                  className="text-[#2563EB] hover:underline"
                >
                  {BRAND_EMAIL}
                </a>
              </p>
            </div>
          </aside>
        </div>

        <footer className="mt-16 border-t border-[#EAECEF] pt-6 text-xs text-[#6B7280]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Need help?{" "}
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

function PendingState({ proposalNumber }: { proposalNumber: string }) {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <header className="border-b border-[#EAECEF]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            {BRAND_NAME}
          </span>
          <span className="font-mono text-xs tabular-nums text-[#6B7280]">
            {proposalNumber}
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Payment received — finalizing your account…
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
          We&apos;re confirming the payment with our payment processor. You
          can close this page; we&apos;ll email you at the address on file
          the moment your {BRAND_NAME} workspace is ready.
        </p>
        <p className="mt-6 text-xs text-[#6B7280]">
          Questions?{" "}
          <a
            href={`mailto:${BRAND_EMAIL}`}
            className="text-[#2563EB] hover:underline"
          >
            {BRAND_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}

function ExpiredFallback() {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This link is no longer active
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
          Contact your {BRAND_NAME} account rep for a fresh link.
        </p>
        <p className="mt-6 text-xs text-[#6B7280]">
          <a
            href={`mailto:${BRAND_EMAIL}`}
            className="text-[#2563EB] hover:underline"
          >
            {BRAND_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
