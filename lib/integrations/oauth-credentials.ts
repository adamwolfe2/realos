import "server-only";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  refreshAccessToken as refreshGoogleAccessToken,
} from "@/lib/oauth/google";
import {
  refreshAccessToken as refreshMetaAccessToken,
} from "@/lib/oauth/meta";
import {
  OAuthRefreshError,
  type OAuthProvider,
  type OAuthTokens,
} from "@/lib/oauth/types";

// ---------------------------------------------------------------------------
// OAuth credential resolver consumed by the integration libs (ga4.ts,
// gsc.ts, google-ads.ts, meta-ads.ts).
//
// Pattern:
//   const oauth = await getOAuthCredentials(orgId, "google_ga4");
//   if (oauth) return { type: "oauth", accessToken: oauth.accessToken, ... };
//   return getLegacyCredentials(orgId, ...);  // ← existing paste path
//
// The integration lib NEVER decrypts an OAuth row directly — it goes through
// this helper, which also handles refresh-on-expiry transparently.
// ---------------------------------------------------------------------------

// Google issues 1h tokens with a refresh token, so refresh just before
// expiry. Meta has no refresh token: a long-lived (~60d) token can only be
// re-extended while still valid, so start well before it lapses (syncs run
// every 30 min; 7 days survives a week of outages).
const REFRESH_BUFFER_MS = 60 * 1000;
const META_REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000;

export type ResolvedOAuthCredentials = {
  type: "oauth";
  connectionId: string;
  accessToken: string;        // cleartext, usable in API calls now
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
  externalAccountId: string | null;
  metadata: unknown;
};

/**
 * Look up the active OAuthConnection for (orgId, provider). Refreshes the
 * access token when it's within the provider's buffer of expiring
 * (REFRESH_BUFFER_MS for Google, META_REFRESH_BUFFER_MS for Meta) and
 * persists the new token back to the row. Returns null if no active row
 * exists — caller falls through to the legacy paste-credential path.
 *
 * When externalAccountId is provided, narrows to that specific account row;
 * useful for multi-property tenants. When omitted, returns the most recently
 * updated active row.
 */
export async function getOAuthCredentials(
  orgId: string,
  provider: OAuthProvider,
  externalAccountId?: string | null,
): Promise<ResolvedOAuthCredentials | null> {
  const row = await prisma.oAuthConnection.findFirst({
    where: {
      orgId,
      provider,
      status: "active",
      ...(externalAccountId !== undefined
        ? { externalAccountId }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;

  const needsRefresh =
    row.expiresAt !== null &&
    row.expiresAt.getTime() - Date.now() <
      (provider === "meta_ads" ? META_REFRESH_BUFFER_MS : REFRESH_BUFFER_MS);

  const current = (): ResolvedOAuthCredentials => ({
    type: "oauth",
    connectionId: row.id,
    accessToken: decrypt(row.accessToken),
    refreshToken: row.refreshToken ? decrypt(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    scope: row.scope,
    externalAccountId: row.externalAccountId,
    metadata: row.metadata,
  });

  if (!needsRefresh) return current();

  // Meta re-extends at most once a day; skip repeat calls while the token is
  // still valid so the 7-day window costs ~7 calls, not one per sync.
  const META_RETRY_MS = 24 * 60 * 60 * 1000;
  if (
    provider === "meta_ads" &&
    row.expiresAt !== null &&
    row.expiresAt.getTime() > Date.now() &&
    Date.now() - row.updatedAt.getTime() < META_RETRY_MS
  ) {
    return current();
  }

  let fresh: OAuthTokens;
  try {
    if (provider === "meta_ads") {
      fresh = await refreshMetaAccessToken({
        id: row.id,
        orgId: row.orgId,
        provider: row.provider,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt,
        scope: row.scope,
        externalAccountId: row.externalAccountId,
      });
    } else {
      fresh = await refreshGoogleAccessToken({
        id: row.id,
        orgId: row.orgId,
        provider: row.provider,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt,
        scope: row.scope,
        externalAccountId: row.externalAccountId,
      });
    }
  } catch (err) {
    // Config errors (missing env) are ours: never disconnect tenants for them.
    const permanent = err instanceof OAuthRefreshError && err.permanent;
    const stillValid = !!row.expiresAt && row.expiresAt.getTime() > Date.now();
    console.warn("[oauth] token refresh failed", {
      connectionId: row.id,
      provider,
      permanent,
      stillValid,
      err,
    });
    // Only a provider rejection means the operator must reconnect. A
    // timeout or 5xx must not permanently disconnect the integration.
    if (permanent) {
      // Guarded on the token we tried: a reconnect during the call wrote a
      // new token, and that connection must not be marked needs_reauth.
      const { count } = await prisma.oAuthConnection.updateMany({
        where: { id: row.id, accessToken: row.accessToken },
        data: { status: "needs_reauth" },
      });
      if (count === 0) return reread(orgId, provider, externalAccountId);
      throw err;
    }
    if (stillValid) return current();
    throw err;
  }

  const data = {
    accessToken: encrypt(fresh.accessToken),
    // Google refresh never returns a new refresh_token — keep the existing
    // one. Meta has no refresh_token in either path.
    refreshToken: fresh.refreshToken
      ? encrypt(fresh.refreshToken)
      : row.refreshToken,
    // Meta may omit expires_in; a null would stop all future re-extension.
    expiresAt: fresh.expiresAt ?? row.expiresAt,
    scope: fresh.scope ?? row.scope,
    metadata: (fresh.metadata ?? row.metadata ?? undefined) as object | undefined,
    status: "active",
  };
  // Compare-and-set on the token we refreshed from. A reconnect during the
  // provider call already wrote a newer token; keep it, don't revert it.
  const { count } = await prisma.oAuthConnection.updateMany({
    where: { id: row.id, accessToken: row.accessToken },
    data,
  });
  if (count === 0) return reread(orgId, provider, externalAccountId);

  return {
    type: "oauth",
    connectionId: row.id,
    accessToken: fresh.accessToken,
    refreshToken: data.refreshToken ? decrypt(data.refreshToken) : null,
    expiresAt: data.expiresAt,
    scope: data.scope,
    externalAccountId: row.externalAccountId,
    metadata: data.metadata ?? null,
  };
}

// The row changed under us (reconnect). Return whatever is there now without
// another refresh attempt, so this can never loop.
async function reread(
  orgId: string,
  provider: OAuthProvider,
  externalAccountId?: string | null,
): Promise<ResolvedOAuthCredentials | null> {
  const row = await prisma.oAuthConnection.findFirst({
    where: {
      orgId,
      provider,
      status: "active",
      ...(externalAccountId !== undefined ? { externalAccountId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;
  return {
    type: "oauth",
    connectionId: row.id,
    accessToken: decrypt(row.accessToken),
    refreshToken: row.refreshToken ? decrypt(row.refreshToken) : null,
    expiresAt: row.expiresAt,
    scope: row.scope,
    externalAccountId: row.externalAccountId,
    metadata: row.metadata,
  };
}

/**
 * Convenience: returns true iff there's an active OAuth connection for
 * (orgId, provider). Used by the integration libs to short-circuit fallback
 * lookups when callers want to know "are we on OAuth or legacy?" without
 * actually decrypting the token.
 */
export async function hasActiveOAuthConnection(
  orgId: string,
  provider: OAuthProvider,
): Promise<boolean> {
  const count = await prisma.oAuthConnection.count({
    where: { orgId, provider, status: "active" },
  });
  return count > 0;
}
