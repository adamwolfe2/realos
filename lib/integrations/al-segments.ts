import "server-only";

// AudienceLab segments API client. Used by the AUDIENCE_SYNC product line
// (residential / commercial brokers) to surface segments and stream members
// out to ad accounts, CRMs, or webhooks.
//
// Auth: X-Api-Key header. Default key from CURSIVE_API_KEY; an org-level
// override on Organization.cursiveApiKeyOverride takes precedence when set.
//
// Response shape (segment members): SCREAMING_SNAKE_CASE under one of
// `data`, `results`, `items`, `result`, or `resolutions`. We tolerate all.

const AL_BASE = process.env.CURSIVE_API_URL ?? "https://api.audiencelab.io";
const DEFAULT_PAGE_SIZE = 100;
// AL renamed the segment-style API to /audiences for newer accounts. The
// older /segments endpoint exists too but returns 500 / 404 when called
// against an /audiences-style ID. We default to /audiences.
const AL_RESOURCE = "audiences";

export type AlMember = {
  // Stable identity, when present
  profileId?: string;
  uid?: string;
  cookieId?: string;
  hemSha256?: string;

  // PII (may be missing for ANONYMOUS rows)
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;

  // Address bag for geo filtering
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;

  // Anything else AL gave us, kept for downstream consumers
  raw: Record<string, unknown>;
};

export type AlSegmentSummary = {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
  raw: Record<string, unknown>;
};

export type AlListSegmentsOptions = {
  apiKey?: string;
  page?: number;
  pageSize?: number;
};

function resolveApiKey(override?: string | null): string | null {
  return override?.trim() || process.env.CURSIVE_API_KEY?.trim() || null;
}

async function alFetch(
  path: string,
  apiKey: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${AL_BASE}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": apiKey,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function extractItems(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const j = json as Record<string, unknown>;
  const candidates: unknown[] = [
    j.data,
    j.results,
    j.items,
    j.result,
    j.resolutions,
    j.segments,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter(
        (x): x is Record<string, unknown> =>
          typeof x === "object" && x !== null,
      );
    }
  }
  return [];
}

function pickString(
  item: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

function pickNumber(
  item: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export type AlError = { ok: false; status: number; message: string };

export type AlResult<T> = { ok: true; data: T } | AlError;

export async function listAlSegments(
  options: AlListSegmentsOptions = {},
): Promise<AlResult<AlSegmentSummary[]>> {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "AudienceLab API key not configured.",
    };
  }
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const res = await alFetch(
    `/${AL_RESOURCE}?page=${page}&page_size=${pageSize}`,
    apiKey,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: `Segment list failed (${res.status}): ${body.slice(0, 200)}`,
    };
  }
  const json = (await res.json().catch(() => ({}))) as unknown;
  const items = extractItems(json);
  const segments: AlSegmentSummary[] = items.map((item) => ({
    id:
      pickString(item, "id", "segment_id", "SEGMENT_ID", "ID") ??
      pickString(item, "_id") ??
      "",
    name:
      pickString(item, "name", "segment_name", "SEGMENT_NAME", "NAME") ??
      "Untitled segment",
    description:
      pickString(
        item,
        "description",
        "segment_description",
        "DESCRIPTION",
      ) ?? undefined,
    memberCount: pickNumber(
      item,
      "member_count",
      "memberCount",
      "MEMBER_COUNT",
      "size",
      "count",
      "total",
    ),
    createdAt: pickString(item, "created_at", "createdAt", "CREATED_AT"),
    updatedAt: pickString(item, "updated_at", "updatedAt", "UPDATED_AT"),
    raw: item,
  }));
  return { ok: true, data: segments.filter((s) => s.id) };
}

// Validate that a segment ID exists and is reachable with the current key.
// AL doesn't expose a "GET /segments/{id}/metadata" endpoint, so we hit the
// members endpoint with page_size=1 and use the response shape as proof of
// life. Returns the first member's raw payload for downstream metadata
// inference (top_states, email_match_rate, etc. if AL surfaces them at the
// segment level via top-level json keys).
export type AlSegmentValidation = {
  segmentId: string;
  reachable: true;
  hasMembers: boolean;
  // Top-level response keys other than the items array — sometimes AL puts
  // segment metadata here (name, total, schema). Caller can pluck what's
  // useful and store as the cached rawPayload.
  meta: Record<string, unknown>;
};

export async function validateAlSegmentId(
  segmentId: string,
  options: { apiKey?: string } = {},
): Promise<AlResult<AlSegmentValidation>> {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "AudienceLab API key not configured.",
    };
  }
  const res = await alFetch(
    `/${AL_RESOURCE}/${encodeURIComponent(segmentId)}?page=1&page_size=1`,
    apiKey,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message:
        res.status === 404
          ? `Audience "${segmentId}" not found in AudienceLab. Double-check the ID.`
          : res.status === 401 || res.status === 403
            ? `AudienceLab rejected the API key for this audience (${res.status}).`
            : `Audience validation failed (${res.status}): ${body.slice(0, 200)}`,
    };
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // AL's /audiences/{id} returns { status: "NOT_FOUND" } with HTTP 200 when
  // the ID is unknown. Treat that as a 404.
  if (json.status === "NOT_FOUND") {
    return {
      ok: false,
      status: 404,
      message: `Audience "${segmentId}" not found in AudienceLab. Double-check the ID.`,
    };
  }
  const items = extractItems(json);
  // Strip the items array from meta to keep the cached payload small.
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) {
    if (Array.isArray(v)) continue;
    meta[k] = v;
  }
  return {
    ok: true,
    data: {
      segmentId,
      reachable: true,
      hasMembers: items.length > 0,
      meta,
    },
  };
}

export type AlSegmentMembersOptions = {
  apiKey?: string;
  page?: number;
  pageSize?: number;
};

export type AlSegmentMembersPage = {
  members: AlMember[];
  hasMore: boolean;
  nextPage: number;
};

// Fetch one page of members for a segment. Pagination is page-based; AL
// returns a partial last page so we treat `members.length < pageSize` as
// "no more pages" (matches the existing admin-cursive backfill).
export async function getAlSegmentMembersPage(
  segmentId: string,
  options: AlSegmentMembersOptions = {},
): Promise<AlResult<AlSegmentMembersPage>> {
  const apiKey = resolveApiKey(options.apiKey);
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "AudienceLab API key not configured.",
    };
  }
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const res = await alFetch(
    `/${AL_RESOURCE}/${encodeURIComponent(segmentId)}?page=${page}&page_size=${pageSize}`,
    apiKey,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: `Segment fetch failed (${res.status}): ${body.slice(0, 200)}`,
    };
  }
  const json = (await res.json().catch(() => ({}))) as unknown;
  const items = extractItems(json);
  const members = items.map(toAlMember);
  return {
    ok: true,
    data: {
      members,
      hasMore: members.length >= pageSize,
      nextPage: page + 1,
    },
  };
}

// Fetch all pages, capped by maxMembers, applying an optional filter.
// Used by CSV export and webhook push. Geo filter is applied client-side
// because AL segment membership is set-based, not query-able by zip.
export async function streamAlSegmentMembers(
  segmentId: string,
  options: AlSegmentMembersOptions & {
    maxMembers?: number;
    filter?: (m: AlMember) => boolean;
  } = {},
): Promise<AlResult<AlMember[]>> {
  const max = options.maxMembers ?? 5000;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const all: AlMember[] = [];
  let page = options.page ?? 1;
  // Soft cap on page count to prevent runaway loops if AL reports hasMore
  // forever. Tuned for a 5k member soft limit at pageSize=50.
  const maxPages = Math.ceil(max / pageSize) + 5;
  for (let i = 0; i < maxPages; i++) {
    const result = await getAlSegmentMembersPage(segmentId, {
      apiKey: options.apiKey,
      page,
      pageSize,
    });
    if (!result.ok) return result;
    const filtered = options.filter
      ? result.data.members.filter(options.filter)
      : result.data.members;
    for (const m of filtered) {
      if (all.length >= max) break;
      all.push(m);
    }
    if (all.length >= max) break;
    if (!result.data.hasMore) break;
    page = result.data.nextPage;
  }
  return { ok: true, data: all };
}

function toAlMember(item: Record<string, unknown>): AlMember {
  const profileId = pickString(item, "PROFILE_ID", "profile_id", "id");
  const uid = pickString(item, "UID", "uid");
  const cookieId = pickString(item, "COOKIE_ID", "cookie_id");
  // AL's /audiences endpoint surfaces SHA256_PERSONAL_EMAIL (and BUSINESS).
  // Older /segments endpoint used HEM_SHA256. Accept both shapes; prefer the
  // personal email hash, fall back to business if that's all that's present.
  const sha256Personal = pickString(
    item,
    "SHA256_PERSONAL_EMAIL",
    "sha256_personal_email",
  );
  const sha256Business = pickString(
    item,
    "SHA256_BUSINESS_EMAIL",
    "sha256_business_email",
  );
  const hemSha256 =
    pickString(item, "HEM_SHA256", "hem_sha256") ??
    sha256Personal?.split(",")[0]?.trim() ??
    sha256Business?.split(",")[0]?.trim();
  const emailRaw =
    pickString(
      item,
      "PERSONAL_VERIFIED_EMAILS",
      "PERSONAL_EMAIL",
      "PERSONAL_EMAILS",
      "email",
      "EMAIL",
    ) ?? undefined;
  const email = emailRaw?.split(",")[0]?.trim().toLowerCase() || undefined;
  const firstName = pickString(item, "FIRST_NAME", "first_name", "firstName");
  const lastName = pickString(item, "LAST_NAME", "last_name", "lastName");
  const phone = pickString(
    item,
    "MOBILE_PHONE",
    "PERSONAL_PHONE",
    "DIRECT_NUMBER",
    "phone",
  );
  const city = pickString(item, "PERSONAL_CITY", "CITY", "city");
  const state = pickString(item, "PERSONAL_STATE", "STATE", "state");
  const postalCode = pickString(
    item,
    "PERSONAL_ZIP",
    "PERSONAL_ZIP4",
    "ZIP",
    "POSTAL_CODE",
    "postal_code",
    "zipCode",
  );
  const country = pickString(item, "PERSONAL_COUNTRY", "COUNTRY", "country");
  return {
    profileId,
    uid,
    cookieId,
    hemSha256,
    email,
    firstName,
    lastName,
    phone,
    city,
    state,
    postalCode,
    country,
    raw: item,
  };
}

// Geo filter helpers used by the dashboard. Both are lenient: missing
// address fields on a member never match.
export type GeoFilter = {
  zipCodes?: string[];
  states?: string[];
  cities?: string[];
};

export function geoFilterFn(filter: GeoFilter): (m: AlMember) => boolean {
  const zips = new Set(
    (filter.zipCodes ?? []).map((z) => z.trim()).filter(Boolean),
  );
  const states = new Set(
    (filter.states ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  const cities = new Set(
    (filter.cities ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean),
  );
  const empty = !zips.size && !states.size && !cities.size;
  if (empty) return () => true;
  return (m) => {
    if (zips.size) {
      const zip = m.postalCode?.split("-")[0]?.trim();
      if (!zip || !zips.has(zip)) return false;
    }
    if (states.size) {
      const st = m.state?.trim().toUpperCase();
      if (!st || !states.has(st)) return false;
    }
    if (cities.size) {
      const ct = m.city?.trim().toLowerCase();
      if (!ct || !cities.has(ct)) return false;
    }
    return true;
  };
}
