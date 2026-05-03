import "server-only";

// ---------------------------------------------------------------------------
// Freshness orchestrator — single source of truth for "is this integration's
// data stale enough to warrant an on-demand refresh?"
//
// Cost model:
//   1. Push (free): Cursive pixel events, Stripe webhooks, Clerk webhooks,
//      Resend bounces. These hit dedicated webhook endpoints in real time;
//      no polling required.
//   2. Pull on cron (cheap): hourly AppFolio, daily/30-min ads, daily SEO,
//      etc. Runs against every active integration even if no operator is
//      looking. Each cron tick is one Vercel function invocation, charged
//      per tenant batch.
//   3. Pull on-demand (cheaper still): when an operator opens a page that
//      depends on integration X, check freshness via this module. If the
//      data is older than the threshold, kick off a fire-and-forget sync
//      so the next render has fresh data. UI shows a "Syncing now" pill.
//      Naturally rate-limited by user behavior — pages nobody opens never
//      cost a sync.
//
// We deliberately do NOT introduce Inngest, BullMQ, or a polling websocket
// layer. Vercel cron + on-demand triggers + per-page router.refresh on a
// 15–30s interval gives "feels live" without the recurring infra cost.
// ---------------------------------------------------------------------------

export type IntegrationKey =
  | "appfolio"
  | "google_ads"
  | "meta_ads"
  | "ga4"
  | "gsc"
  | "cursive_pixel"
  | "reputation";

export type FreshnessVerdict = "fresh" | "stale" | "very_stale" | "missing";

export type FreshnessSummary = {
  key: IntegrationKey;
  verdict: FreshnessVerdict;
  /** ms since last successful sync, or null when never synced. */
  ageMs: number | null;
  lastSyncAt: Date | null;
  /** Threshold in ms beyond which data is considered stale. */
  staleAfterMs: number;
  /** Threshold beyond which data is considered very_stale (alarming). */
  veryStaleAfterMs: number;
  /**
   * True when the caller may safely fire a background sync. Used by
   * stale-on-load triggers to avoid hammering integrations that are
   * already mid-flight or known broken.
   */
  shouldAutoTrigger: boolean;
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Per-integration freshness budget. Tuned to the underlying API's update
// cadence: AppFolio reports refresh every few minutes, Google Ads every
// 15–30 min, GA4 daily, GSC every 24–48h. Setting these too aggressively
// burns invocations and rate limits without giving operators new info.
export const FRESHNESS_BUDGET: Record<
  IntegrationKey,
  { staleAfterMs: number; veryStaleAfterMs: number }
> = {
  appfolio: { staleAfterMs: 1 * HOUR, veryStaleAfterMs: 24 * HOUR },
  google_ads: { staleAfterMs: 30 * MIN, veryStaleAfterMs: 6 * HOUR },
  meta_ads: { staleAfterMs: 30 * MIN, veryStaleAfterMs: 6 * HOUR },
  ga4: { staleAfterMs: 6 * HOUR, veryStaleAfterMs: 2 * DAY },
  gsc: { staleAfterMs: 1 * DAY, veryStaleAfterMs: 3 * DAY },
  cursive_pixel: { staleAfterMs: 24 * HOUR, veryStaleAfterMs: 7 * DAY },
  reputation: { staleAfterMs: 24 * HOUR, veryStaleAfterMs: 7 * DAY },
};

/**
 * Pure freshness verdict. Doesn't know about Prisma — pass in the timestamp
 * you've already loaded. This makes it cheap to call from inside a
 * Promise.all alongside other queries.
 */
export function classifyFreshness(
  key: IntegrationKey,
  lastSyncAt: Date | null | undefined,
  options: { syncInProgress?: boolean; hasError?: boolean } = {}
): FreshnessSummary {
  const budget = FRESHNESS_BUDGET[key];
  const ageMs = lastSyncAt ? Date.now() - lastSyncAt.getTime() : null;

  let verdict: FreshnessVerdict;
  if (lastSyncAt == null) {
    verdict = "missing";
  } else if (ageMs! > budget.veryStaleAfterMs) {
    verdict = "very_stale";
  } else if (ageMs! > budget.staleAfterMs) {
    verdict = "stale";
  } else {
    verdict = "fresh";
  }

  // Don't auto-trigger when we know the last attempt failed or a sync is
  // already in flight. Operators can still hit "Run sync" manually; this
  // just stops the page-load auto-trigger from spamming a broken creds
  // pair every time the page renders.
  const shouldAutoTrigger =
    !options.syncInProgress &&
    !options.hasError &&
    (verdict === "stale" || verdict === "very_stale");

  return {
    key,
    verdict,
    ageMs,
    lastSyncAt: lastSyncAt ?? null,
    staleAfterMs: budget.staleAfterMs,
    veryStaleAfterMs: budget.veryStaleAfterMs,
    shouldAutoTrigger,
  };
}

/**
 * Format an "age" for compact UI display. 5m ago, 47m ago, 3h ago, 2d ago.
 */
export function formatAge(ageMs: number | null): string {
  if (ageMs == null) return "never";
  const minutes = Math.floor(ageMs / MIN);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
