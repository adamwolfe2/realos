import { NextRequest, NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { OrgType } from "@prisma/client";
import { getAuthUrl } from "@/lib/oauth/meta";
import { OAuthConfigError } from "@/lib/oauth/types";
import { captureWithContext } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/oauth/meta/connect?surface=meta_ads
//
// Only one Meta surface today (ads). The ?surface= param is still required so
// the URL shape matches /api/oauth/google/connect and W2's UI can render a
// single "Connect" button per surface.
// ---------------------------------------------------------------------------

function getCallbackUrl(req: NextRequest): string {
  const explicit = process.env.OAUTH_CALLBACK_BASE_URL;
  const origin = explicit ? explicit.replace(/\/$/, "") : new URL(req.url).origin;
  return `${origin}/api/oauth/meta/callback`;
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
  if (surface !== "meta_ads") {
    return NextResponse.json(
      { error: "Missing or invalid ?surface — expected: meta_ads." },
      { status: 400 },
    );
  }

  const rawReturnTo = url.searchParams.get("returnTo") ?? "";
  const returnTo =
    rawReturnTo.startsWith("/portal/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/portal/integrations";

  const redirectUri = getCallbackUrl(req);

  let authUrl: string;
  try {
    authUrl = await getAuthUrl(scope.orgId, "meta_ads", redirectUri, {
      returnTo,
    });
  } catch (err) {
    if (err instanceof OAuthConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    captureWithContext(err, {
      orgId: scope.orgId,
      route: "oauth/meta/connect",
    });
    return NextResponse.json(
      { error: "Failed to build Meta consent URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(authUrl);
}
