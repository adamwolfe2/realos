import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// BookCallCta — sticky bottom-of-viewport CTA that stays visible as
// the prospect scrolls the audit report. The audit's primary goal is to
// drive a booked call; without a persistent CTA, the page-bottom hero
// (which already exists) only fires for the small fraction who scroll
// the whole thing. Sticky-bottom keeps it always one click away.
//
// Server-rendered, no client state. The `href` points at /onboarding
// today — swap to a calendar booking link once that lands.

export function BookCallCta({
  /** Optional context the CTA can surface — e.g. the brand being
   *  audited, or the count of high-severity recommendations. */
  subtitle,
}: {
  subtitle?: string;
}) {
  return (
    <div
      className="sticky bottom-4 z-30 mt-12"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="max-w-[1100px] mx-auto px-4 md:px-8"
        style={{ pointerEvents: "auto" }}
      >
        <div
          className="rounded-2xl border bg-white px-5 py-4 sm:px-6 sm:py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-lg"
          style={{
            borderColor: "#E5E7EB",
            boxShadow:
              "0 12px 28px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: "#2563EB", fontFamily: "var(--font-mono)" }}
            >
              Ready to fix the gaps?
            </p>
            <p
              className="text-base sm:text-lg font-semibold mt-0.5"
              style={{ color: "#1E2A3A" }}
            >
              Book a 15-minute call with the {BRAND_NAME} team
            </p>
            {subtitle ? (
              <p
                className="text-xs sm:text-sm mt-0.5"
                style={{ color: "#6B7280" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center h-11 px-5 rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: "#2563EB" }}
            >
              Book a call →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
