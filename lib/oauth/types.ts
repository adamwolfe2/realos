import "server-only";

// ---------------------------------------------------------------------------
// Shared OAuth types for the self-serve connect flow that backs the
// /portal/integrations hub. Tokens persist in OAuthConnection (see
// prisma/schema.prisma). Encryption happens at the persistence boundary via
// lib/crypto.ts; everything in this module deals in cleartext.
//
// W2 owns the UI. W6 (this surface) owns the backend handshake.
// ---------------------------------------------------------------------------

/**
 * Canonical OAuth provider identifiers. These strings are the value stored in
 * OAuthConnection.provider and ARE the contract — never rename them without a
 * data migration.
 *
 *   google_ga4   → Google Analytics 4 (analytics.readonly scope)
 *   google_gsc   → Google Search Console (webmasters.readonly scope)
 *   google_ads   → Google Ads API (adwords scope)
 *   meta_ads     → Meta Marketing API (ads_read + ads_management)
 */
export type OAuthProvider =
  | "google_ga4"
  | "google_gsc"
  | "google_ads"
  | "meta_ads";

export const OAUTH_PROVIDERS: readonly OAuthProvider[] = [
  "google_ga4",
  "google_gsc",
  "google_ads",
  "meta_ads",
] as const;

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Surface identifier for the unified Google connect endpoint. The Google
 * connect route accepts ?surface=ga4|gsc|google_ads and resolves it to the
 * matching OAuthProvider with the right scopes.
 */
export type GoogleSurface = "ga4" | "gsc" | "google_ads";

export function googleSurfaceToProvider(s: GoogleSurface): OAuthProvider {
  switch (s) {
    case "ga4":
      return "google_ga4";
    case "gsc":
      return "google_gsc";
    case "google_ads":
      return "google_ads";
  }
}

/**
 * The cleartext token bundle returned by `exchangeCode` and
 * `refreshAccessToken`. Callers encrypt before writing to the DB.
 */
export type OAuthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  /**
   * Provider-supplied account identifier discovered during the handshake. NULL
   * when the consent flow doesn't reveal a specific account (Google) and the
   * UI must follow up with an account-picker request.
   */
  externalAccountId: string | null;
  /**
   * Provider-specific extras (e.g. Meta long-lived token type). Persisted in
   * OAuthConnection.metadata as-is.
   */
  metadata?: Record<string, unknown>;
};

/**
 * Minimal shape of an OAuthConnection row used by `refreshAccessToken` and
 * `revoke`. Keeping this loose lets callers pass the full Prisma row or a
 * narrowed projection.
 */
export type OAuthConnectionRecord = {
  id: string;
  orgId: string;
  provider: string;
  accessToken: string; // encrypted
  refreshToken: string | null; // encrypted
  expiresAt: Date | null;
  scope: string | null;
  externalAccountId: string | null;
};

/**
 * State payload signed into the OAuth `state` query param. HMAC'd with
 * ENCRYPTION_KEY-derived secret so the callback can trust orgId + provider.
 */
export type OAuthStatePayload = {
  orgId: string;
  provider: OAuthProvider;
  redirectUri: string;
  returnTo: string;
  nonce: string;
  exp: number; // unix seconds
};

/**
 * Thrown when an env var the connect flow requires is missing. Routes catch
 * this and respond with a 503/500 carrying the message verbatim — operators
 * should see exactly which env var to add.
 */
export class OAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthConfigError";
  }
}
