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
//     pre-invoice-paid). The page meta-refreshes every 5s and the
//     prospect also gets an email once provisioning finishes.
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
    <main className="min-h-screen bg-white text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 sm:py-6">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {BRAND_NAME}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {proposal.number}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <section className="mb-10">
          <p className="text-sm font-medium uppercase tracking-wider text-primary">
            Payment received
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Welcome aboard.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--gray-70)]">
            Thanks, {proposal.prospectName.split(" ")[0]}. Your{" "}
            {BRAND_NAME} proposal has been accepted and payment has been
            confirmed.
          </p>
        </section>

        <section className="mb-10 rounded-xl border border-primary/30 bg-accent p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Check your email for your portal invite
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--gray-70)]">
            We&apos;re provisioning your {BRAND_NAME} workspace now. You
            should receive your sign-in invite at{" "}
            <span className="font-medium text-foreground">
              {proposal.prospectEmail}
            </span>{" "}
            within a few minutes. If it doesn&apos;t arrive, check spam or
            reach out to us at{" "}
            <a
              href={`mailto:${BRAND_EMAIL}`}
              className="text-primary hover:underline"
            >
              {BRAND_EMAIL}
            </a>
            .
          </p>
        </section>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What you purchased
            </h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
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
                      <p className="text-[15px] font-medium text-foreground">
                        {line.label}
                        {line.quantity > 1 ? (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            × {line.quantity}
                          </span>
                        ) : null}
                      </p>
                      {line.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {line.description}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[15px] font-medium tabular-nums text-foreground">
                      {formatCents(total, currency)}
                      {line.recurring ? (
                        <span className="text-xs font-normal text-muted-foreground">
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
            <div className="rounded-xl border border-border bg-secondary p-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Receipt
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-baseline justify-between">
                  <dt className="text-muted-foreground">Paid today</dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatCents(amountPaid, currency)}
                  </dd>
                </div>
                {acceptedAt ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Accepted</dt>
                    <dd className="tabular-nums text-[var(--gray-70)]">
                      {formatDate(acceptedAt)}
                    </dd>
                  </div>
                ) : null}
                {totals.recurringTotal > 0 ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">
                      {cadenceWord(cadence)}{" "}
                      {cadence === "ANNUAL" ? "renewal" : "billing"}
                    </dt>
                    <dd className="tabular-nums text-[var(--gray-70)]">
                      {formatCents(totals.recurringTotal, currency)}
                      {cadenceLabel(cadence)}
                    </dd>
                  </div>
                ) : null}
                {nextBillingDate ? (
                  <div className="flex items-baseline justify-between">
                    <dt className="text-muted-foreground">Trial ends</dt>
                    <dd className="tabular-nums text-[var(--gray-70)]">
                      {formatDate(nextBillingDate)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-white p-5 text-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Your contact
              </h3>
              <p className="mt-2 text-[var(--gray-70)]">{BRAND_NAME} team</p>
              <p>
                <a
                  href={`mailto:${BRAND_EMAIL}`}
                  className="text-primary hover:underline"
                >
                  {BRAND_EMAIL}
                </a>
              </p>
            </div>
          </aside>
        </div>

        <footer className="mt-16 border-t border-border pt-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              Need help?{" "}
              <a
                href={`mailto:${BRAND_EMAIL}`}
                className="text-primary hover:underline"
              >
                {BRAND_EMAIL}
              </a>
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/privacy"
                className="hover:text-primary hover:underline"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-primary hover:underline"
              >
                Terms
              </Link>
              <a
                href={BRAND.url}
                className="hover:text-primary hover:underline"
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
    <main className="min-h-screen bg-white text-foreground">
      <meta httpEquiv="refresh" content="5" />
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            {BRAND_NAME}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {proposalNumber}
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Confirming your payment…
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We&apos;re confirming the payment with our payment processor. You
          can close this page; we&apos;ll email you at the address on file
          the moment your {BRAND_NAME} workspace is ready.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Questions?{" "}
          <a
            href={`mailto:${BRAND_EMAIL}`}
            className="text-primary hover:underline"
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
    <main className="min-h-screen bg-white text-foreground">
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          This link is no longer active
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Contact your {BRAND_NAME} account rep for a fresh link.
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          <a
            href={`mailto:${BRAND_EMAIL}`}
            className="text-primary hover:underline"
          >
            {BRAND_EMAIL}
          </a>
        </p>
      </div>
    </main>
  );
}
