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
//   OAUTH_CALLBACK_BASE_URL       = "https://app.leasestack.co"  (no trailing slash)
//   OAUTH_STATE_SECRET            = 32+ random bytes hex (HMAC for state cookie)
//   GOOGLE_OAUTH_CLIENT_ID        = "...apps.googleusercontent.com"
//   GOOGLE_OAUTH_CLIENT_SECRET    = "GOCSPX-..."
//   META_OAUTH_APP_ID             = "1234567890"
//   META_OAUTH_APP_SECRET         = "abcdef..."
//
// Redirect URLs to register with each provider:
//   Google Cloud Console → OAuth client → Authorized redirect URIs:
//     https://app.leasestack.co/api/oauth/google-ads/callback
//     https://app.leasestack.co/api/oauth/gsc/callback
//     https://app.leasestack.co/api/oauth/ga4/callback
//   Meta App Dashboard → Facebook Login → Valid OAuth Redirect URIs:
//     https://app.leasestack.co/api/oauth/meta-ads/callback
// ---------------------------------------------------------------------------

export type OAuthProvider = "google-ads" | "meta-ads" | "gsc" | "ga4";

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

export function isOAuthEnabled(): boolean {
  return (
    process.env.OAUTH_ENABLED === "true" &&
    !!process.env.OAUTH_CALLBACK_BASE_URL
  );
}

export function getCallbackUrl(provider: OAuthProvider): string {
  const base = (process.env.OAUTH_CALLBACK_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/oauth/${provider}/callback`;
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
    case "google-ads":
      return googleConfig([
        "https://www.googleapis.com/auth/adwords",
      ]);
    case "gsc":
      return googleConfig([
        "https://www.googleapis.com/auth/webmasters.readonly",
      ]);
    case "ga4":
      return googleConfig([
        "https://www.googleapis.com/auth/analytics.readonly",
      ]);
    case "meta-ads":
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
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
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
