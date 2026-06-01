import "server-only";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  isOAuthEnabled,
  isProviderConfigured,
  providerReadinessReason,
  getCallbackUrl,
  getProviderConfig,
  signState,
  verifyState,
  type OAuthProvider,
} from "./oauth-config";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OrgType } from "@prisma/client";
import { safeEqual } from "@/lib/utils/timing-safe";

// ---------------------------------------------------------------------------
// Shared OAuth start + callback handlers. The per-provider route files are
// thin wrappers that just pass the provider name in.
// ---------------------------------------------------------------------------

const STATE_COOKIE = "rea_oauth_state";

function disabledResponse(reason: string): NextResponse {
  return NextResponse.json({ ok: false, reason }, { status: 503 });
}

export async function handleOAuthStart(
  req: NextRequest,
  provider: OAuthProvider,
): Promise<NextResponse> {
  // Global kill switch (only set explicitly to "false" during incident).
  if (!isOAuthEnabled()) {
    return disabledResponse(
      "OAuth temporarily disabled by OAUTH_ENABLED=false.",
    );
  }

  // Per-provider readiness — surfaces a specific reason instead of a generic
  // 503. Lets ops + the connect UI explain to operators which credential is
  // still missing (Google Cloud client vs Meta App ID vs OAUTH_STATE_SECRET).
  if (!isProviderConfigured(provider)) {
    return disabledResponse(
      providerReadinessReason(provider) ?? "Provider not configured.",
    );
  }

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

  // Normalize returnTo to a same-origin path. Without this an attacker
  // could phish themselves with ?returnTo=https://attacker.com/fake and
  // the post-callback redirect would honor it. Anything that doesn't
  // start with `/portal/` collapses back to the integrations page.
  const rawReturnTo =
    new URL(req.url).searchParams.get("returnTo") ?? "";
  const returnTo =
    rawReturnTo.startsWith("/portal/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/portal/settings/integrations";

  const state = signState({
    orgId: scope.orgId,
    returnTo,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Math.floor(Date.now() / 1000) + 600, // 10 min
  });

  const authUrl = new URL(config.authorizationUrl);
  authUrl.searchParams.set("client_id", config.clientId);
  // Fall back to the request origin if OAUTH_CALLBACK_BASE_URL isn't pinned.
  // Production should still pin it (the provider dashboards register a single
  // redirect URI), but preview/local works without the manual step.
  authUrl.searchParams.set(
    "redirect_uri",
    getCallbackUrl(provider, new URL(req.url).origin),
  );
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
  if (!isOAuthEnabled()) {
    return disabledResponse(
      "OAuth temporarily disabled by OAUTH_ENABLED=false.",
    );
  }
  if (!isProviderConfigured(provider)) {
    return disabledResponse(
      providerReadinessReason(provider) ?? "Provider not configured.",
    );
  }

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
  // Constant-time compare via safeEqual — defends against timing-side-channel
  // and never throws on length mismatch (the raw `===` worked, but use the
  // shared helper so future signed-token expansions stay safe).
  if (!safeEqual(stateFromQuery, stateFromCookie)) {
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

  // Token exchange. Pass the request origin as fallback for the same reason
  // we do in start — preview/local deploys without OAUTH_CALLBACK_BASE_URL
  // still work, and prod with the env var pinned is unchanged.
  const tokenBody = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: getCallbackUrl(provider, new URL(req.url).origin),
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

  // On-data-arrival insight pass — runs in the background after the OAuth
  // row commits so the user lands on the dashboard with insights already
  // forming. The first sync hasn't fired yet (background cron picks that
  // up), but historical detectors that don't depend on this provider can
  // produce results immediately.
  const { triggerInsightsForOrg } = await import("@/lib/insights/triggers");
  triggerInsightsForOrg(payload.orgId, `${provider}_oauth_callback`);

  // Post-callback redirect:
  //   - google_ads / meta_ads: route to the customer-picker page. The OAuth
  //     token alone isn't enough to start syncing — the operator still
  //     needs to choose which ad account (Google Ads customer ID / Meta
  //     ad account ID) to bind, because the OAuth token may have access
  //     to several.
  //   - gsc / ga4: legacy behavior — back to the integrations settings
  //     page since their property selector lives elsewhere.
  // Defense-in-depth: signed returnTo could in theory be a /portal/ path
  // overriding the default; honor it only if it stays inside /portal/.
  const defaultReturnTo =
    provider === "google_ads"
      ? "/portal/connect/google-ads/select"
      : provider === "meta_ads"
        ? "/portal/connect/meta-ads/select"
        : "/portal/settings/integrations";
  const safePath =
    payload.returnTo.startsWith("/portal/") &&
    !payload.returnTo.startsWith("//")
      ? payload.returnTo
      : defaultReturnTo;
  const redirect = new URL(safePath, url);
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
  const accessTokenEncrypted = encrypt(args.accessToken);
  const refreshTokenEncrypted = args.refreshToken
    ? encrypt(args.refreshToken)
    : null;
  const expiresAt = args.expiresInSec
    ? new Date(Date.now() + args.expiresInSec * 1000)
    : null;

  if (args.provider === "google_ads" || args.provider === "meta_ads") {
    // Canonical store for OAuth credentials is `OAuthConnection`. The
    // customer-picker page reads from this row to enumerate accessible
    // accounts via listAccessibleCustomers (Google) / me/adaccounts (Meta),
    // then writes the chosen externalAccountId back here AND creates the
    // matching `AdAccount` row. We do NOT touch `AdAccount` here — that's
    // the picker's job, because the OAuth token alone doesn't know which
    // customer ID to bind.
    //
    // Unique constraint on OAuthConnection is (orgId, provider, externalAccountId).
    // Initial OAuth row has externalAccountId=null. NULL is "distinct" in
    // Postgres so technically multiple null rows can coexist; we collapse
    // them via findFirst-then-update.
    const existing = await prisma.oAuthConnection.findFirst({
      where: { orgId: args.orgId, provider: args.provider, externalAccountId: null },
      select: { id: true },
    });
    if (existing) {
      await prisma.oAuthConnection.update({
        where: { id: existing.id },
        data: {
          accessToken: accessTokenEncrypted,
          refreshToken: refreshTokenEncrypted,
          expiresAt,
          status: "active",
        },
      });
    } else {
      await prisma.oAuthConnection.create({
        data: {
          orgId: args.orgId,
          provider: args.provider,
          externalAccountId: null,
          accessToken: accessTokenEncrypted,
          refreshToken: refreshTokenEncrypted,
          expiresAt,
          status: "active",
        },
      });
    }
  } else {
    // GSC + GA4 store tokens on SeoIntegration as a JSON blob alongside the
    // existing service-account JSON path. We treat the OAuth payload as the
    // canonical encrypted credential.
    //
    // TODO(2026-06-01): migrate gsc/ga4 to OAuthConnection too. Same
    // unification reasoning as ads, but defer because the SeoIntegration
    // row carries other state (status, property linkage) that's read
    // by neighboring code; needs its own slice.
    const provider = args.provider === "google_gsc" ? "GSC" : "GA4";
    const blob = {
      kind: "oauth" as const,
      access_token: args.accessToken,
      refresh_token: args.refreshToken,
      expires_at: expiresAt?.toISOString() ?? null,
    };
    const encryptedBlob = encrypt(JSON.stringify(blob));
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
