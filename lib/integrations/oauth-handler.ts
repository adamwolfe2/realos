import "server-only";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  isOAuthEnabled,
  getCallbackUrl,
  getProviderConfig,
  signState,
  verifyState,
  type OAuthProvider,
} from "./oauth-config";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OrgType, AdPlatform } from "@prisma/client";

// ---------------------------------------------------------------------------
// Shared OAuth start + callback handlers. The per-provider route files are
// thin wrappers that just pass the provider name in.
// ---------------------------------------------------------------------------

const STATE_COOKIE = "rea_oauth_state";

function disabledResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      reason:
        "OAuth disabled. Set OAUTH_ENABLED=true and OAUTH_CALLBACK_BASE_URL once a production domain is configured.",
    },
    { status: 503 },
  );
}

export async function handleOAuthStart(
  req: NextRequest,
  provider: OAuthProvider,
): Promise<NextResponse> {
  if (!isOAuthEnabled()) return disabledResponse();

  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  if (scope.orgType !== OrgType.CLIENT) {
    return NextResponse.json(
      { error: "OAuth is initiated from the client portal." },
      { status: 403 },
    );
  }

  let config;
  try {
    config = getProviderConfig(provider);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provider misconfigured" },
      { status: 500 },
    );
  }

  const returnTo =
    new URL(req.url).searchParams.get("returnTo") ??
    "/portal/settings/integrations";

  const state = signState({
    orgId: scope.orgId,
    returnTo,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 min
  });

  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", getCallbackUrl(provider));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("state", state);
  for (const [k, v] of Object.entries(config.extraAuthParams ?? {})) {
    authUrl.searchParams.set(k, v);
  }

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 600,
  });
  return res;
}

export async function handleOAuthCallback(
  req: NextRequest,
  provider: OAuthProvider,
): Promise<NextResponse> {
  if (!isOAuthEnabled()) return disabledResponse();

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateFromQuery = url.searchParams.get("state");
  const stateFromCookie = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !stateFromQuery || !stateFromCookie) {
    return NextResponse.json(
      { error: "Missing code or state in OAuth callback." },
      { status: 400 },
    );
  }
  if (stateFromQuery !== stateFromCookie) {
    return NextResponse.json(
      { error: "OAuth state cookie mismatch (possible CSRF)." },
      { status: 400 },
    );
  }
  const payload = verifyState(stateFromQuery);
  if (!payload) {
    return NextResponse.json(
      { error: "OAuth state expired or invalid." },
      { status: 400 },
    );
  }

  let config;
  try {
    config = getProviderConfig(provider);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provider misconfigured" },
      { status: 500 },
    );
  }

  // Token exchange.
  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: getCallbackUrl(provider),
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Token exchange failed (${tokenRes.status}): ${errText.slice(0, 300)}`,
      },
      { status: 502 },
    );
  }
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  if (!tokens.access_token) {
    return NextResponse.json(
      { error: "Token exchange returned no access_token." },
      { status: 502 },
    );
  }

  await persistTokens({
    provider,
    orgId: payload.orgId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresInSec: tokens.expires_in ?? null,
  });

  const redirect = new URL(payload.returnTo, url);
  redirect.searchParams.set("oauth", `${provider}_connected`);
  const res = NextResponse.redirect(redirect.toString());
  res.cookies.delete(STATE_COOKIE);
  return res;
}

async function persistTokens(args: {
  provider: OAuthProvider;
  orgId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number | null;
}): Promise<void> {
  const tokenEncrypted = encrypt(args.accessToken);
  const refreshTokenEncrypted = args.refreshToken
    ? encrypt(args.refreshToken)
    : null;
  const tokenExpiresAt = args.expiresInSec
    ? new Date(Date.now() + args.expiresInSec * 1000)
    : null;

  if (args.provider === "google-ads" || args.provider === "meta-ads") {
    const platform =
      args.provider === "google-ads" ? AdPlatform.GOOGLE_ADS : AdPlatform.META;
    // Upsert AdAccount with placeholder externalAccountId; operator will
    // refine it from the connect form once OAuth completes.
    const existing = await prisma.adAccount.findFirst({
      where: { orgId: args.orgId, platform },
      select: { id: true },
    });
    if (existing) {
      await prisma.adAccount.update({
        where: { id: existing.id },
        data: {
          tokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt,
          accessStatus: "active",
        },
      });
    } else {
      await prisma.adAccount.create({
        data: {
          orgId: args.orgId,
          platform,
          externalAccountId: "PENDING_OAUTH_BIND",
          tokenEncrypted,
          refreshTokenEncrypted,
          tokenExpiresAt,
          accessStatus: "active",
          autoSyncEnabled: true,
        },
      });
    }
  } else {
    // GSC + GA4 store tokens on SeoIntegration as a JSON blob alongside the
    // existing service-account JSON path. We treat the OAuth payload as the
    // canonical encrypted credential.
    const provider = args.provider === "gsc" ? "GSC" : "GA4";
    const blob = {
      kind: "oauth" as const,
      access_token: args.accessToken,
      refresh_token: args.refreshToken,
      expires_at: tokenExpiresAt?.toISOString() ?? null,
    };
    const encryptedBlob = encrypt(JSON.stringify(blob));
    // OAuth flows currently bind to the legacy org-wide row
    // (propertyId = NULL). Per-property OAuth — picking which
    // property the OAuth token applies to mid-flow — would require
    // threading the chosen propertyId through the OAuth state, which
    // is a separate UX project. For now, OAuth stays org-wide.
    const existing = await prisma.seoIntegration.findFirst({
      where: { orgId: args.orgId, propertyId: null, provider },
      select: { id: true },
    });
    if (existing) {
      await prisma.seoIntegration.update({
        where: { id: existing.id },
        data: {
          serviceAccountJsonEncrypted: encryptedBlob,
          status: "IDLE",
        },
      });
    } else {
      await prisma.seoIntegration.create({
        data: {
          orgId: args.orgId,
          propertyId: null,
          provider,
          propertyIdentifier: "PENDING_OAUTH_BIND",
          serviceAccountJsonEncrypted: encryptedBlob,
          status: "IDLE",
        },
      });
    }
  }
}
