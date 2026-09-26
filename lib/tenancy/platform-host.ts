// Pure, client-safe hostname helpers. The middleware (via resolve.ts) and
// the browser both use these to tell the LeaseStack platform surface apart
// from a customer's tenant site.

export function normalizeHost(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0]
    .toLowerCase()
    .trim();
}

// Vercel preview + localhost hostnames always count as the platform surface.
// DECISION: preview URLs must stay usable for internal QA without us having to
// pre-attach a DomainBinding for every preview deployment.
export function isDevelopmentHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return (
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".local") ||
    host.endsWith(".ngrok.io") ||
    host.endsWith(".ngrok-free.app")
  );
}

/**
 * Browser-side platform check (build-time NEXT_PUBLIC_ env only). Gates
 * LeaseStack's own analytics, support chat and demo embed so they never load
 * on a customer's tenant site, including when the tenant layout errors.
 */
export function isPlatformBrowserHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (isDevelopmentHostname(host)) return true;
  let platform = normalizeHost(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "");
  if (!platform && process.env.NEXT_PUBLIC_APP_URL) {
    platform = normalizeHost(process.env.NEXT_PUBLIC_APP_URL);
  }
  platform = platform.replace(/^www\./, "");
  if (!platform) return true; // unconfigured: same default as isPlatformHostname
  return host === platform || host === `www.${platform}`;
}
