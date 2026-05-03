"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// StaleOnLoadTrigger — invisible client component that fires a server
// action exactly once on mount, then refreshes the route so the next render
// shows fresh data. Drop it onto any page that depends on integration data
// when the parent server component decides freshness.shouldAutoTrigger is
// true.
//
// Cost: one fetch + one router.refresh per page load when stale. Naturally
// rate-limited by user behavior — pages nobody opens never trigger a sync.
// We deliberately do NOT poll on a timer here; that would defeat the
// "operators drive sync, not the system" cost model.
// ---------------------------------------------------------------------------

type Props = {
  /** Server action endpoint to POST to. Must accept an empty body. */
  endpoint: string;
  /**
   * Stable key per integration+org so two banners on the same page don't
   * fire duplicate syncs. Uses sessionStorage to dedupe within a single
   * tab visit; refreshing the tab is allowed to trigger again.
   */
  dedupeKey: string;
  /** ms to wait before re-firing in the same tab. Default 60s. */
  cooldownMs?: number;
  /**
   * After the sync POST returns, wait this long then call router.refresh
   * so the server re-reads the now-fresh data. Default 1500ms — long
   * enough for AppFolio's REST sync to upsert tens of rows.
   */
  refreshAfterMs?: number;
};

export function StaleOnLoadTrigger({
  endpoint,
  dedupeKey,
  cooldownMs = 60_000,
  refreshAfterMs = 1500,
}: Props) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // sessionStorage dedupe — prevents two side-by-side banners on the
    // same page (residents + renewals) from each firing a sync, and
    // prevents re-fires from client navigations within the same tab.
    try {
      const lastFired = sessionStorage.getItem(`sync:${dedupeKey}`);
      if (lastFired) {
        const ageMs = Date.now() - Number(lastFired);
        if (Number.isFinite(ageMs) && ageMs < cooldownMs) return;
      }
      sessionStorage.setItem(`sync:${dedupeKey}`, String(Date.now()));
    } catch {
      // sessionStorage can throw in private mode; fall through and trigger
      // anyway — the worst case is one extra sync on this load.
    }

    let cancelled = false;
    void (async () => {
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          // keepalive lets the request finish even if the user navigates
          // away mid-flight. Sync writes to the DB regardless of whether
          // the response ever lands in the browser.
          keepalive: true,
        }).catch(() => undefined);
      } finally {
        if (cancelled) return;
        // Wait for the upsert to settle, then refresh server data.
        setTimeout(() => {
          if (!cancelled) router.refresh();
        }, refreshAfterMs);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [endpoint, dedupeKey, cooldownMs, refreshAfterMs, router]);

  return null;
}
