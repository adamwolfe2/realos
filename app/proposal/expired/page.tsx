import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, BRAND_EMAIL, BRAND_NAME } from "@/lib/brand";

// ---------------------------------------------------------------------------
// Friendly landing for every "this token is no longer usable" path —
// not-found, revoked, expired, voided, draft. Intentionally one page
// (not a 404) so the prospect knows to email the agency rather than
// assuming the link is broken.
//
// Anti-enumeration: this page does NOT echo the token or the proposal
// number — generic copy only.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: `Proposal link unavailable · ${BRAND_NAME}`,
  description: `Your ${BRAND_NAME} proposal link is no longer active.`,
  robots: { index: false, follow: false },
};

export default function ProposalExpiredPage() {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <header className="border-b border-[#EAECEF]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5 sm:py-6">
          <span className="text-sm font-semibold tracking-tight text-[#0F172A]">
            {BRAND_NAME}
          </span>
          <span className="text-xs text-[#6B7280]">Proposal</span>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-6 py-20 text-center sm:py-28">
        <p className="text-sm font-medium uppercase tracking-wider text-[#6B7280]">
          Link unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          This proposal link is no longer active.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#374151]">
          The link may have expired, been replaced with a newer version, or
          been retracted. Contact your {BRAND_NAME} account rep to receive
          a fresh link.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href={`mailto:${BRAND_EMAIL}?subject=${encodeURIComponent(
              `${BRAND_NAME} proposal link request`,
            )}`}
            className="inline-flex w-full items-center justify-center rounded-md bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 sm:w-auto"
          >
            Email {BRAND_NAME}
          </a>
          <a
            href={BRAND.url}
            className="inline-flex w-full items-center justify-center rounded-md border border-[#EAECEF] bg-white px-6 py-3 text-sm font-medium text-[#0F172A] transition hover:bg-[#F9FAFB] sm:w-auto"
            rel="noopener"
          >
            Visit {BRAND_NAME}
          </a>
        </div>
      </div>

      <footer className="mt-8 border-t border-[#EAECEF]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-[#6B7280]">
          <p>
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
          </div>
        </div>
      </footer>
    </main>
  );
}
