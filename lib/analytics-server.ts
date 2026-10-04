import "server-only";

import { createHash } from "node:crypto";
import { PostHog } from "posthog-node";
import { runAfter } from "@/lib/after";
import { captureWithContext } from "@/lib/sentry";

// Server-side funnel events (webhooks, API routes, cron). Scheduled via
// after() so they never block the response; never throws. captureImmediate
// sends before returning, so the event survives a serverless freeze. Short
// timeout and no retries bound the inline fallback (cron). No-op when
// NEXT_PUBLIC_POSTHOG_KEY is unset.

let client: PostHog | null = null;

function getClient(key: string): PostHog {
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
      requestTimeout: 2000,
      fetchRetryCount: 0,
    });
    // The SDK never rejects from captureImmediate; failures arrive here.
    client.on("error", (err: unknown) => {
      console.error("[analytics] posthog error:", err);
      captureWithContext(err, { area: "analytics" });
    });
  }
  return client;
}

// PostHog dedupes on a UUID: derive a stable one from a key (SHA-1 shaped as
// a v5 UUID) so a retried webhook re-sends the same event id.
function stableUuid(key: string): string {
  const h = createHash("sha1").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function trackServer(input: {
  event: string;
  distinctId: string;
  props?: Record<string, unknown>;
  /** Stable key (e.g. Stripe event id) so retries dedupe in PostHog. */
  dedupeKey?: string;
}): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  await runAfter(`analytics:${input.event}`, () =>
    getClient(key).captureImmediate({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.props,
      ...(input.dedupeKey ? { uuid: stableUuid(input.dedupeKey) } : {}),
    }),
  );
}
