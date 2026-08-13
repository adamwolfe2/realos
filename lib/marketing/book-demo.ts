// ---------------------------------------------------------------------------
// Book-a-demo URL resolver.
//
// Single source of truth for every "Book a demo" / "Book a call" CTA on
// the marketing site, the audit lead-magnet, and the platform footer.
//
// 2026-08-12 (Adam): every demo CTA routes to the /book-demo qualification
// wizard (contact info → feature interests → inline Cal booking on
// Norman's calendar) instead of opening the Cal modal directly. The Cal
// link itself (NEXT_PUBLIC_CAL_BOOK_URL) is consumed by the wizard's
// final step and by BookCallCta on audit reports.
// ---------------------------------------------------------------------------

export function getBookDemoHref(): string {
  return "/book-demo";
}

export function isExternalBookDemoHref(href?: string): boolean {
  const url = href ?? getBookDemoHref();
  return url.startsWith("http");
}
