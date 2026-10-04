import posthog from "posthog-js";

// Client-side funnel events. No-op until the PostHog provider has initialised
// (it skips init when NEXT_PUBLIC_POSTHOG_KEY is unset or on tenant hosts).
// Server events live in lib/analytics-server.ts so posthog-node stays out of
// the client bundle.
export function track(
  event: string,
  props: Record<string, unknown> = {},
): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(event, props);
}
