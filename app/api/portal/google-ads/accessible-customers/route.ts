import { NextResponse } from "next/server";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
import {
  listAccessibleCustomers,
  type GoogleAdsCredentials,
} from "@/lib/integrations/google-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/portal/google-ads/accessible-customers
//
// Returns the list of Google Ads customers the operator's OAuth refresh
// token can reach. Used by the picker page at /portal/connect/google-ads/select.
//
// Auth: requires a CLIENT-scoped session — operators only. Looks up the
// org's active OAuthConnection row for provider=google_ads, decrypts the
// refresh token via getOAuthCredentials, and calls listAccessibleCustomers
// against the Google Ads REST API.
//
// Failure modes:
//   - 401 / 403 if not authenticated as a client operator
//   - 412 if the org has no active OAuthConnection (operator hasn't OAuthed yet)
//   - 500 if listAccessibleCustomers throws (token expired / scope revoked)
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

  const oauth = await getOAuthCredentials(scope.orgId, "google_ads");
  if (!oauth || !oauth.refreshToken) {
    return NextResponse.json(
      {
        error:
          "Connect Google Ads via OAuth first — no refresh token on file for this org.",
      },
      { status: 412 }
    );
  }

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!developerToken || !oauthClientId || !oauthClientSecret) {
    return NextResponse.json(
      {
        error:
          "Server is missing GOOGLE_ADS_DEVELOPER_TOKEN or Google OAuth client credentials.",
      },
      { status: 500 }
    );
  }

  const creds: GoogleAdsCredentials = {
    developerToken,
    loginCustomerId: null, // resolved per-customer inside listAccessibleCustomers
    refreshToken: oauth.refreshToken,
    oauthClientId,
    oauthClientSecret,
  };

  try {
    const customers = await listAccessibleCustomers(creds);
    return NextResponse.json({ customers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
