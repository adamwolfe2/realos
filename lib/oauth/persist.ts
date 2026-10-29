import "server-only";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import type { OAuthProvider, OAuthTokens } from "./types";

// ---------------------------------------------------------------------------
// Persistence helpers for OAuthConnection. Token encryption happens here so
// callers never handle the encrypted form directly.
//
// loadDecrypted() inverts the operation for integration libs that need a
// usable accessToken at call time (see lib/integrations/oauth-credentials.ts).
// ---------------------------------------------------------------------------

export type PersistArgs = {
  orgId: string;
  provider: OAuthProvider;
  tokens: OAuthTokens;
};

/**
 * Upsert an OAuthConnection row. The unique key is (orgId, provider,
 * externalAccountId) — when the consent flow doesn't bind a specific account
 * (Google account-level consent, Meta user-level consent), externalAccountId
 * is null and Postgres treats NULL as distinct in the unique index, which
 * means an org can have a null "discovery" row alongside per-account rows.
 */
export async function persistConnection(args: PersistArgs): Promise<{
  id: string;
}> {
  const accessToken = encrypt(args.tokens.accessToken);
  const refreshToken = args.tokens.refreshToken
    ? encrypt(args.tokens.refreshToken)
    : null;

  // Find an existing row to update so we preserve metadata and createdAt.
  const existing = await prisma.oAuthConnection.findFirst({
    where: {
      orgId: args.orgId,
      provider: args.provider,
      externalAccountId: args.tokens.externalAccountId,
    },
    select: { id: true, refreshToken: true },
  });

  if (existing) {
    const updated = await prisma.oAuthConnection.update({
      where: { id: existing.id },
      data: {
        accessToken,
        // Google does not return a new refresh_token on refresh — preserve
        // the existing one when the incoming tokens carry null.
        refreshToken: refreshToken ?? existing.refreshToken,
        expiresAt: args.tokens.expiresAt,
        scope: args.tokens.scope,
        metadata: (args.tokens.metadata ?? undefined) as object | undefined,
        status: "active",
      },
      select: { id: true },
    });
    return updated;
  }

  const created = await prisma.oAuthConnection.create({
    data: {
      orgId: args.orgId,
      provider: args.provider,
      externalAccountId: args.tokens.externalAccountId,
      accessToken,
      refreshToken,
      expiresAt: args.tokens.expiresAt,
      scope: args.tokens.scope,
      metadata: (args.tokens.metadata ?? undefined) as object | undefined,
      status: "active",
    },
    select: { id: true },
  });
  return created;
}
