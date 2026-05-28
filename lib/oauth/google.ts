import "server-only";
import {
  OAuthConfigError,
  type OAuthConnectionRecord,
  type OAuthProvider,
  type OAuthTokens,
} from "./types";
import { signState, verifyState } from "./state";
import { decrypt } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Google OAuth helper. Covers GA4, GSC, and Google Ads — all three share the
// same client_id / client_secret and only differ on scopes.
//
// Env at call time:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//
// Missing env → OAuthConfigError thrown by the route handler, surfaced to the
// operator. The build itself never crashes on missing env (env is read inside
// each export, not at module load).
// ---------------------------------------------------------------------------

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

const GOOGLE_PROVIDER_SCOPES: Record<
  Extract<OAuthProvider, "google_ga4" | "google_gsc" | "google_ads">,
  string[]
> = {
  google_ga4: ["https://www.googleapis.com/auth/analytics.readonly"],
  google_gsc: ["https://www.googleapis.com/auth/webmasters.readonly"],
  google_ads: ["https://www.googleapis.com/auth/adwords"],
};

export function getGoogleProviderScopes(provider: OAuthProvider): string[] {
  if (provider === "meta_ads") {
    throw new Error(
      "getGoogleProviderScopes called with non-Google provider: meta_ads",
    );
  }
  return GOOGLE_PROVIDER_SCOPES[provider];
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new OAuthConfigError(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET is not configured — set in Vercel env.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * Build the consent URL the user gets redirected to. The state token embeds
 * orgId + provider + redirectUri + nonce; the callback verifies it before
 * touching the DB.
 */
export async function getAuthUrl(
  orgId: string,
  provider: OAuthProvider,
  redirectUri: string,
  options?: { returnTo?: string; loginHint?: string },
): Promise<string> {
  if (
    provider !== "google_ga4" &&
    provider !== "google_gsc" &&
    provider !== "google_ads"
  ) {
    throw new Error(`Google getAuthUrl called with non-Google provider: ${provider}`);
  }
  const { clientId } = getClientCredentials();
  const scopes = getGoogleProviderScopes(provider);

  const returnTo = options?.returnTo ?? "/portal/integrations";
  const state = signState({ orgId, provider, redirectUri, returnTo });

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline"); // refresh token
  url.searchParams.set("prompt", "consent"); // force refresh token re-issue
  url.searchParams.set("include_granted_scopes", "true");
  if (options?.loginHint) url.searchParams.set("login_hint", options.loginHint);
  return url.toString();
}

/**
 * Exchange the authorization code for tokens. Validates state first; throws on
 * mismatched state, expired state, or upstream token errors. Returned tokens
 * are cleartext — callers encrypt before persisting.
 */
export async function exchangeCode(
  code: string,
  state: string,
): Promise<{
  tokens: OAuthTokens;
  orgId: string;
  provider: OAuthProvider;
  returnTo: string;
}> {
  const payload = verifyState(state);
  if (!payload) {
    throw new OAuthConfigError("OAuth state invalid or expired.");
  }
  if (
    payload.provider !== "google_ga4" &&
    payload.provider !== "google_gsc" &&
    payload.provider !== "google_ads"
  ) {
    throw new OAuthConfigError(
      `OAuth state provider mismatch: expected google_*, got ${payload.provider}`,
    );
  }

  const { clientId, clientSecret } = getClientCredentials();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: payload.redirectUri,
    grant_type: "authorization_code",
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `Google token exchange failed (${resp.status}): ${errText.slice(0, 300)}`,
    );
  }
  const json = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!json.access_token) {
    throw new Error("Google token exchange returned no access_token.");
  }
  const expiresAt = json.expires_in
    ? new Date(Date.now() + json.expires_in * 1000)
    : null;
  return {
    orgId: payload.orgId,
    provider: payload.provider,
    returnTo: payload.returnTo,
    tokens: {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt,
      scope: json.scope ?? null,
      // Google OAuth does NOT bind a specific account in the consent payload
      // (no Property ID, no Customer ID, no GSC site). The UI follows up
      // after the callback to let the user pick which surface to bind.
      externalAccountId: null,
      metadata:
        json.token_type !== undefined
          ? { token_type: json.token_type }
          : undefined,
    },
  };
}

/**
 * Trade a refresh token for a fresh access token. Throws on missing refresh
 * token (operator must re-run the connect flow) or upstream failure.
 */
export async function refreshAccessToken(
  connection: OAuthConnectionRecord,
): Promise<OAuthTokens> {
  if (!connection.refreshToken) {
    throw new OAuthConfigError(
      "OAuth connection has no refresh token — re-run the connect flow.",
    );
  }
  const refreshToken = decrypt(connection.refreshToken);
  const { clientId, clientSecret } = getClientCredentials();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `Google refresh failed (${resp.status}): ${errText.slice(0, 300)}`,
    );
  }
  const json = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!json.access_token) {
    throw new Error("Google refresh returned no access_token.");
  }
  return {
    accessToken: json.access_token,
    // Google does NOT issue a new refresh token on refresh — the existing
    // one keeps working, so we propagate null and callers preserve the
    // existing encrypted refresh_token.
    refreshToken: null,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null,
    scope: json.scope ?? connection.scope,
    externalAccountId: connection.externalAccountId,
    metadata:
      json.token_type !== undefined
        ? { token_type: json.token_type }
        : undefined,
  };
}

/**
 * Call Google's token-revocation endpoint. Best-effort: a 4xx response usually
 * means the token was already revoked or expired, which the caller treats as
 * success.
 */
export async function revoke(
  connection: OAuthConnectionRecord,
): Promise<{ ok: boolean; status: number; warning?: string }> {
  // Prefer revoking the refresh token (revokes the whole grant). Falls back
  // to the access token if there's no refresh token on the record.
  const tokenToRevoke = connection.refreshToken
    ? decrypt(connection.refreshToken)
    : decrypt(connection.accessToken);

  const body = new URLSearchParams({ token: tokenToRevoke });
  const resp = await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (resp.ok) return { ok: true, status: resp.status };
  // 400 invalid_token usually means already-revoked; treat as success.
  const text = await resp.text().catch(() => "");
  if (resp.status === 400 && /invalid_token/i.test(text)) {
    return { ok: true, status: resp.status, warning: "already_revoked" };
  }
  return {
    ok: false,
    status: resp.status,
    warning: text.slice(0, 200),
  };
}
