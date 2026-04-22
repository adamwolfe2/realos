import "server-only";
import { maybeDecrypt } from "@/lib/crypto";
import type { AdAccount } from "@prisma/client";

// ---------------------------------------------------------------------------
// Google Ads (read-only) integration.
//
// Auth model (V1, before OAuth):
//   - developer token             — issued by Google to the agency MCC after
//                                    a one-time application/approval. One token
//                                    works across every tenant we connect.
//   - login customer ID           — the agency MCC that owns access to the
//                                    client account. Optional but required if
//                                    we're a manager account auth-ing into a
//                                    client.
//   - oauth client id + secret    — from the same Google Cloud project that
//                                    issued the developer token.
//   - refresh token               — generated once via the OAuth Playground or
//                                    google-ads-api's `getRefreshToken`. The
//                                    operator pastes the refresh token into
//                                    the connect form. We exchange it for a
//                                    short-lived access token at sync time.
//
// Pure-fetch implementation against Google Ads REST v17. We deliberately do
// NOT pull in the `google-ads-api` npm package — the REST surface is small,
// gRPC adds Edge-incompatible deps, and we want to keep the cold-start fast.
// ---------------------------------------------------------------------------

const GOOGLE_ADS_API_VERSION = "v17";
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleAdsCredentials = {
  developerToken: string;
  loginCustomerId?: string | null;       // Manager (MCC) account ID, no dashes
  refreshToken: string;
  oauthClientId: string;
  oauthClientSecret: string;
};

export type GoogleAdsCampaign = {
  externalCampaignId: string;
  name: string;
  status: string;
  objective: string | null;
  dailyBudgetCents: number | null;
  startDate: Date | null;
  endDate: Date | null;
};

export type GoogleAdsDailyMetric = {
  externalCampaignId: string;
  date: string;                          // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  conversionValueCents: number;
};

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

export function parseGoogleAdsCredentials(
  account: Pick<AdAccount, "credentialsEncrypted">
): GoogleAdsCredentials {
  const raw = maybeDecrypt(account.credentialsEncrypted ?? null);
  if (!raw) {
    throw new Error(
      "Google Ads account has no credentials configured. Reconnect via Settings → Integrations."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Google Ads credentials are corrupted. Reconnect to fix.");
  }
  const c = parsed as Partial<GoogleAdsCredentials>;
  // developerToken and loginCustomerId fall back to agency-level env vars so
  // the connect form only needs per-client fields (refreshToken + customerId).
  const developerToken = c.developerToken ?? process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = c.loginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? null;
  if (!developerToken || !c.refreshToken || !c.oauthClientId || !c.oauthClientSecret) {
    throw new Error(
      "Google Ads credentials are missing required fields. Reconnect via Settings → Integrations."
    );
  }
  return {
    developerToken,
    loginCustomerId,
    refreshToken: c.refreshToken,
    oauthClientId: c.oauthClientId,
    oauthClientSecret: c.oauthClientSecret,
  };
}

export function normalizeCustomerId(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

// ---------------------------------------------------------------------------
// OAuth: refresh-token → access-token
// ---------------------------------------------------------------------------

type AccessTokenCache = { token: string; expiresAt: number };
const ACCESS_TOKEN_CACHE = new Map<string, AccessTokenCache>();

async function getAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const cacheKey = `${creds.oauthClientId}:${creds.refreshToken.slice(0, 20)}`;
  const cached = ACCESS_TOKEN_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const body = new URLSearchParams({
    client_id: creds.oauthClientId,
    client_secret: creds.oauthClientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google OAuth token exchange failed (${response.status}): ${text.slice(0, 200)}`
    );
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Google OAuth response missing access_token");
  }
  const expiresAt = Date.now() + (json.expires_in ?? 3300) * 1000;
  ACCESS_TOKEN_CACHE.set(cacheKey, { token: json.access_token, expiresAt });
  return json.access_token;
}

// ---------------------------------------------------------------------------
// REST request wrapper
// ---------------------------------------------------------------------------

type SearchRequest = {
  customerId: string;
  query: string;
  pageSize?: number;
};

type SearchResponse = {
  results?: unknown[];
  nextPageToken?: string;
};

async function searchStream(
  creds: GoogleAdsCredentials,
  req: SearchRequest
): Promise<unknown[]> {
  const accessToken = await getAccessToken(creds);
  const url = `${GOOGLE_ADS_API_BASE}/customers/${normalizeCustomerId(
    req.customerId
  )}/googleAds:searchStream`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "developer-token": creds.developerToken,
  };
  if (creds.loginCustomerId) {
    headers["login-customer-id"] = normalizeCustomerId(creds.loginCustomerId);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: req.query }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google Ads searchStream returned ${response.status}: ${text.slice(0, 400)}`
    );
  }

  // searchStream returns an array of response chunks, each with .results.
  const chunks = (await response.json()) as SearchResponse[] | SearchResponse;
  const out: unknown[] = [];
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (Array.isArray(chunk.results)) out.push(...chunk.results);
    }
  } else if (Array.isArray(chunks?.results)) {
    out.push(...chunks.results);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API: probe + campaigns + daily metrics
// ---------------------------------------------------------------------------

export async function testGoogleAdsConnection(
  creds: GoogleAdsCredentials,
  customerId: string
): Promise<{ ok: true; currency: string | null } | { ok: false; error: string }> {
  try {
    const rows = await searchStream(creds, {
      customerId,
      query:
        "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
    });
    const row = rows[0] as { customer?: { currencyCode?: string } } | undefined;
    return { ok: true, currency: row?.customer?.currencyCode ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

const MICROS_PER_USD = 1_000_000;
function microsToCents(micros: number | string | null | undefined): number {
  if (micros == null) return 0;
  const n = typeof micros === "string" ? Number(micros) : micros;
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / MICROS_PER_USD) * 100);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function fetchGoogleAdsCampaigns(
  creds: GoogleAdsCredentials,
  customerId: string
): Promise<GoogleAdsCampaign[]> {
  const rows = await searchStream(creds, {
    customerId,
    query: `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign.start_date,
        campaign.end_date,
        campaign_budget.amount_micros
      FROM campaign
    `,
  });

  return rows.map((raw) => {
    const r = raw as {
      campaign?: {
        id?: string;
        name?: string;
        status?: string;
        advertisingChannelType?: string;
        startDate?: string;
        endDate?: string;
      };
      campaignBudget?: { amountMicros?: string | number };
    };
    return {
      externalCampaignId: r.campaign?.id ?? "",
      name: r.campaign?.name ?? "(unnamed campaign)",
      status: r.campaign?.status ?? "UNKNOWN",
      objective: r.campaign?.advertisingChannelType ?? null,
      dailyBudgetCents: r.campaignBudget?.amountMicros
        ? microsToCents(r.campaignBudget.amountMicros)
        : null,
      startDate: asDate(r.campaign?.startDate),
      endDate: asDate(r.campaign?.endDate),
    };
  }).filter((c) => c.externalCampaignId);
}

export async function fetchGoogleAdsDailyMetrics(
  creds: GoogleAdsCredentials,
  customerId: string,
  startDate: Date,
  endDate: Date
): Promise<GoogleAdsDailyMetric[]> {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  const rows = await searchStream(creds, {
    customerId,
    query: `
      SELECT
        campaign.id,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${start}' AND '${end}'
    `,
  });

  return rows.map((raw) => {
    const r = raw as {
      campaign?: { id?: string };
      segments?: { date?: string };
      metrics?: {
        impressions?: string | number;
        clicks?: string | number;
        costMicros?: string | number;
        conversions?: string | number;
        conversionsValue?: string | number;
      };
    };
    return {
      externalCampaignId: r.campaign?.id ?? "",
      date: r.segments?.date ?? "",
      impressions: Math.round(asNumber(r.metrics?.impressions)),
      clicks: Math.round(asNumber(r.metrics?.clicks)),
      spendCents: microsToCents(r.metrics?.costMicros ?? 0),
      conversions: asNumber(r.metrics?.conversions),
      conversionValueCents: Math.round(asNumber(r.metrics?.conversionsValue) * 100),
    };
  }).filter((m) => m.externalCampaignId && m.date);
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
