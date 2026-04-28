"use client";

import Link from "next/link";
import * as React from "react";

// Lightweight client-side wrapper for tenant-site CTAs. Pushes a dataLayer
// event before the navigation so GTM (and GA4 fallback) can fire conversion
// triggers in the customer's own Google account. No-op when neither is on
// the page.

type DLEntry = Record<string, unknown>;

function pushEvent(event: string, params: DLEntry) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    dataLayer?: DLEntry[];
    gtag?: (cmd: string, ev: string, p?: DLEntry) => void;
  };
  if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push({ event, ...params });
    return;
  }
  if (typeof w.gtag === "function") {
    w.gtag("event", event, params);
  }
}

export function TrackedLink({
  href,
  event,
  params,
  children,
  className,
  style,
  target,
  rel,
  ariaLabel,
}: {
  href: string;
  event: string;
  params?: DLEntry;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  target?: string;
  rel?: string;
  ariaLabel?: string;
}) {
  const onClick = React.useCallback(() => {
    pushEvent(event, params ?? {});
  }, [event, params]);

  // External links (http(s):// or starting with mailto:/tel:) bypass next/link.
  const isExternal = /^(https?:|mailto:|tel:)/i.test(href);
  if (isExternal) {
    return (
      <a
        href={href}
        onClick={onClick}
        className={className}
        style={style}
        target={target}
        rel={rel}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={className}
      style={style}
      target={target}
      rel={rel}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
