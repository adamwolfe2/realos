"use client";

import Link from "next/link";
import * as React from "react";
import type { ReactNode } from "react";
import { getBookDemoHref } from "@/lib/marketing/book-demo";

// ---------------------------------------------------------------------------
// BookDemoLink. Single CTA component used by every "Book a demo" surface
// on the marketing site, audit lead-magnet, footer, and inside the
// trial wizard (step-4 primary CTA).
//
// 2026-08-12 (Adam): demo CTAs no longer open the Cal modal directly —
// they navigate to /book-demo, the qualification wizard that ends on
// Norman's embedded Cal calendar. Direct-booking surfaces that should
// skip qualification (e.g. BookCallCta on audit reports) read
// NEXT_PUBLIC_CAL_BOOK_URL themselves.
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
  return (
    <Link
      href={getBookDemoHref()}
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
