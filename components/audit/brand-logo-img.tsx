"use client";

import * as React from "react";

// The prospect's own logo, scraped off their homepage during the crawl.
// Third-party URL on a domain we don't control, so it has to fail
// silently: a broken-image glyph at the top of a sales report is worse
// than no logo at all. Unoptimized <img> on purpose — next/image would
// need every prospect domain whitelisted in remotePatterns.
export function BrandLogoImg({
  src,
  alt,
  height = 44,
}: {
  src: string;
  alt: string;
  height?: number;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      loading="eager"
      decoding="async"
      style={{
        height,
        maxWidth: 220,
        width: "auto",
        objectFit: "contain",
        objectPosition: "left center",
        display: "block",
      }}
    />
  );
}
