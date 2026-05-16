import * as Sentry from "@sentry/nextjs";

// Edge runtime is constrained — no Node URL parsing primitives, but
// the global `URL` is available. Same scrub policy as the server +
// client configs; kept minimal here because edge handlers (middleware)
// rarely capture request bodies.
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-audiencelab-secret",
  "x-stripe-signature",
  "svix-signature",
]);

function scrubHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SENSITIVE_HEADERS.has(k.toLowerCase()) ? "[Filtered]" : v;
  }
  return out;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        event.request.headers = scrubHeaders(event.request.headers);
        delete event.request.data;
      }
      return event;
    },
  });
}
