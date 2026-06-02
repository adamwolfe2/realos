import Link from "next/link";
import type { ReactNode } from "react";
import { getBookDemoHref, isExternalBookDemoHref } from "@/lib/marketing/book-demo";

// ---------------------------------------------------------------------------
// BookDemoLink. Wraps Next.js <Link> (internal) or a plain <a> with
// target=_blank (external Cal.com link) depending on the resolved
// destination. Use this for every "Book a demo" CTA across marketing so
// the env var swap propagates everywhere with no code changes.
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
