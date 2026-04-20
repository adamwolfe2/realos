import "server-only";
import { maybeDecrypt } from "@/lib/crypto";
import type { AdAccount } from "@prisma/client";

// ---------------------------------------------------------------------------
// Meta (Facebook + Instagram) Marketing API integration, read-only.
//
// Auth model (V1, before OAuth):
//   - System User access token. Generated in Meta Business Manager →
//     Settings → Users → System Users. The system user must be granted
//     "Manage campaigns" or higher access to the target ad account.
//     Tokens can be issued as never-expiring, which is exactly what we
//     want before the OAuth flow lands.
//   - Ad account ID (numeric, e.g. 1234567890; we accept either bare
//     numeric or the act_ prefixed form and normalize).
//
// Pure-fetch implementation against Graph API v22.0. No SDK; the surface we
// touch is small (campaigns + insights) and the SDK pulls in deps that are
// awkward in Edge / serverless cold paths.
// ---------------------------------------------------------------------------

const GRAPH_API_VERSION = "v22.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type MetaAdsCredentials = {
  systemUserAccessToken: string;
};

export type MetaAdsCampaign = {
  externalCampaignId: string;
  name: string;
  status: string;             // ACTIVE | PAUSED | DELETED | ARCHIVED
  objective: string | null;
  dailyBudgetCents: number | null;
  startDate: Date | null;
  endDate: Date | null;
};

export type MetaAdsDailyMetric = {
  externalCampaignId: string;
  date: string;               // YYYY-MM-DD
  impressions: number;
  clicks: number;
  spendCents: number;
  conversions: number;
  conversionValueCents: number;
};

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

export function parseMetaAdsCredentials(
  account: Pick<AdAccount, "credentialsEncrypted">
): MetaAdsCredentials {
  const raw = maybeDecrypt(account.credentialsEncrypted ?? null);
  if (!raw) {
    throw new Error(
      "Meta Ads account has no credentials configured. Reconnect via Settings → Integrations."
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Meta Ads credentials are corrupted. Reconnect to fix.");
  }
  const c = parsed as Partial<MetaAdsCredentials>;
  if (!c.systemUserAccessToken) {
    throw new Error(
      "Meta Ads credentials missing systemUserAccessToken. Reconnect via Settings → Integrations."
    );
  }
  return { systemUserAccessToken: c.systemUserAccessToken };
}

export function normalizeMetaAdAccountId(input: string): string {
  const stripped = input.trim().replace(/^act_/i, "").replace(/[^0-9]/g, "");
  return stripped;
}

function withActPrefix(id: string): string {
  return id.startsWith("act_") ? id : `act_${id}`;
}

// ---------------------------------------------------------------------------
// Graph API request wrapper, with cursor-based pagination.
// ---------------------------------------------------------------------------

type GraphResponse<T> = {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; type?: string; code?: number };
};

async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T[]> {
  const out: T[] = [];
  const baseParams = new URLSearchParams({ ...params, access_token: token, limit: "100" });
  let url = `${GRAPH_API_BASE}/${path}?${baseParams.toString()}`;

  // Hard cap pages — same idea as the AppFolio MAX_PAGES guardrail.
  let pages = 0;
  const MAX_PAGES = 50;

  while (url && pages < MAX_PAGES) {
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as GraphResponse<T>;
    if (!response.ok || body.error) {
      const message = body.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Meta Graph API error: ${message}`);
    }
    if (Array.isArray(body.data)) out.push(...body.data);
    url = body.paging?.next ?? "";
    pages += 1;
  }
  if (pages >= MAX_PAGES) {
    console.warn(`[meta-ads] graphGet(${path}) hit MAX_PAGES=${MAX_PAGES}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API: probe + campaigns + daily insights
// ---------------------------------------------------------------------------

export async function testMetaAdsConnection(
  creds: MetaAdsCredentials,
  adAccountId: string
): Promise<{ ok: true; currency: string | null; name: string | null } | { ok: false; error: string }> {
  try {
    const accountPath = withActPrefix(normalizeMetaAdAccountId(adAccountId));
    const url = `${GRAPH_API_BASE}/${accountPath}?fields=id,name,currency,account_status&access_token=${encodeURIComponent(
      creds.systemUserAccessToken
    )}`;
    const response = await fetch(url, { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      currency?: string;
      account_status?: number;
      error?: { message?: string };
    };
    if (!response.ok || body.error) {
      return {
        ok: false,
        error: body.error?.message ?? `HTTP ${response.status}`,
      };
    }
    return { ok: true, currency: body.currency ?? null, name: body.name ?? null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}

export async function fetchMetaAdsCampaigns(
  creds: MetaAdsCredentials,
  adAccountId: string
): Promise<MetaAdsCampaign[]> {
  const accountPath = `${withActPrefix(normalizeMetaAdAccountId(adAccountId))}/campaigns`;
  const rows = await graphGet<{
    id: string;
    name: string;
    status: string;
    objective?: string;
    daily_budget?: string;     // returned as string of cents in account currency minor units
    start_time?: string;
    stop_time?: string;
  }>(accountPath, {
    fields: "id,name,status,objective,daily_budget,start_time,stop_time",
  }, creds.systemUserAccessToken);

  return rows.map((r) => ({
    externalCampaignId: r.id,
    name: r.name ?? "(unnamed campaign)",
    status: r.status ?? "UNKNOWN",
    objective: r.objective ?? null,
    // Meta returns daily_budget in minor currency units (cents for USD).
    dailyBudgetCents: r.daily_budget ? Number(r.daily_budget) : null,
    startDate: r.start_time ? new Date(r.start_time) : null,
    endDate: r.stop_time ? new Date(r.stop_time) : null,
  }));
}

export async function fetchMetaAdsDailyMetrics(
  creds: MetaAdsCredentials,
  adAccountId: string,
  startDate: Date,
  endDate: Date
): Promise<MetaAdsDailyMetric[]> {
  const accountPath = `${withActPrefix(normalizeMetaAdAccountId(adAccountId))}/insights`;
  const rows = await graphGet<{
    campaign_id?: string;
    date_start?: string;
    impressions?: string;
    clicks?: string;
    spend?: string;
    actions?: { action_type: string; value: string }[];
    action_values?: { action_type: string; value: string }[];
  }>(accountPath, {
    level: "campaign",
    fields: "campaign_id,date_start,impressions,clicks,spend,actions,action_values",
    time_increment: "1",
    time_range: JSON.stringify({
      since: formatDate(startDate),
      until: formatDate(endDate),
    }),
  }, creds.systemUserAccessToken);

  return rows
    .filter((r) => r.campaign_id && r.date_start)
    .map((r) => {
      // Spend in Meta is reported in account currency, as a decimal string.
      const spendCents = Math.round(Number(r.spend ?? 0) * 100);
      const conversions = sumActions(r.actions, [
        "lead",
        "onsite_conversion.lead_grouped",
        "complete_registration",
        "purchase",
      ]);
      const conversionValueCents = Math.round(
        sumActions(r.action_values, [
          "lead",
          "onsite_conversion.lead_grouped",
          "complete_registration",
          "purchase",
        ]) * 100
      );
      return {
        externalCampaignId: r.campaign_id!,
        date: r.date_start!,
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        spendCents,
        conversions,
        conversionValueCents,
      };
    });
}

function sumActions(
  actions: { action_type: string; value: string }[] | undefined,
  types: string[]
): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions) {
    if (types.includes(a.action_type)) {
      const v = Number(a.value);
      if (Number.isFinite(v)) total += v;
    }
  }
  return total;
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
