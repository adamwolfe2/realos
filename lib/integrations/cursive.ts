import "server-only";

// ---------------------------------------------------------------------------
// Cursive pixel integration.
// Cursive is a separate product (Adam owns it). We provision a pixel per
// tenant, install the returned script on the tenant marketing site, and
// ingest visitor events via webhook. We do NOT run our own identity graph.
//
// TODO(Sprint 08 follow-up): verify endpoint paths and payload key casing
// (snake_case vs camelCase) against Cursive's current docs; the structure
// below follows the PRD's reasonable guess. Placeholders are clearly marked.
// ---------------------------------------------------------------------------

const CURSIVE_BASE =
  process.env.CURSIVE_API_URL ?? "https://api.cursive.io/v1";

function authHeaders(): HeadersInit {
  const key = process.env.CURSIVE_API_KEY;
  if (!key) throw new Error("CURSIVE_API_KEY not configured");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export type CursiveProvisionResponse = {
  pixelId: string;
  scriptUrl: string;
  accountId: string;
};

export async function provisionCursivePixel(params: {
  domain: string;
  orgName: string;
  webhookUrl: string;
}): Promise<CursiveProvisionResponse> {
  const res = await fetch(`${CURSIVE_BASE}/pixels`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      domain: params.domain,
      label: params.orgName,
      webhook_url: params.webhookUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cursive provision failed, ${res.status}: ${body}`);
  }
  // DECISION: we accept either camelCase or snake_case payloads and
  // normalize here. Cursive docs TBD.
  const raw = (await res.json()) as Record<string, unknown>;
  const pixelId = String(raw.pixelId ?? raw.pixel_id ?? "");
  const scriptUrl = String(raw.scriptUrl ?? raw.script_url ?? "");
  const accountId = String(raw.accountId ?? raw.account_id ?? "");
  if (!pixelId || !scriptUrl) {
    throw new Error(
      "Cursive provision response missing pixelId or scriptUrl; verify API payload shape."
    );
  }
  return { pixelId, scriptUrl, accountId };
}

export async function archiveCursivePixel(pixelId: string): Promise<void> {
  const res = await fetch(
    `${CURSIVE_BASE}/pixels/${encodeURIComponent(pixelId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    }
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cursive archive failed, ${res.status}: ${body}`);
  }
}

export type CursiveVisitorFetchRow = {
  visitor_id: string;
  visitor_hash?: string;
  identified?: boolean;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  enrichment?: Record<string, unknown>;
  first_seen_at?: string;
  last_seen_at?: string;
  session_count?: number;
  pages_viewed?: Array<{ url: string; ts: string }>;
  total_time_seconds?: number;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

export async function fetchCursiveVisitors(params: {
  pixelId: string;
  since?: Date;
  limit?: number;
}): Promise<CursiveVisitorFetchRow[]> {
  const url = new URL(
    `${CURSIVE_BASE}/pixels/${encodeURIComponent(params.pixelId)}/visitors`
  );
  if (params.since) url.searchParams.set("since", params.since.toISOString());
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cursive fetch failed, ${res.status}: ${body}`);
  }
  const raw = (await res.json()) as { visitors?: CursiveVisitorFetchRow[] };
  return raw.visitors ?? [];
}
