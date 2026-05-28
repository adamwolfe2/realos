import "server-only";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  refreshAccessToken as refreshGoogleAccessToken,
} from "@/lib/oauth/google";
import {
  refreshAccessToken as refreshMetaAccessToken,
} from "@/lib/oauth/meta";
import type { OAuthProvider, OAuthTokens } from "@/lib/oauth/types";

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

const REFRESH_BUFFER_MS = 60 * 1000; // refresh 60s before expiry

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
 * access token if it's expired (or within REFRESH_BUFFER_MS of expiring) and
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
    row.expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh) {
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

  // Refresh path. We swallow the original error and surface a clearer one
  // upstream after marking the row as needing reauth so the UI can prompt.
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
    // Mark the connection so the UI can show a "reconnect" prompt instead of
    // silently failing every sync going forward.
    await prisma.oAuthConnection.update({
      where: { id: row.id },
      data: { status: "needs_reauth" },
    });
    throw err;
  }

  const updated = await prisma.oAuthConnection.update({
    where: { id: row.id },
    data: {
      accessToken: encrypt(fresh.accessToken),
      // Google refresh never returns a new refresh_token — keep the existing
      // one. Meta has no refresh_token in either path.
      refreshToken: fresh.refreshToken
        ? encrypt(fresh.refreshToken)
        : row.refreshToken,
      expiresAt: fresh.expiresAt,
      scope: fresh.scope ?? row.scope,
      metadata: (fresh.metadata ?? row.metadata ?? undefined) as object | undefined,
      status: "active",
    },
  });

  return {
    type: "oauth",
    connectionId: updated.id,
    accessToken: fresh.accessToken,
    refreshToken: updated.refreshToken ? decrypt(updated.refreshToken) : null,
    expiresAt: updated.expiresAt,
    scope: updated.scope,
    externalAccountId: updated.externalAccountId,
    metadata: updated.metadata,
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
