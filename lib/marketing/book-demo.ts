// ---------------------------------------------------------------------------
// Book-a-demo URL resolver.
//
// Single source of truth for every "Book a demo" / "Book a call" CTA on
// the marketing site, the audit lead-magnet, and the platform footer.
// Reads NEXT_PUBLIC_CAL_BOOK_URL (set in Vercel → Project Settings →
// Environment Variables) and returns it as the destination.
//
// Falls back to /onboarding only when the env var is missing. NOTE: that
// fallback routes prospects through the auth gate (/sign-up first,
// /onboarding wizard second) and isn't the desired UX — set the env var.
// ---------------------------------------------------------------------------

const FALLBACK_HREF = "/onboarding";

export function getBookDemoHref(): string {
  return process.env.NEXT_PUBLIC_CAL_BOOK_URL ?? FALLBACK_HREF;
}

export function isExternalBookDemoHref(href?: string): boolean {
  const url = href ?? getBookDemoHref();
  return url.startsWith("http");
}
