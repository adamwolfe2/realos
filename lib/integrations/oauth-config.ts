import "server-only";

// ---------------------------------------------------------------------------
// OAuth provider configs. Dormant until OAUTH_ENABLED=true AND
// OAUTH_CALLBACK_BASE_URL is set, because OAuth callbacks require a stable
// HTTPS hostname that's been registered with the provider's developer
// dashboard. Until Adam picks a production domain we keep the routes built
// but return 503.
//
// Required env vars (when enabling):
//   OAUTH_ENABLED                 = "true"
//   OAUTH_CALLBACK_BASE_URL       = "https://www.leasestack.co"  (no trailing slash)
//   OAUTH_STATE_SECRET            = 32+ random bytes hex (HMAC for state cookie)
//   GOOGLE_OAUTH_CLIENT_ID        = "...apps.googleusercontent.com"
//   GOOGLE_OAUTH_CLIENT_SECRET    = "GOCSPX-..."
//   META_OAUTH_APP_ID             = "1234567890"
//   META_OAUTH_APP_SECRET         = "abcdef..."
//
// Redirect URLs to register with each provider:
//   Google Cloud Console → OAuth client → Authorized redirect URIs:
//     https://www.leasestack.co/api/oauth/google-ads/callback
//     https://www.leasestack.co/api/oauth/gsc/callback
//     https://www.leasestack.co/api/oauth/ga4/callback
//   Meta App Dashboard → Facebook Login → Valid OAuth Redirect URIs:
//     https://www.leasestack.co/api/oauth/meta-ads/callback
// ---------------------------------------------------------------------------

// Canonical provider identifiers. These match `lib/oauth/types.ts` and the
// `OAuthConnection.provider` column. URL paths remain dashed (Next.js route
// folders) — see `providerToRouteSlug()` for the mapping.
export type OAuthProvider = "google_ads" | "meta_ads" | "google_gsc" | "google_ga4";

// URL slugs for the per-provider route folders under app/api/oauth/<slug>/.
// Route folders kept dashed for URL hygiene; switching them to underscored
// would invalidate every OAuth redirect URI already registered in Google
// Cloud Console + Meta App Dashboard.
const ROUTE_SLUG: Record<OAuthProvider, string> = {
  google_ads: "google-ads",
  meta_ads: "meta-ads",
  google_gsc: "gsc",
  google_ga4: "ga4",
};

export function providerToRouteSlug(provider: OAuthProvider): string {
  return ROUTE_SLUG[provider];
}

// Inverse mapping for the four route files that pass a literal URL slug to
// the handler. Kept small + explicit instead of a regex parse so a future
// route addition fails the type checker rather than silently slugging wrong.
const FROM_ROUTE_SLUG: Record<string, OAuthProvider> = {
  "google-ads": "google_ads",
  "meta-ads": "meta_ads",
  gsc: "google_gsc",
  ga4: "google_ga4",
};

export function routeSlugToProvider(slug: string): OAuthProvider {
  const provider = FROM_ROUTE_SLUG[slug];
  if (!provider) {
    throw new Error(`Unknown OAuth route slug: ${slug}`);
  }
  return provider;
}

export type ProviderConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  // Some providers (Google) require additional params on the auth URL to get
  // a refresh token back. Meta uses different params on the token exchange.
  extraAuthParams?: Record<string, string>;
};

// Legacy global kill switch. Now only honored when explicitly set to "false"
// to take everything offline (incident response). When unset, per-provider
// readiness via isProviderConfigured() decides whether the button is live.
// Kept exported so existing call sites compile, but new code should prefer
// isProviderConfigured(provider).
export function isOAuthEnabled(): boolean {
  return process.env.OAUTH_ENABLED !== "false";
}

// Per-provider readiness — the real signal. A provider is "ready" when its
// client_id + client_secret are both set AND a state secret exists. The
// callback base URL is allowed to fall back to the request origin in the
// route handler, so it's not part of this check.
export function isProviderConfigured(provider: OAuthProvider): boolean {
  if (
    !process.env.OAUTH_STATE_SECRET ||
    process.env.OAUTH_STATE_SECRET.length < 32
  ) {
    return false;
  }
  switch (provider) {
    case "google_ads":
    case "google_gsc":
    case "google_ga4":
      return !!(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET
      );
    case "meta_ads":
      return !!(
        process.env.META_OAUTH_APP_ID &&
        process.env.META_OAUTH_APP_SECRET
      );
  }
}

// Human-readable reason a provider isn't ready yet. Surfaces in the UI so
// operators understand which credential is missing instead of seeing a
// generic "OAuth disabled".
export function providerReadinessReason(
  provider: OAuthProvider,
): string | null {
  if (isProviderConfigured(provider)) return null;
  if (
    !process.env.OAUTH_STATE_SECRET ||
    process.env.OAUTH_STATE_SECRET.length < 32
  ) {
    return "Awaiting OAUTH_STATE_SECRET (32+ char HMAC key) on the server.";
  }
  switch (provider) {
    case "google_ads":
      return "Awaiting Google Cloud OAuth client credentials. The Google Ads developer token is a separate, longer-running approval — OAuth login itself works as soon as the client_id/secret land.";
    case "google_gsc":
    case "google_ga4":
      return "Awaiting Google Cloud OAuth client credentials.";
    case "meta_ads":
      return "Awaiting Meta App ID + Secret from the Meta Developer dashboard.";
  }
}

// Fallback origin lets the callback URL resolve from the current request if
// OAUTH_CALLBACK_BASE_URL hasn't been pinned in env yet. Production should
// still pin it (the provider dashboards register a single redirect URI), but
// preview/local builds work without the manual step.
export function getCallbackUrl(
  provider: OAuthProvider,
  fallbackOrigin?: string,
): string {
  const explicit = process.env.OAUTH_CALLBACK_BASE_URL;
  // .trim() is defensive — Vercel's env-var UI commonly captures a
  // trailing \n when values get pasted. A newline in the redirect_uri
  // is invisible to humans but Google's OAuth server compares the URI
  // as an exact string and rejects with invalid_request. Same for any
  // other whitespace.
  const raw = (explicit ?? fallbackOrigin ?? "").trim();
  const base = raw.replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Cannot build OAuth callback URL — OAUTH_CALLBACK_BASE_URL not set and no request origin available.",
    );
  }
  return `${base}/api/oauth/${providerToRouteSlug(provider)}/callback`;
}

export function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "OAUTH_STATE_SECRET is missing or too short (need 32+ chars).",
    );
  }
  return secret;
}

export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  switch (provider) {
    case "google_ads":
      return googleConfig([
        "https://www.googleapis.com/auth/adwords",
      ]);
    case "google_gsc":
      return googleConfig([
        "https://www.googleapis.com/auth/webmasters.readonly",
      ]);
    case "google_ga4":
      return googleConfig([
        "https://www.googleapis.com/auth/analytics.readonly",
      ]);
    case "meta_ads":
      return metaConfig(["ads_read", "ads_management"]);
  }
}

function googleConfig(scopes: string[]): ProviderConfig {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not configured.",
    );
  }
  return {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId,
    clientSecret,
    scopes,
    extraAuthParams: {
      access_type: "offline", // request refresh token
      prompt: "consent", // force refresh-token issue every consent
      include_granted_scopes: "true",
    },
  };
}

function metaConfig(scopes: string[]): ProviderConfig {
  const clientId = process.env.META_OAUTH_APP_ID;
  const clientSecret = process.env.META_OAUTH_APP_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "META_OAUTH_APP_ID / META_OAUTH_APP_SECRET not configured.",
    );
  }
  return {
    authorizationUrl: "https://www.facebook.com/v22.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v22.0/oauth/access_token",
    clientId,
    clientSecret,
    scopes,
  };
}

// ---------------------------------------------------------------------------
// State token: HMAC-signed cookie payload of { orgId, returnTo, nonce, exp }.
// Verified in the callback to prevent CSRF. 10-minute TTL.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";
import { safeEqual } from "@/lib/utils/timing-safe";

export type StatePayload = {
  orgId: string;
  returnTo: string;
  nonce: string;
  exp: number; // unix seconds
};

export function signState(payload: StatePayload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState(token: string): StatePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", getStateSecret())
    .update(body)
    .digest("base64url");
  // safeEqual length-checks first — raw timingSafeEqual throws on length
  // mismatch, which would bubble to a 500 + leak the length signal.
  if (!safeEqual(sig, expected)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as StatePayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
