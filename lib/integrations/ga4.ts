import "server-only";
import { google } from "googleapis";
import { decrypt } from "@/lib/crypto";

type JWT = InstanceType<typeof google.auth.JWT>;

// ---------------------------------------------------------------------------
// Google Analytics 4 (Analytics Data API v1beta).
//
// Auth: same service account JSON pattern as GSC, but the service account
// must be added as a "Viewer" on the GA4 property in Admin → Account/Property
// access management.
//
// Property identifier: numeric GA4 property ID, e.g. "338445667". Found in
// GA4 Admin → Property Settings → "Property ID" (do not confuse with the
// G-VHRDHQZP9T measurement ID, that's the data stream tag).
//
// We pull two views:
//   1. By date — organic sessions/users per day → SeoSnapshot
//   2. By landing page — sessions/bounce rate/engagement → SeoLandingPage
// ---------------------------------------------------------------------------

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

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

function normalizePropertyId(raw: string): string {
  // Accept "properties/123" or "123"; always emit "properties/123" for the API.
  const trimmed = raw.trim();
  if (trimmed.startsWith("properties/")) return trimmed;
  return `properties/${trimmed.replace(/[^0-9]/g, "")}`;
}

export type Ga4DailyRow = {
  date: string;       // YYYY-MM-DD
  sessions: number;
  users: number;
};

export type Ga4LandingPageRow = {
  date: string;
  url: string;
  sessions: number;
  users: number;
  bounceRate: number;            // 0..1
  avgEngagementTime: number;     // seconds
};

function ymdFromGa4(value: string): string {
  // GA4 returns "20260418" → "2026-04-18".
  if (value.length !== 8) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function testGa4Connection(
  serviceAccountJson: string,
  propertyId: string,
): Promise<
  | { ok: true; propertyDisplayName: string | null }
  | { ok: false; error: string }
> {
  try {
    const auth = jwtFromJson(serviceAccountJson);
    // Use the Admin API to confirm property access. If we can't reach the
    // admin API we fall back to a tiny Data API query.
    try {
      const admin = google.analyticsadmin({ version: "v1beta", auth });
      const resp = await admin.properties.get({
        name: normalizePropertyId(propertyId),
      });
      return {
        ok: true,
        propertyDisplayName: resp.data.displayName ?? null,
      };
    } catch (adminErr) {
      // Fall back to running a 1-row query against the Data API.
      const data = google.analyticsdata({ version: "v1beta", auth });
      await data.properties.runReport({
        property: normalizePropertyId(propertyId),
        requestBody: {
          dateRanges: [{ startDate: "yesterday", endDate: "yesterday" }],
          metrics: [{ name: "sessions" }],
          limit: "1",
        },
      });
      const reason = adminErr instanceof Error ? adminErr.message : "unknown";
      return {
        ok: true,
        propertyDisplayName: null,
        // Surface the admin-API failure in a hint, but mark connection ok.
        // (The connect form will read propertyDisplayName as a friendly name.)
        ...{ adminWarning: reason },
      } as { ok: true; propertyDisplayName: string | null };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

// Daily organic sessions/users for a date window. Filtered to organic search.
export async function fetchGa4OrganicDaily(
  encryptedJson: string,
  propertyId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Ga4DailyRow[]> {
  const auth = jwtFromEncrypted(encryptedJson);
  const data = google.analyticsdata({ version: "v1beta", auth });
  const resp = await data.properties.runReport({
    property: normalizePropertyId(propertyId),
    requestBody: {
      dateRanges: [{ startDate: ymd(fromDate), endDate: ymd(toDate) }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { matchType: "EXACT", value: "Organic Search" },
        },
      },
      limit: "1000",
    },
  });
  const rows = resp.data.rows ?? [];
  return rows.map((r) => ({
    date: ymdFromGa4((r.dimensionValues?.[0]?.value ?? "") as string),
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
  }));
}

// Landing page performance for organic traffic, broken down by date so the
// "top pages" table can show trends. landingPagePlusQueryString preserves the
// full path; we strip query strings on storage to avoid table cardinality
// blow-up (still useful for top-N display).
export async function fetchGa4OrganicLandingPages(
  encryptedJson: string,
  propertyId: string,
  fromDate: Date,
  toDate: Date,
): Promise<Ga4LandingPageRow[]> {
  const auth = jwtFromEncrypted(encryptedJson);
  const data = google.analyticsdata({ version: "v1beta", auth });
  const resp = await data.properties.runReport({
    property: normalizePropertyId(propertyId),
    requestBody: {
      dateRanges: [{ startDate: ymd(fromDate), endDate: ymd(toDate) }],
      dimensions: [{ name: "date" }, { name: "landingPage" }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
      dimensionFilter: {
        filter: {
          fieldName: "sessionDefaultChannelGroup",
          stringFilter: { matchType: "EXACT", value: "Organic Search" },
        },
      },
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "1000",
    },
  });
  const rows = resp.data.rows ?? [];
  return rows.map((r) => ({
    date: ymdFromGa4((r.dimensionValues?.[0]?.value ?? "") as string),
    url: (r.dimensionValues?.[1]?.value ?? "/") as string,
    sessions: Number(r.metricValues?.[0]?.value ?? 0),
    users: Number(r.metricValues?.[1]?.value ?? 0),
    bounceRate: Number(r.metricValues?.[2]?.value ?? 0),
    avgEngagementTime: Number(r.metricValues?.[3]?.value ?? 0),
  }));
}
