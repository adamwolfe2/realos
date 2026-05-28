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
// Meta OAuth helper (Facebook Login for Business → Marketing API).
//
// Env at call time:
//   META_APP_ID
//   META_APP_SECRET
//
// Meta does NOT issue a refresh token. Instead, the access token returned by
// the short-lived exchange is then upgraded to a long-lived token (~60 days)
// via fb_exchange_token. We do that swap inside exchangeCode so callers get a
// long-lived token in one shot. refreshAccessToken re-runs the long-lived
// extension if the token is still valid; once it expires the operator must
// re-run the connect flow.
// ---------------------------------------------------------------------------

const GRAPH_VERSION = "v22.0";
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const DEBUG_URL = `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`;

const META_SCOPES = ["ads_read", "ads_management"];

function getClientCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new OAuthConfigError(
      "META_APP_ID / META_APP_SECRET is not configured — set in Vercel env.",
    );
  }
  return { appId, appSecret };
}

/**
 * Build the Facebook Login consent URL.
 */
export async function getAuthUrl(
  orgId: string,
  provider: OAuthProvider,
  redirectUri: string,
  options?: { returnTo?: string },
): Promise<string> {
  if (provider !== "meta_ads") {
    throw new Error(
      `Meta getAuthUrl called with non-Meta provider: ${provider}`,
    );
  }
  const { appId } = getClientCredentials();
  const returnTo = options?.returnTo ?? "/portal/integrations";
  const state = signState({ orgId, provider, redirectUri, returnTo });

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Two-step exchange: code → short-lived access token → long-lived (~60d)
 * access token. Meta doesn't issue refresh tokens; the long-lived token is
 * the closest equivalent.
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
  if (payload.provider !== "meta_ads") {
    throw new OAuthConfigError(
      `OAuth state provider mismatch: expected meta_ads, got ${payload.provider}`,
    );
  }

  const { appId, appSecret } = getClientCredentials();

  // Step 1: short-lived
  const shortLivedUrl = new URL(TOKEN_URL);
  shortLivedUrl.searchParams.set("client_id", appId);
  shortLivedUrl.searchParams.set("client_secret", appSecret);
  shortLivedUrl.searchParams.set("redirect_uri", payload.redirectUri);
  shortLivedUrl.searchParams.set("code", code);
  const shortResp = await fetch(shortLivedUrl.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!shortResp.ok) {
    const errText = await shortResp.text().catch(() => "");
    throw new Error(
      `Meta short-lived token exchange failed (${shortResp.status}): ${errText.slice(0, 300)}`,
    );
  }
  const shortJson = (await shortResp.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!shortJson.access_token) {
    throw new Error("Meta short-lived exchange returned no access_token.");
  }

  // Step 2: long-lived (~60d). If this step fails we still have the
  // short-lived token (~1h) — bubble the error up so the operator can retry.
  const longLivedUrl = new URL(TOKEN_URL);
  longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
  longLivedUrl.searchParams.set("client_id", appId);
  longLivedUrl.searchParams.set("client_secret", appSecret);
  longLivedUrl.searchParams.set("fb_exchange_token", shortJson.access_token);
  const longResp = await fetch(longLivedUrl.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!longResp.ok) {
    const errText = await longResp.text().catch(() => "");
    throw new Error(
      `Meta long-lived token exchange failed (${longResp.status}): ${errText.slice(0, 300)}`,
    );
  }
  const longJson = (await longResp.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!longJson.access_token) {
    throw new Error("Meta long-lived exchange returned no access_token.");
  }
  const expiresAt = longJson.expires_in
    ? new Date(Date.now() + longJson.expires_in * 1000)
    : null;

  return {
    orgId: payload.orgId,
    provider: payload.provider,
    returnTo: payload.returnTo,
    tokens: {
      accessToken: longJson.access_token,
      // Meta has no refresh token. We use a refresh-token slot to store
      // nothing; the long-lived token itself plays both roles.
      refreshToken: null,
      expiresAt,
      scope: META_SCOPES.join(","),
      // Meta's consent does not bind an ad account; the UI follows up.
      externalAccountId: null,
      metadata: {
        token_type: longJson.token_type ?? "bearer",
        long_lived: true,
      },
    },
  };
}

/**
 * Re-extend a still-valid long-lived token. If the token has already expired
 * the call will fail and the operator must re-run the connect flow.
 */
export async function refreshAccessToken(
  connection: OAuthConnectionRecord,
): Promise<OAuthTokens> {
  const currentToken = decrypt(connection.accessToken);
  const { appId, appSecret } = getClientCredentials();

  const url = new URL(TOKEN_URL);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", currentToken);
  const resp = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    throw new Error(
      `Meta token re-extension failed (${resp.status}): ${errText.slice(0, 300)}`,
    );
  }
  const json = (await resp.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new Error("Meta token re-extension returned no access_token.");
  }
  return {
    accessToken: json.access_token,
    refreshToken: null,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null,
    scope: connection.scope ?? META_SCOPES.join(","),
    externalAccountId: connection.externalAccountId,
    metadata: { token_type: json.token_type ?? "bearer", long_lived: true },
  };
}

/**
 * Meta's revoke is a DELETE on /{user-id}/permissions. We need the user id
 * first, which we look up via debug_token using an app access token. Best
 * effort: a non-OK response should be treated as "we tried" — the caller
 * marks the row revoked locally regardless.
 */
export async function revoke(
  connection: OAuthConnectionRecord,
): Promise<{ ok: boolean; status: number; warning?: string }> {
  const { appId, appSecret } = getClientCredentials();
  const userToken = decrypt(connection.accessToken);
  const appAccessToken = `${appId}|${appSecret}`;

  // Look up the user id this token belongs to.
  const debugUrl = new URL(DEBUG_URL);
  debugUrl.searchParams.set("input_token", userToken);
  debugUrl.searchParams.set("access_token", appAccessToken);
  const debugResp = await fetch(debugUrl.toString(), {
    method: "GET",
    cache: "no-store",
  });
  if (!debugResp.ok) {
    return {
      ok: false,
      status: debugResp.status,
      warning: "debug_token lookup failed; row will still be soft-deleted",
    };
  }
  const debugJson = (await debugResp.json()) as {
    data?: { user_id?: string };
  };
  const userId = debugJson.data?.user_id;
  if (!userId) {
    return {
      ok: false,
      status: 200,
      warning: "debug_token returned no user_id; row will still be soft-deleted",
    };
  }

  const revokeUrl = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${userId}/permissions`,
  );
  revokeUrl.searchParams.set("access_token", userToken);
  const revokeResp = await fetch(revokeUrl.toString(), {
    method: "DELETE",
    cache: "no-store",
  });
  if (revokeResp.ok) return { ok: true, status: revokeResp.status };
  const text = await revokeResp.text().catch(() => "");
  return {
    ok: false,
    status: revokeResp.status,
    warning: text.slice(0, 200),
  };
}
