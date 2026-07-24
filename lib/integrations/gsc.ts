import "server-only";
import { google } from "googleapis";
import { decrypt } from "@/lib/crypto";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
export {
  parseServiceAccountJson,
  type ParsedServiceAccount,
} from "./seo-sa-json";

type JWT = InstanceType<typeof google.auth.JWT>;
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;
type GoogleAuth = JWT | OAuth2Client;

// ---------------------------------------------------------------------------
// Google Search Console (Search Analytics API).
//
// Auth: service account JSON pasted by the operator into /portal/seo connect
// flow. Stored encrypted at rest in SeoIntegration.serviceAccountJsonEncrypted.
// The service account email must be granted "Owner" or "Full" access to the
// GSC site (Search Console → Settings → Users and permissions → Add user).
//
// Property identifier accepted formats:
//   - "https://www.example.com/"  (URL-prefix property)
//   - "sc-domain:example.com"     (domain property)
//
// We pull two views:
//   1. By date — totals per day → SeoSnapshot
//   2. By query — top queries per day → SeoQuery
// ---------------------------------------------------------------------------

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

function jwtFromJson(json: string): JWT {
  const credentials = JSON.parse(json) as {
    client_email: string;
    private_key: string;
  };
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
  });
}

// The self-serve /api/oauth/gsc/connect flow (lib/integrations/oauth-handler.ts
// persistTokens) writes a DIFFERENT JSON shape into the same
// serviceAccountJsonEncrypted column: { kind: "oauth", access_token,
// refresh_token, expires_at }. jwtFromJson above expects client_email +
// private_key — fed an oauth blob, credentials.client_email/private_key are
// undefined and the JWT signer throws on every single call. Detect the oauth
// shape here and build a refreshable OAuth2Client instead, so tenants who
// connected via the OAuth button (rather than pasting a service-account key)
// actually sync. GOOGLE_OAUTH_CLIENT_ID/SECRET are guaranteed present here —
// they gate the connect flow itself (oauth-config.ts), so if a row has an
// oauth blob those env vars were already required to create it.
function authFromDecryptedJson(json: string): GoogleAuth {
  const parsed = JSON.parse(json) as
    | { kind: "oauth"; access_token: string; refresh_token: string | null; expires_at: string | null }
    | { client_email: string; private_key: string };
  if ("kind" in parsed && parsed.kind === "oauth") {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        "GSC: stored credentials are an OAuth token but GOOGLE_OAUTH_CLIENT_ID/GOOGLE_OAUTH_CLIENT_SECRET are not configured — cannot refresh the access token.",
      );
    }
    const client = new google.auth.OAuth2(clientId, clientSecret);
    client.setCredentials({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token ?? undefined,
      expiry_date: parsed.expires_at ? new Date(parsed.expires_at).getTime() : undefined,
    });
    return client;
  }
  return jwtFromJson(json);
}

function jwtFromEncrypted(encrypted: string): GoogleAuth {
  const decrypted = decrypt(encrypted);
  return authFromDecryptedJson(decrypted);
}

/**
 * Build an OAuth2 client pre-loaded with credentials from the resolved
 * OAuthConnection row. Used when the operator connected via the
 * /api/oauth/google/connect?surface=gsc self-serve flow instead of pasting a
 * service-account JSON.
 */
function oauth2ClientFromTokens(args: {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}): OAuth2Client {
  const client = new google.auth.OAuth2();
  client.setCredentials({
    access_token: args.accessToken,
    refresh_token: args.refreshToken ?? undefined,
    expiry_date: args.expiresAt ? args.expiresAt.getTime() : undefined,
  });
  return client;
}

/**
 * Resolve a Google auth client for GSC calls. Prefers an OAuthConnection row
 * (self-serve OAuth path), falls back to a service-account JWT built from the
 * encrypted JSON blob (legacy paste path).
 */
export async function resolveGscAuth(
  orgId: string,
  legacyEncryptedJson: string | null,
): Promise<GoogleAuth> {
  const oauth = await getOAuthCredentials(orgId, "google_gsc");
  if (oauth) {
    return oauth2ClientFromTokens({
      accessToken: oauth.accessToken,
      refreshToken: oauth.refreshToken,
      expiresAt: oauth.expiresAt,
    });
  }
  if (!legacyEncryptedJson) {
    throw new Error(
      "GSC: no OAuth connection and no legacy service-account JSON configured for this org.",
    );
  }
  return jwtFromEncrypted(legacyEncryptedJson);
}

export type GscDailyRow = {
  date: string;       // YYYY-MM-DD (UTC)
  clicks: number;
  impressions: number;
  ctr: number;        // 0..1
  position: number;
};

export type GscQueryRow = {
  date: string;       // YYYY-MM-DD
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Probe the connection. Calls sites.list to confirm the credentials work and
// verify the operator's GSC site is actually accessible. Returns the matched
// permission level for friendlier UI.
export async function testGscConnection(
  serviceAccountJson: string,
  siteUrl: string,
): Promise<
  | { ok: true; permissionLevel: string | null }
  | { ok: false; error: string }
> {
  try {
    const auth = jwtFromJson(serviceAccountJson);
    const webmasters = google.webmasters({ version: "v3", auth });
    const sites = await webmasters.sites.list({});
    const matched = sites.data.siteEntry?.find(
      (s) => s.siteUrl === siteUrl,
    );
    if (!matched) {
      const visible = (sites.data.siteEntry ?? [])
        .map((s) => s.siteUrl)
        .filter(Boolean);
      if (visible.length === 0) {
        return {
          ok: false,
          error:
            "Google says the service account has not been added to any Search Console property yet. In Search Console: Settings (gear, bottom of left sidebar) -> Users and permissions -> Add user -> paste the service-account email with Full or Restricted permission. Double-check you added it to the property you pasted above.",
        };
      }
      return {
        ok: false,
        error: `The service account was added to Search Console but not to "${siteUrl}". Confirm the URL exactly matches what GSC shows (including https:// and the trailing slash) OR switch to the sc-domain:example.com form for a domain-level property. Properties visible to this service account right now: ${visible.join(", ")}`,
      };
    }
    return { ok: true, permissionLevel: matched.permissionLevel ?? null };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Unknown error";
    const s = raw.toLowerCase();
    if (s.includes("invalid_grant") || s.includes("unauthorized_client") || s.includes("jwt")) {
      return {
        ok: false,
        error:
          "Google rejected the service account credentials. The stored GOOGLE_SERVICE_ACCOUNT_JSON may be malformed. Contact support so they can re-paste the key.",
      };
    }
    if (s.includes("searchconsole") && s.includes("has not been used")) {
      return {
        ok: false,
        error:
          "The Google Search Console API is not enabled for this service account's project. Enable it in Google Cloud Console, then retry.",
      };
    }
    return { ok: false, error: `Google returned: ${raw}` };
  }
}

// Pull daily totals (clicks/impressions/ctr/position) for a date window.
// dimensions=["date"] aggregates across all queries.
export async function fetchGscDaily(
  encryptedJson: string,
  siteUrl: string,
  fromDate: Date,
  toDate: Date,
): Promise<GscDailyRow[]> {
  const auth = jwtFromEncrypted(encryptedJson);
  const webmasters = google.webmasters({ version: "v3", auth });
  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: ymd(fromDate),
      endDate: ymd(toDate),
      dimensions: ["date"],
      rowLimit: 25000,
      dataState: "all",
    },
  });
  const rows = res.data.rows ?? [];
  return rows.map((r) => ({
    date: (r.keys?.[0] ?? "") as string,
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  }));
}

// Pull per-query totals across the date window. We aggregate to a single row
// per (date, query) so we can store time-series query data. To keep payload
// sizes manageable, we cap at 1000 queries per day.
export async function fetchGscQueriesByDate(
  encryptedJson: string,
  siteUrl: string,
  fromDate: Date,
  toDate: Date,
): Promise<GscQueryRow[]> {
  const auth = jwtFromEncrypted(encryptedJson);
  const webmasters = google.webmasters({ version: "v3", auth });
  const res = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: ymd(fromDate),
      endDate: ymd(toDate),
      dimensions: ["date", "query"],
      rowLimit: 25000,
      dataState: "all",
    },
  });
  const rows = res.data.rows ?? [];
  return rows.map((r) => ({
    date: (r.keys?.[0] ?? "") as string,
    query: (r.keys?.[1] ?? "") as string,
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  }));
}
