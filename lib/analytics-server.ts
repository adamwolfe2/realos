import "server-only";

import { PostHog } from "posthog-node";
import { captureWithContext } from "@/lib/sentry";

// Server-side funnel events (webhooks, API routes, cron). Never throws into
// the request path. captureImmediate sends before returning, so the event
// survives a serverless freeze. No-op when NEXT_PUBLIC_POSTHOG_KEY is unset.

let client: PostHog | null = null;

function getClient(key: string): PostHog {
  client ??= new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export async function trackServer(input: {
  event: string;
  distinctId: string;
  props?: Record<string, unknown>;
}): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  try {
    await getClient(key).captureImmediate({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.props,
    });
  } catch (err) {
    console.error(`[analytics] ${input.event} failed:`, err);
    captureWithContext(err, { analyticsEvent: input.event });
  }
}
