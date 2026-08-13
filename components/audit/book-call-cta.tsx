import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";

// BookCallCta. Sticky bottom-of-viewport CTA that stays visible as
// the prospect scrolls the audit report. The audit's primary goal is to
// drive a booked call; without a persistent CTA, the page-bottom hero
// (which already exists) only fires for the small fraction who scroll
// the whole thing. Sticky-bottom keeps it always one click away.
//
// Server-rendered, no client state. Destination is configurable via
// NEXT_PUBLIC_CAL_BOOK_URL — set this to Norman's (or whoever's)
// Cal.com link in Vercel env and the CTA routes there directly. Fall
// back to `/onboarding` only when the var is missing; this avoids
// dragging prospects through the property-setup wizard when all they
// want is to book a 15-min intro.

const FALLBACK_BOOK_URL = "/onboarding";

export function BookCallCta({
  /** Optional context the CTA can surface. E.g. The brand being
   *  audited, or the count of high-severity recommendations. */
  subtitle,
}: {
  subtitle?: string;
}) {
  const href = process.env.NEXT_PUBLIC_CAL_BOOK_URL ?? FALLBACK_BOOK_URL;
  const isExternal = href.startsWith("http");
  return (
    // Docked bar, not a floating island (2026-08-14): the rounded island
    // with transparent gutters read as content-overlapping-content while
    // scrolling ("it covered the Yelp review"). Edge-to-edge solid white
    // with a top hairline reads as page chrome — the same content passes
    // beneath it without looking broken.
    <div className="sticky bottom-0 z-30 mt-8 -mx-4 md:-mx-6">
      <div
        className="bg-white px-4 md:px-6"
        style={{
          borderTop: "1px solid #E5E7EB",
          boxShadow: "0 -6px 16px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div className="max-w-[920px] mx-auto py-3 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* One line on mobile — the wrapped title + subtitle made the
                sticky bar eat a quarter of a phone viewport. */}
            <p
              className="text-[13px] sm:text-sm font-semibold leading-tight truncate"
              style={{ color: "#1E2A3A" }}
            >
              Book a 15-min call with {BRAND_NAME}
            </p>
            {subtitle ? (
              <p
                className="hidden sm:block text-xs mt-0.5 truncate"
                style={{ color: "#6B7280" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {isExternal ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-9 px-4 rounded-md text-[13px] font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: "#2563EB" }}
            >
              Book a call →
            </a>
          ) : (
            <Link
              href={href}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md text-[13px] font-semibold text-white flex-shrink-0"
              style={{ backgroundColor: "#2563EB" }}
            >
              Book a call →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
