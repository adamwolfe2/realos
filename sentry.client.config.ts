import * as Sentry from "@sentry/nextjs";

// Sensitive query-string keys we scrub in URL captures + breadcrumbs.
// Same set as the server config — kept in sync intentionally.
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

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // No automatic PII capture. We opt-in via setUser on auth boundaries.
    sendDefaultPii: false,
    integrations: [
      // Mask every text field + block every media element in Session
      // Replay. This is the only safe default for a multi-tenant SaaS —
      // a single replay session can include lead names, emails, and
      // property addresses that we contractually cannot ship to Sentry.
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        delete event.request.data;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
        if (breadcrumb.data && typeof breadcrumb.data.url === "string") {
          breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
        }
      }
      // Drop console breadcrumbs in production — they routinely include
      // request bodies or error contexts we don't want shipping.
      if (
        breadcrumb.category === "console" &&
        process.env.NODE_ENV === "production"
      ) {
        return null;
      }
      return breadcrumb;
    },
  });
}
