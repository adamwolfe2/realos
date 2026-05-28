import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { exchangeCode } from "@/lib/oauth/meta";
import { persistConnection } from "@/lib/oauth/persist";
import { OAuthConfigError } from "@/lib/oauth/types";
import { captureWithContext } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/oauth/meta/callback?code=...&state=...
//
// Meta calls this after the user grants consent on facebook.com. Same
// pattern as the Google callback: verify state, exchange the short-lived
// code for a long-lived (~60d) token, encrypt + persist, redirect.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    const redirect = new URL("/portal/integrations", url);
    redirect.searchParams.set("oauth_error", errorParam);
    return NextResponse.redirect(redirect.toString());
  }
  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state in OAuth callback." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await exchangeCode(code, state);
  } catch (err) {
    if (err instanceof OAuthConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    captureWithContext(err, {
      orgId: scope.orgId,
      route: "oauth/meta/callback",
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Token exchange failed.",
      },
      { status: 502 },
    );
  }

  if (result.orgId !== scope.orgId) {
    return NextResponse.json(
      { error: "OAuth state orgId does not match current session." },
      { status: 403 },
    );
  }

  try {
    await persistConnection({
      orgId: result.orgId,
      provider: result.provider,
      tokens: result.tokens,
    });
  } catch (err) {
    captureWithContext(err, {
      orgId: scope.orgId,
      route: "oauth/meta/callback",
      provider: result.provider,
    });
    return NextResponse.json(
      { error: "Failed to persist OAuth tokens." },
      { status: 500 },
    );
  }

  const safePath =
    result.returnTo.startsWith("/portal/") &&
    !result.returnTo.startsWith("//")
      ? result.returnTo
      : "/portal/integrations";
  const redirect = new URL(safePath, url);
  redirect.searchParams.set("oauth", `${result.provider}_connected`);
  return NextResponse.redirect(redirect.toString());
}
