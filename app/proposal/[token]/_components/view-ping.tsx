"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Fires a single POST /api/proposals/[token]/view per page load so the
// agency operator sees viewCount + firstViewedAt update. We guard against
// double-fire in React Strict Mode (dev) by tracking a ref. Network errors
// are swallowed silently — this is telemetry, not a user-visible action.
// ---------------------------------------------------------------------------

export function ViewPing({ token }: { token: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const url = `/api/proposals/${encodeURIComponent(token)}/view`;
    // keepalive lets the request complete even if the user navigates
    // away immediately after opening the page.
    fetch(url, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Silent — telemetry only.
    });
  }, [token]);

  return null;
}
