import "server-only";
import { runAfter } from "@/lib/after";
import { runInsightDetectors } from "./run";

// ---------------------------------------------------------------------------
// Insight on-data-arrival triggers
//
// The nightly cron at /api/cron/insight-detector keeps insights fresh, but
// new tenants need to see their first insight WITHIN MINUTES of connecting
// a data source — not 24 hours later. Every integration callback /
// sync-completion handler calls triggerInsightsForOrg() so the user gets
// immediate feedback.
//
// The pass runs after the response via next/server after(), so the calling
// handler doesn't block on it (detectors can take a few seconds across a
// portfolio). Errors are logged to Sentry but never bubble to the caller —
// a failed insight pass should NEVER break a sync write.
// ---------------------------------------------------------------------------

/**
 * Kick off a non-blocking insight pass for an org. Safe to call from any
 * sync-completion handler; never throws.
 *
 * @param reason — short string for logging ("appfolio_sync", "ga4_oauth", etc.). Surfaces in the run summary
 *                 so we can correlate insight bursts to the trigger source.
 */
export function triggerInsightsForOrg(orgId: string, reason: string): void {
  // after() (via runAfter) keeps the function alive until the pass finishes.
  // The old queueMicrotask fire-and-forget let Vercel freeze the instance
  // mid-query once the cron responded; the dead socket then surfaced as
  // "Connection terminated unexpectedly" inside the NEXT request on that
  // instance (17x in prod logs, e.g. seo_sync_complete failing under
  // /api/cron/aeo-scan).
  void runAfter(`insights:${reason}`, async () => {
    const summary = await runInsightDetectors(orgId);
    if (summary.totalInserted > 0 || summary.totalUpdated > 0) {
      console.info(
        `[insights] on-arrival pass triggered by ${reason} for org ${orgId}: ${summary.totalInserted} new, ${summary.totalUpdated} updated, ${summary.totalResolved} resolved`,
      );
    }
  });
}
