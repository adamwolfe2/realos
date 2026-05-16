import * as Sentry from "@sentry/nextjs";

// Headers we MUST strip before anything ships to Sentry. Authorization
// can include bearer tokens or Stripe-Signature; Cookie carries the
// Clerk session; the x-*-secret family covers Cursive/AudienceLab
// shared secrets that webhook handlers verify in-process.
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-audiencelab-secret",
  "x-audiencelab-signature",
  "x-stripe-signature",
  "x-clerk-signature",
  "x-resend-signature",
  "svix-signature",
  "svix-id",
  "svix-timestamp",
  "x-cron-secret",
]);

// Query params whose values are commonly tokens we never want to log.
// We don't drop the param key (helps debugging) — just the value.
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "key",
  "secret",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "code",
  "state",
  "signature",
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

function scrubUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    for (const key of Array.from(u.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        u.searchParams.set(key, "[Filtered]");
      }
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.2,
    // Never let Sentry auto-include PII it would otherwise gather from
    // request bodies or user objects. We use `setUser` deliberately on
    // the routes that benefit from it.
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip sensitive headers + query params from the request capture.
      if (event.request) {
        event.request.headers = scrubHeaders(event.request.headers);
        event.request.url = scrubUrl(event.request.url);
        // Don't send request bodies — they may contain PII / tokens /
        // webhook payloads with payment details. Stack traces and route
        // metadata are enough to triage.
        delete event.request.data;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Same scrub for the fetch / xhr breadcrumb trail.
      if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
        if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
          breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
        }
      }
      return breadcrumb;
    },
  });
}
