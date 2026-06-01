import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
import { listMetaAdAccounts } from "@/lib/integrations/meta-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/meta-ads/accessible-accounts
//
// Returns the list of Meta ad accounts the operator's OAuth token can
// reach. Meta equivalent of /api/portal/google-ads/accessible-customers.
// ---------------------------------------------------------------------------
export async function GET() {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const oauth = await getOAuthCredentials(scope.orgId, "meta_ads");
  if (!oauth) {
    return NextResponse.json(
      {
        error:
          "Connect Meta Ads via OAuth first — no token on file for this org.",
      },
      { status: 412 },
    );
  }

  try {
    const accounts = await listMetaAdAccounts({
      systemUserAccessToken: oauth.accessToken,
    });
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
