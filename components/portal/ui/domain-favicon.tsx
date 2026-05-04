"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// DomainFavicon — renders a domain's favicon for entity rows that map to
// a real website (Properties with custom domains, attribution sources,
// reputation mention origins). Uses Google's public favicon service which
// is free, fast, and rate-limit-tolerant — no API key, no secret, no
// Clearbit dependency. Falls back to a colored monogram if the favicon
// fails to load.
//
// Why not Clearbit: paid service, requires API key, adds rate limit
// budgets we don't need. Google favicons cover ~95% of the cases we
// care about (most public companies have a favicon) and the fallback
// monogram handles the rest.
// ---------------------------------------------------------------------------

type Props = {
  /** Bare domain or full URL — we extract the host either way. */
  domain: string;
  /** Display name used for the monogram fallback. */
  fallbackName?: string;
  size?: 16 | 20 | 24 | 28 | 32;
  className?: string;
};

const SIZE_TO_PX = {
  16: 16,
  20: 20,
  24: 24,
  28: 32, // Google serves 16/32/64; pick the next bump for retina crispness
  32: 32,
} as const;

function extractHost(input: string): string | null {
  if (!input) return null;
  try {
    const u = new URL(input.includes("://") ? input : `https://${input}`);
    return u.host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function DomainFavicon({
  domain,
  fallbackName,
  size = 20,
  className,
}: Props) {
  const host = extractHost(domain);
  const [errored, setErrored] = React.useState(false);
  const px = SIZE_TO_PX[size];
  const initial = (fallbackName ?? host ?? "?").trim()[0]?.toUpperCase() ?? "?";

  if (!host || errored) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground font-semibold leading-none shrink-0",
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=${px}&domain=${host}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn(
        "rounded-md shrink-0 bg-muted/40",
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}
