"use client";

import Link from "next/link";
import * as React from "react";
import type { ReactNode } from "react";
import {
  getBookDemoHref,
  isExternalBookDemoHref,
} from "@/lib/marketing/book-demo";
import { useCalDemo } from "./cal-demo-modal";

// ---------------------------------------------------------------------------
// BookDemoLink. Single CTA component used by every "Book a demo" surface
// on the marketing site, audit lead-magnet, footer, and inside the
// trial wizard (step-4 primary CTA).
//
// Behavior, in order of preference:
//   1. If NEXT_PUBLIC_CAL_BOOK_URL is an external https URL AND the
//      <CalDemoProvider> is mounted (it is, at app/layout root) →
//      render a button that opens the inline Cal.com modal. Prospect
//      never navigates away; the page state is preserved.
//   2. If the env var is external but the provider isn't available
//      (preview build w/o env, SSR pre-hydration) → render an external
//      <a target=_blank> as a graceful fallback.
//   3. If the env var is missing entirely → fall back to /onboarding,
//      same as the legacy behavior.
//
// Norman feedback (2026-06-02): clicking "Book a demo" used to redirect
// to the trial wizard at /onboarding even for prospects who already
// signed up — they'd end up bounced from sales-call intent into
// product-onboarding intent. The inline modal route severs those two
// flows cleanly: book-demo never enters /onboarding, full stop.
// ---------------------------------------------------------------------------

export function BookDemoLink({
  children,
  className,
  style,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const href = getBookDemoHref();
  const isExternal = isExternalBookDemoHref(href);
  const cal = useCalDemo();

  // Branch 1: external URL + Cal provider mounted = inline modal.
  if (isExternal && cal.isAvailable) {
    return (
      <button
        type="button"
        onClick={cal.open}
        className={className}
        style={style}
        aria-label={ariaLabel}
      >
        {children}
      </button>
    );
  }

  // Branch 2: external URL but provider not ready (SSR / preview
  // without env). Falls back to opening Cal.com in a new tab so the
  // CTA still works — same UX as before this refactor.
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  // Branch 3: internal href (env var missing) → /onboarding fallback.
  return (
    <Link
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
