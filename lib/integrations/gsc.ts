import "server-only";
import { google } from "googleapis";
import { decrypt } from "@/lib/crypto";
export {
  parseServiceAccountJson,
  type ParsedServiceAccount,
} from "./seo-sa-json";

type JWT = InstanceType<typeof google.auth.JWT>;

// ---------------------------------------------------------------------------
// Google Search Console (Search Analytics API).
//
// Auth: service account JSON pasted by the operator into /portal/seo connect
// flow. Stored encrypted at rest in SeoIntegration.serviceAccountJsonEncrypted.
// The service account email must be granted "Owner" or "Full" access to the
// GSC site (Search Console → Settings → Users and permissions → Add user).
//
// Property identifier accepted formats:
//   - "https://www.telegraphcommons.com/"  (URL-prefix property)
//   - "sc-domain:telegraphcommons.com"     (domain property)
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

function jwtFromEncrypted(encrypted: string): JWT {
  const decrypted = decrypt(encrypted);
  return jwtFromJson(decrypted);
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
        .filter(Boolean)
        .join(", ");
      return {
        ok: false,
        error: `The service account can authenticate but does not have access to "${siteUrl}". Add it as a user in Search Console. ${
          visible ? `Visible sites: ${visible}` : "No sites visible to this service account."
        }`,
      };
    }
    return { ok: true, permissionLevel: matched.permissionLevel ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
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
