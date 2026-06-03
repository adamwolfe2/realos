import "server-only";
import * as Sentry from "@sentry/nextjs";

// ---------------------------------------------------------------------------
// Sink error recording — single entry point for "this provider failed for
// this org" events.
//
// Why this exists
// ---------------
// CronRun (in lib/health/cron-run.ts) captures top-level cron status: did
// the *job* succeed? But a cron job typically iterates dozens of orgs and
// any given run can have 19 orgs sync cleanly while 1 fails on bad creds.
// The top-level CronRun row is "ok" — the cron itself ran fine — and yet
// the operator for that 1 broken org sees stale data with no signal.
//
// recordSinkError() lets the inner loop tag Sentry with the offending
// (provider, orgId, jobName) so the Data Sinks admin board can:
//   1. Surface the right tenant when triaging
//   2. Count errors per provider over the last 24h without parsing logs
//   3. Show a meaningful lastErrorMessage on the tenant's clients/[id]
//      page instead of the generic "no recent sync"
//
// This is additive — calling sites that already throw / log keep working.
// Use recordSinkError() at the boundary where a per-org failure is caught
// but the cron continues to the next org.
// ---------------------------------------------------------------------------

export type SinkProvider =
  | "appfolio"
  | "ga4"
  | "gsc"
  | "google_ads"
  | "meta_ads"
  | "dataforseo"
  | "aeo"
  | "reputation"
  | "cursive_pixel"
  | "site_intelligence";

export interface SinkErrorContext {
  provider: SinkProvider;
  orgId?: string | null;
  jobName?: string | null;
  /**
   * Optional sub-scope inside the provider — e.g. AppFolio's `phase` field
   * ("listings", "residents", "rent_roll"), AEO's engine ("claude" |
   * "chatgpt" | "gemini" | "perplexity"), or Reputation's source
   * ("google" | "yelp" | "reddit" | "tavily"). Surfaces as a Sentry tag so
   * the Data Sinks board can drill down later.
   */
  scope?: string | null;
  /**
   * Optional extras to attach (counts, IDs, retry status). Avoid PII —
   * the Sentry config strips request bodies but extras are kept verbatim.
   */
  extras?: Record<string, unknown>;
}

/**
 * Records a sink-level error to Sentry with consistent tags so the Data
 * Sinks admin board (and any future alerting) can attribute it.
 *
 * NEVER throws. The caller is presumed to be inside a per-org loop that
 * wants to swallow the failure and continue with the next org; bubbling
 * an exception here would defeat that pattern.
 */
export function recordSinkError(
  err: unknown,
  ctx: SinkErrorContext,
): void {
  try {
    const error = err instanceof Error ? err : new Error(String(err));
    Sentry.withScope((scope) => {
      scope.setLevel("error");
      scope.setTag("sink:provider", ctx.provider);
      if (ctx.orgId) scope.setTag("sink:orgId", ctx.orgId);
      if (ctx.jobName) scope.setTag("sink:job", ctx.jobName);
      if (ctx.scope) scope.setTag("sink:scope", ctx.scope);
      if (ctx.extras) scope.setExtras(ctx.extras);
      Sentry.captureException(error);
    });
  } catch {
    // Sentry must never break the caller's cron loop.
  }
}

/**
 * Wraps a per-org sync body and records any throw as a sink error before
 * re-swallowing it. Returns `{ ok, error }` so the caller can count
 * successes vs failures across the loop without try/catch boilerplate.
 *
 *   for (const org of orgs) {
 *     const { ok } = await runSinkSync(
 *       () => syncAppFolioForOrg(org.id),
 *       { provider: "appfolio", orgId: org.id, jobName: "appfolio-sync" },
 *     );
 *     if (ok) successes++; else failures++;
 *   }
 */
export async function runSinkSync<T>(
  body: () => Promise<T>,
  ctx: SinkErrorContext,
): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  try {
    const value = await body();
    return { ok: true, value };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    recordSinkError(error, ctx);
    return { ok: false, error };
  }
}

/**
 * Sets the current Sentry scope to attribute follow-on captures to a
 * specific provider + org. Use inside a route handler that is unambiguously
 * about one sink (e.g. /api/integrations/appfolio/test-connection).
 *
 * Sentry v8+ removed `configureScope(callback)` — use `getCurrentScope()`
 * to mutate the current scope directly.
 */
export function tagSinkScope(ctx: SinkErrorContext): void {
  try {
    const scope = Sentry.getCurrentScope();
    scope.setTag("sink:provider", ctx.provider);
    if (ctx.orgId) scope.setTag("sink:orgId", ctx.orgId);
    if (ctx.jobName) scope.setTag("sink:job", ctx.jobName);
    if (ctx.scope) scope.setTag("sink:scope", ctx.scope);
  } catch {
    // Swallow.
  }
}
