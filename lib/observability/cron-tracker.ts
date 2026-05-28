import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * trackCronDuration — additive observability wrapper for cron handlers.
 *
 * Drop-in around the inner work of a cron route. Emits:
 *
 *   - a Sentry breadcrumb at start with the job name
 *   - a `captureMessage` at level "warning" if duration > `thresholdMs`
 *     (default 60_000 ms) so slow crons surface as alertable signals
 *     in Sentry without flipping the cron into an error state
 *   - a `captureException` (re-thrown) if the inner handler throws
 *
 * This does NOT replace `recordCronRun` (which writes the CronRun row
 * for the in-app health dashboard). It's a thin instrumentation layer
 * that composes around / inside `recordCronRun` — pick whichever order
 * makes sense per route.
 *
 * Usage:
 *
 *   import { trackCronDuration } from "@/lib/observability/cron-tracker";
 *
 *   return recordCronRun("appfolio-sync", () =>
 *     trackCronDuration("appfolio-sync", async () => {
 *       // ... the actual cron work ...
 *       return { result: NextResponse.json({ ok: true }), recordsProcessed: 42 };
 *     }),
 *   );
 *
 * Owner can roll this out further by wrapping each cron's inner handler.
 * Default threshold tuned to Vercel's serverless function defaults:
 * anything taking >60s on a 300s cap deserves a look.
 */

const DEFAULT_THRESHOLD_MS = 60_000;

export interface CronTrackerOptions {
  /** Soft alert threshold in ms. Default 60_000. */
  thresholdMs?: number;
}

export async function trackCronDuration<T>(
  jobName: string,
  handler: () => Promise<T>,
  options: CronTrackerOptions = {},
): Promise<T> {
  const thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const startedAt = Date.now();

  try {
    Sentry.addBreadcrumb({
      category: "cron",
      level: "info",
      message: `cron:${jobName} started`,
      data: { jobName, thresholdMs },
    });
  } catch {
    // Sentry must never break the cron itself.
  }

  try {
    const result = await handler();
    const durationMs = Date.now() - startedAt;
    if (durationMs > thresholdMs) {
      try {
        Sentry.withScope((scope) => {
          scope.setLevel("warning");
          scope.setTag("cron", jobName);
          scope.setTag("cron:slow", "true");
          scope.setExtras({ durationMs, thresholdMs });
          Sentry.captureMessage(
            `cron:${jobName} exceeded ${thresholdMs}ms (took ${durationMs}ms)`,
          );
        });
      } catch {
        // Swallow — never fail the cron because Sentry is unhappy.
      }
    }
    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    try {
      Sentry.withScope((scope) => {
        scope.setLevel("error");
        scope.setTag("cron", jobName);
        scope.setExtras({ durationMs });
        Sentry.captureException(
          err instanceof Error ? err : new Error(String(err)),
        );
      });
    } catch {
      // Swallow.
    }
    throw err;
  }
}
