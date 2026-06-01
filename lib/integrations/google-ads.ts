import "server-only";
import { maybeDecrypt } from "@/lib/crypto";
import { getOAuthCredentials } from "@/lib/integrations/oauth-credentials";
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
// OAuth-first credential resolution
//
// resolveGoogleAdsCredentials() is the preferred entry point now:
//   1. Look for an OAuthConnection row (orgId, "google_ads") — if present,
//      return a credential bundle backed by the OAuth-issued refresh token.
//   2. Fall through to parseGoogleAdsCredentials() — the legacy paste path
//      that reads AdAccount.credentialsEncrypted. Unchanged.
//
// Existing callers that already pass an AdAccount directly to
// parseGoogleAdsCredentials keep working — nothing about the legacy path
// has changed. New callers should adopt resolveGoogleAdsCredentials so the
// OAuth connect button starts working as soon as W2's UI flips it on.
// ---------------------------------------------------------------------------

export async function resolveGoogleAdsCredentials(
  orgId: string,
  account: Pick<AdAccount, "credentialsEncrypted">,
  options?: { externalAccountId?: string | null },
): Promise<GoogleAdsCredentials> {
  const oauth = await getOAuthCredentials(
    orgId,
    "google_ads",
    options?.externalAccountId,
  );
  if (oauth && oauth.refreshToken) {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error(
        "GOOGLE_ADS_DEVELOPER_TOKEN is not configured. The agency MCC developer token is required for every Google Ads call, even with OAuth-issued user tokens.",
      );
    }
    const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!oauthClientId || !oauthClientSecret) {
      throw new Error(
        "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET is not configured.",
      );
    }
    // loginCustomerId precedence (Google Ads API requires this header when
    // querying a customer that lives under a manager account):
    //   1. OAuthConnection.metadata.loginCustomerId — set by the picker
    //      when the chosen customer is under an MCC. Most accurate.
    //   2. GOOGLE_ADS_LOGIN_CUSTOMER_ID env — legacy global agency MCC.
    //      Stays as a fallback for the BYO-credentials path.
    //   3. null — leaf customers without an MCC need no header.
    const metadata = (oauth.metadata as Record<string, unknown> | null) ?? null;
    const metadataLoginCustomerId =
      metadata && typeof metadata.loginCustomerId === "string"
        ? metadata.loginCustomerId
        : null;
    return {
      developerToken,
      loginCustomerId:
        metadataLoginCustomerId ??
        process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ??
        null,
      refreshToken: oauth.refreshToken,
      oauthClientId,
      oauthClientSecret,
    };
  }
  return parseGoogleAdsCredentials(account);
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

// ---------------------------------------------------------------------------
// listAccessibleCustomers — the customer-picker entry point.
//
// After OAuth completes we have a refresh token but don't yet know which
// Google Ads customer the operator wants to bind to LeaseStack. The OAuth
// user may have access to several (their own client account, an agency MCC
// they collaborate with, etc.). This helper calls the two-step Ads API
// pattern to enumerate them:
//
//   1. customers:listAccessibleCustomers → top-level resource names that
//      this user can reach. Returns ["customers/1234567890", ...].
//   2. For each, run a GAQL query against customer_client (manager-aware) to
//      get descriptive_name, currency_code, manager flag, and the linked
//      child customer ID. If the user picks a manager (MCC), the picker UI
//      lets them drill in to its children — captured via the same loop.
//
// Strategy: do step 1, then probe each ID directly via customer_client. If
// an account is a leaf (non-manager) we still get a row back. If it's a
// manager we get rows for itself + its children, which we flatten.
// ---------------------------------------------------------------------------

export type AccessibleCustomer = {
  customerId: string;          // 10-digit, no dashes
  descriptiveName: string | null;
  currencyCode: string | null;
  isManager: boolean;          // MCC?
  timeZone: string | null;
  // Set when this row was reached as a child of an MCC. Operators who pick
  // this customer must use the MCC ID as `login-customer-id` on every API call.
  loginCustomerId: string | null;
};

type ListAccessibleResponse = {
  resourceNames?: string[];
};

type CustomerClientRow = {
  customerClient?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    manager?: boolean;
    level?: string | number;
    hidden?: boolean;
    status?: string;
  };
};

export async function listAccessibleCustomers(
  creds: GoogleAdsCredentials
): Promise<AccessibleCustomer[]> {
  const accessToken = await getAccessToken(creds);
  // Step 1 — discover top-level reachable customers.
  const topRes = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": creds.developerToken,
      },
      cache: "no-store",
    }
  );
  if (!topRes.ok) {
    const text = await topRes.text().catch(() => "");
    throw new Error(
      `listAccessibleCustomers returned ${topRes.status}: ${text.slice(0, 400)}`
    );
  }
  const topJson = (await topRes.json()) as ListAccessibleResponse;
  const topIds = (topJson.resourceNames ?? [])
    .map((rn) => rn.split("/").pop() ?? "")
    .filter((id) => id.length > 0);

  // Step 2 — for each top-level customer, fetch its self-row + any
  // descendants via customer_client. Failures on individual customers
  // (e.g. permission revoked mid-query) are swallowed per-customer so a
  // single bad row doesn't 500 the whole picker.
  const out: AccessibleCustomer[] = [];
  const seen = new Set<string>();

  for (const topId of topIds) {
    try {
      // For the searchStream call we use topId as both the path customer
      // (the URL segment) and the login-customer-id header so the
      // manager-account scope is properly conveyed. Leaf accounts ignore
      // login-customer-id; manager accounts require it.
      const scopedCreds: GoogleAdsCredentials = {
        ...creds,
        loginCustomerId: topId,
      };
      const rows = await searchStream(scopedCreds, {
        customerId: topId,
        query: `
          SELECT
            customer_client.id,
            customer_client.descriptive_name,
            customer_client.currency_code,
            customer_client.time_zone,
            customer_client.manager,
            customer_client.level,
            customer_client.hidden,
            customer_client.status
          FROM customer_client
          WHERE customer_client.hidden = FALSE
            AND customer_client.status = 'ENABLED'
        `,
      });
      for (const r of rows as CustomerClientRow[]) {
        const cc = r.customerClient;
        if (!cc?.id) continue;
        const id = String(cc.id);
        if (seen.has(id)) continue;
        seen.add(id);
        const isSelf = id === topId;
        out.push({
          customerId: id,
          descriptiveName: cc.descriptiveName ?? null,
          currencyCode: cc.currencyCode ?? null,
          isManager: cc.manager === true,
          timeZone: cc.timeZone ?? null,
          // Self-rows: no MCC scope needed (unless this top is itself a
          // manager, in which case its own ID is also the MCC for
          // children — but for queries against the manager itself, no
          // login-customer-id header is required).
          // Descendant rows: the topId is the MCC they must be scoped through.
          loginCustomerId: isSelf ? null : topId,
        });
      }
    } catch (err) {
      // Permission errors on individual top-level customers are normal —
      // an OAuth user might see ten accounts but only have query access
      // on a subset. Log + continue rather than fail the whole picker.
      console.warn(
        `[listAccessibleCustomers] skipped ${topId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // Stable ordering for the picker UI: managers first (helps agency
  // operators pick the MCC), then by descriptive name.
  out.sort((a, b) => {
    if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
    const an = a.descriptiveName ?? a.customerId;
    const bn = b.descriptiveName ?? b.customerId;
    return an.localeCompare(bn);
  });
  return out;
}

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
