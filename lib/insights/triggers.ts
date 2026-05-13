import "server-only";
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
// We fire-and-forget on a microtask so the calling handler doesn't block
// on the insight pass (detectors can take a few seconds across a portfolio).
// Errors are logged to Sentry but never bubble to the caller — a failed
// insight pass should NEVER break a sync write.
// ---------------------------------------------------------------------------

/**
 * Kick off a non-blocking insight pass for an org. Safe to call from any
 * sync-completion handler; never throws.
 *
 * @param reason — short string for logging ("appfolio_sync", "ga4_oauth",
 *                 "cursive_first_event", etc.). Surfaces in the run summary
 *                 so we can correlate insight bursts to the trigger source.
 */
export function triggerInsightsForOrg(orgId: string, reason: string): void {
  // Use queueMicrotask so the trigger fires AFTER the calling transaction
  // has committed but BEFORE the response is fully serialised. Detector
  // queries see the just-written data, and the user perceives "instant".
  queueMicrotask(() => {
    runInsightDetectors(orgId)
      .then((summary) => {
        if (summary.totalInserted > 0 || summary.totalUpdated > 0) {
          console.info(
            `[insights] on-arrival pass triggered by ${reason} for org ${orgId}: ${summary.totalInserted} new, ${summary.totalUpdated} updated, ${summary.totalResolved} resolved`,
          );
        }
      })
      .catch((err) => {
        console.error(
          `[insights] on-arrival pass failed for org ${orgId} (reason=${reason}):`,
          err,
        );
      });
  });
}
