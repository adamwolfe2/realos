"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// AutoRefresh — invisible client component that calls router.refresh() on
// an interval. Re-fetches the parent server component's data without a
// full navigation, so the page stays mounted but the numbers update.
//
// Cost: each tick is a single Server Component re-render which re-runs
// the page's Prisma queries. No integration API calls are made; we read
// from the DB only. The integration data itself is refreshed by:
//   - Vercel cron (push pull every 30m–6h depending on integration)
//   - StaleOnLoadTrigger when an operator opens a stale page
//   - Webhooks for push-capable integrations (pixel, Stripe, Clerk)
//
// Tune intervalMs to the visual half-life of the page:
//   - Visitor feed: 15s (high-velocity pixel events)
//   - Dashboard:    30–45s (mixed signals, heavier query)
//   - Properties:   60s (slower-moving)
// ---------------------------------------------------------------------------

export function AutoRefresh({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
