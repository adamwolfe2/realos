import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OrgType } from "@prisma/client";
import { getAuthUrl } from "@/lib/oauth/google";
import {
  googleSurfaceToProvider,
  OAuthConfigError,
  type GoogleSurface,
} from "@/lib/oauth/types";
import { captureWithContext } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/oauth/google/connect?surface=ga4|gsc|google_ads
//
// Initiates the unified Google OAuth flow. Requires a Clerk-authenticated
// CLIENT-org session. Builds the Google consent URL with the right scope set
// for the requested surface and 302-redirects.
//
// Today (no GOOGLE_OAUTH_CLIENT_ID set) this errors at runtime with a clear
// message. As soon as the env is added in Vercel, the flow works with no
// code change.
// ---------------------------------------------------------------------------

const VALID_SURFACES: readonly GoogleSurface[] = ["ga4", "gsc", "google_ads"];

function isValidSurface(value: string | null): value is GoogleSurface {
  if (!value) return false;
  return (VALID_SURFACES as readonly string[]).includes(value);
}

function getCallbackUrl(req: NextRequest): string {
  const explicit = process.env.OAUTH_CALLBACK_BASE_URL;
  const origin = explicit ? explicit.replace(/\/$/, "") : new URL(req.url).origin;
  return `${origin}/api/oauth/google/callback`;
}

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
  if (scope.orgType !== OrgType.CLIENT) {
    return NextResponse.json(
      { error: "OAuth connect is initiated from the client portal." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const surface = url.searchParams.get("surface");
  if (!isValidSurface(surface)) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid ?surface — expected one of: ga4, gsc, google_ads.",
      },
      { status: 400 },
    );
  }

  const rawReturnTo = url.searchParams.get("returnTo") ?? "";
  const returnTo =
    rawReturnTo.startsWith("/portal/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/portal/integrations";

  const provider = googleSurfaceToProvider(surface);
  const redirectUri = getCallbackUrl(req);

  let authUrl: string;
  try {
    authUrl = await getAuthUrl(scope.orgId, provider, redirectUri, {
      returnTo,
    });
  } catch (err) {
    if (err instanceof OAuthConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    captureWithContext(err, {
      orgId: scope.orgId,
      route: "oauth/google/connect",
      provider,
    });
    return NextResponse.json(
      { error: "Failed to build Google consent URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(authUrl);
}
