"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// ClientLogo — renders an operator/client-supplied logo (org.logoUrl) and
// GRACEFULLY DISAPPEARS if the asset 404s or is otherwise unloadable, instead
// of leaving the browser's broken-image glyph in the report header. External
// logos are outside our control (they live on the client's marketing site), so
// a missing one must never degrade the report's presentation.
//
// Plain <img> (not next/image) on purpose: report logos are arbitrary external
// URLs we don't want to run through the image optimizer / domain allowlist.
// ---------------------------------------------------------------------------

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function ClientLogo({ src, alt, className }: Props) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
