import "server-only";
import * as cheerio from "cheerio";
import { prisma } from "@/lib/db";
import { maybeDecrypt } from "@/lib/crypto";
import {
  AppFolioIntegration,
  BackendPlatform,
  LeadSource,
  LeadStatus,
  Prisma,
  Property,
  TourStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// AppFolio integration.
//
// Two modes:
//   1. EMBED_SCRAPE — works today against
//      https://{subdomain}.appfolio.com/listings for any tenant, even without
//      a Plus plan. Parses cheerio-loaded HTML.
//   2. REST — AppFolio Plus/Max exposes a REST API at
//      https://{subdomain}.appfolio.com/api/v1/reports/{report_name}.json
//      that returns paginated JSON. Authenticated with HTTP Basic using the
//      clientId / clientSecret generated from the Developer Portal.
//
// The REST functions below are the canonical path for Plus/Max tenants who
// supply Developer Portal credentials. EMBED_SCRAPE stays as a fallback for
// Core-plan tenants and is left untouched.
// ---------------------------------------------------------------------------

const USER_AGENT =
  "Mozilla/5.0 (compatible; LeaseStack/1.0; +https://leasestack.co)";

export type AppFolioSyncMode = "EMBED_SCRAPE" | "REST";

export type NormalizedListing = {
  backendListingId: string;
  unitType?: string | null;
  unitNumber?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  priceCents?: number | null;
  isAvailable: boolean;
  availableFrom?: Date | null;
  photoUrls?: string[];
  description?: string | null;
  raw: Prisma.InputJsonValue;
};

// ---------------------------------------------------------------------------
// Mode 1, EMBED_SCRAPE — HTML parse of the public listings page.
// ---------------------------------------------------------------------------

function parseRent(input: string): number | null {
  const match = input.trim().match(/\$?([\d,]+)/);
  if (!match) return null;
  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseSqft(input: string): number | null {
  const match = input.match(/(\d{2,5})/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function parseBedBath(
  bedBath: string
): { bedrooms: number | null; bathrooms: number | null } {
  const bedMatch = bedBath.match(/(\d+(?:\.\d+)?)\s*bed/i);
  const bathMatch = bedBath.match(/(\d+(?:\.\d+)?)\s*bath/i);
  return {
    bedrooms: bedMatch ? Number(bedMatch[1]) : null,
    bathrooms: bathMatch ? Number(bathMatch[1]) : null,
  };
}

function parseAvailableDate(input: string): Date | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return null;
  const [, m, d, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  const month = m.padStart(2, "0");
  const day = d.padStart(2, "0");
  const iso = `${year}-${month}-${day}T00:00:00.000Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Lightweight probe for connect-time validation: fetches the public listings
// page and confirms at least one listing card parses. No credentials needed.
export async function probeEmbedScrape(
  subdomain: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const url = `https://${subdomain}.appfolio.com/listings`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `AppFolio listings page returned ${response.status}. Check the subdomain.`,
      };
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const count = $(".listing-item.result.js-listing-item").length;
    return { ok: true, count };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

async function fetchEmbedScrape(
  integration: AppFolioIntegration,
  addressMatch?: string | null
): Promise<NormalizedListing[]> {
  if (!integration.instanceSubdomain) {
    throw new Error("AppFolio instanceSubdomain is required");
  }
  const url = `https://${integration.instanceSubdomain}.appfolio.com/listings`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`AppFolio listings HTML returned ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const normalized: NormalizedListing[] = [];

  $(".listing-item.result.js-listing-item").each((_, el) => {
    const $card = $(el);
    const address = $card.find(".js-listing-address").text().trim();
    if (addressMatch && !address.includes(addressMatch)) return;

    const domId = $card.attr("id") ?? "";
    const id = domId.replace(/^listing_/, "");
    if (!id) return;

    const detailHref = $card.find(".js-link-to-detail").attr("href");
    const applyHref = $card.find(".js-listing-apply").attr("href");

    let uid = "";
    if (applyHref) {
      const uidMatch = applyHref.match(/listable_uid=([a-f0-9-]+)/i);
      if (uidMatch) uid = uidMatch[1];
    }
    if (!uid && detailHref) {
      const uidMatch = detailHref.match(/detail\/([a-f0-9-]+)/i);
      if (uidMatch) uid = uidMatch[1];
    }

    const rentRaw = $card.find(".js-listing-blurb-rent").first().text();
    const rentDollars = parseRent(rentRaw);
    const bedBath = $card
      .find(".js-listing-blurb-bed-bath")
      .first()
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const { bedrooms, bathrooms } = parseBedBath(bedBath);

    let sqft: number | null = null;
    $card.find(".detail-box__item").each((_, item) => {
      const label = $(item).find(".detail-box__label").text().toLowerCase();
      if (label.includes("square feet")) {
        sqft = parseSqft($(item).find(".detail-box__value").text());
      }
    });
    if (sqft === null) {
      sqft = parseSqft($card.find(".js-listing-square-feet").text());
    }

    const availRaw = $card.find(".js-listing-available").first().text().trim();
    const availableFrom = parseAvailableDate(availRaw);

    const title = $card
      .find(".js-listing-title")
      .text()
      .trim()
      .replace(/\s+/g, " ");
    const description = $card
      .find(".js-listing-description")
      .text()
      .trim()
      .replace(/\s+/g, " ");

    const photoSet = new Set<string>();
    const primaryPhoto =
      $card.find(".js-listing-image").attr("data-original") ??
      $card.find(".js-listing-image").attr("src");
    if (primaryPhoto) photoSet.add(primaryPhoto);

    normalized.push({
      backendListingId: uid || id,
      unitType: title || null,
      unitNumber: null,
      bedrooms,
      bathrooms,
      squareFeet: sqft,
      priceCents: rentDollars ? Math.round(rentDollars * 100) : null,
      isAvailable: true,
      availableFrom,
      photoUrls: Array.from(photoSet),
      description,
      raw: {
        source: "embed_scrape",
        appfolioId: id,
        uid,
        address,
        rentDisplay: rentRaw.trim(),
        availRaw,
        detailHref,
        applyHref,
      } as Prisma.InputJsonValue,
    });
  });

  return normalized;
}

// ---------------------------------------------------------------------------
// Mode 2, REST (Plus / Max plan).
//
// AppFolio Reports API v2:
//   POST https://{subdomain}.appfolio.com/api/v2/reports/{report_name}.json
//   Auth: HTTP Basic (clientId:clientSecret from Developer Portal)
//   Body: JSON — date_filters use YYYY-MM-DD format, not MM/DD/YYYY
//   Pagination: response { results, next_page_url } — follow until null
//
// Connection probe uses chart_of_accounts (no required params) to validate
// credentials without needing a valid date range or specific report access.
// ---------------------------------------------------------------------------

// Report names used in our sync. AppFolio v2 report IDs.
//
// `guest_cards` returns one row per individual lead/inquiry — this is what
// we want for the Lead pipeline. `prospect_source_tracking` looks similar
// but is an aggregate ROLLUP by source ("Apartments.com → 270 inquiries"),
// not a list of leads, so it can't drive lead upserts.
//
// `tenant_directory` and `unit_directory` are the directory reports for
// SIGNED attribution and Listing rows respectively. All v2 reports return
// snake_case column keys (e.g., `unit_id`, `property_id`, `market_rent`)
// — the mappers below read snake_case directly.
// Reports we know how to map and persist. AppFolio v2 returns snake_case
// keys on every report.
//
//   guest_cards          — individual leads / inquiries
//   tenant_directory     — current + past tenants (drives Resident roster)
//   unit_directory       — units / availability
//   rent_roll            — active leases with monthly rent + end dates
//   tenant_tickler       — lease end dates / renewal alerts
//   delinquency          — past-due tenants
//   work_order           — maintenance tickets
//   property_directory   — full property metadata (auto-create Property)
const REPORT_NAMES = [
  "guest_cards",
  "tenant_directory",
  "unit_directory",
  "rent_roll",
  "tenant_tickler",
  "delinquency",
  "work_order",
  "property_directory",
] as const;

export type AppFolioReportName = (typeof REPORT_NAMES)[number];

type RestFetchOptions = {
  fromDate?: Date;
  toDate?: Date;
  nextPageUrl?: string | null;
  extraFilters?: Record<string, unknown>;
};

export type RawRow = Record<string, unknown>;

export type AppFolioRestClient = {
  subdomain: string;
  fetchReport(
    reportName: string,
    options?: RestFetchOptions
  ): Promise<{ results: RawRow[]; nextPageUrl: string | null }>;
};

function isoDate(date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function requireSubdomain(integration: Pick<AppFolioIntegration, "instanceSubdomain">): string {
  if (!integration.instanceSubdomain) {
    throw new Error("AppFolio instanceSubdomain is required");
  }
  return integration.instanceSubdomain;
}

function resolveRestCreds(integration: AppFolioIntegration): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = maybeDecrypt(integration.clientIdEncrypted ?? null);
  // Fall back to apiKeyEncrypted if clientSecret isn't populated — historically
  // we stored the secret there before the schema split into id/secret columns.
  const clientSecret =
    maybeDecrypt(integration.clientSecretEncrypted ?? null) ??
    maybeDecrypt(integration.apiKeyEncrypted ?? null);
  if (!clientId || !clientSecret) {
    throw new Error(
      "AppFolio REST mode requires clientId and clientSecret from the Developer Portal. Connect via Settings → Integrations."
    );
  }
  return { clientId, clientSecret };
}

async function doAppFolioPost(
  url: string,
  basic: string,
  body: Record<string, unknown>
): Promise<Response> {
  const opts: RequestInit = {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  };
  let response = await fetch(url, opts);
  // Single retry on 429
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await fetch(url, opts);
  }
  return response;
}

export function appfolioRestClient(
  integration: AppFolioIntegration
): AppFolioRestClient {
  const subdomain = requireSubdomain(integration);
  const { clientId, clientSecret } = resolveRestCreds(integration);
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  async function fetchReport(
    reportName: string,
    options: RestFetchOptions = {}
  ) {
    // Pagination URLs are returned by AppFolio. They are sometimes RELATIVE
    // (e.g. "/api/v2/reports/guest_cards.json?metadata_id=...&page=2") which
    // would make `fetch()` throw "Failed to parse URL". Absolutize against
    // the tenant subdomain, then validate the host stays under .appfolio.com
    // so a compromised pagination URL can't redirect Basic-auth credentials
    // to an attacker-controlled host.
    if (options.nextPageUrl) {
      let absoluteUrl: URL;
      try {
        absoluteUrl = new URL(
          options.nextPageUrl,
          `https://${subdomain}.appfolio.com`
        );
      } catch {
        throw new Error(
          `AppFolio ${reportName} pagination URL invalid: ${options.nextPageUrl}`
        );
      }
      const host = absoluteUrl.hostname.toLowerCase();
      if (!host.endsWith(".appfolio.com")) {
        throw new Error(
          `AppFolio ${reportName} pagination host not allowed: ${host}`
        );
      }
      if (absoluteUrl.protocol !== "https:") {
        throw new Error(
          `AppFolio ${reportName} pagination protocol not allowed: ${absoluteUrl.protocol}`
        );
      }
      const response = await fetch(absoluteUrl.toString(), {
        method: "GET",
        cache: "no-store",
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `AppFolio ${reportName} page returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
        );
      }
      const body = (await response.json()) as {
        results?: RawRow[];
        next_page_url?: string | null;
      };
      return {
        results: Array.isArray(body.results) ? body.results : [],
        nextPageUrl: body.next_page_url ?? null,
      };
    }

    const url = `https://${subdomain}.appfolio.com/api/v2/reports/${reportName}.json`;
    const requestBody: Record<string, unknown> = {
      paginate_results: true,
    };

    if (options.fromDate || options.toDate) {
      requestBody.date_filters = {
        ...(options.fromDate ? { from_date: isoDate(options.fromDate) } : {}),
        ...(options.toDate ? { to_date: isoDate(options.toDate) } : {}),
      };
    }

    if (options.extraFilters) {
      Object.assign(requestBody, options.extraFilters);
    }

    const response = await doAppFolioPost(url, basic, requestBody);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `AppFolio ${reportName} returned ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
      );
    }

    const body = (await response.json()) as {
      results?: RawRow[];
      next_page_url?: string | null;
    };
    return {
      results: Array.isArray(body.results) ? body.results : [],
      nextPageUrl: body.next_page_url ?? null,
    };
  }

  return { subdomain, fetchReport };
}

const MAX_PAGES = 50;

// Regexes that identify "AppFolio's pagination cursor expired" — distinct
// from "this report doesn't exist" or "auth failed". v2 cursors carry a
// metadata_id query param with a ~5-minute TTL; if our sync is slow between
// pages (DB writes between fetches, network jitter), the cursor invalidates
// and the next next_page_url returns 404 (sometimes 410). The initial POST
// to /api/v2/reports/<name>.json never goes through that codepath — those
// errors come from a different message ("AppFolio <name> returned 404…")
// without the literal " page returned " substring, so we won't false-retry
// auth or schema failures here.
const CURSOR_EXPIRED_PATTERNS: RegExp[] = [
  / page returned 404\b/i,
  / page returned 410\b/i,
];

function isCursorExpired(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return CURSOR_EXPIRED_PATTERNS.some((re) => re.test(msg));
}

const PAGE_RETRY_DELAY_MS = 1500;
const MAX_FULL_RETRIES = 1;

// fetchAllPages — pulls a full v2 report by walking next_page_url cursors.
//
// Resilience: if pagination 404s mid-walk (cursor TTL expired upstream), we
// restart the entire report from page 1 once. The fresh POST mints a new
// cursor. Re-fetching the early pages is wasted work, but every consumer
// upsert is keyed on a compound unique index (orgId+externalSystem+
// externalId, propertyId+backendListingId, etc.) so duplicate rows on the
// retry are no-ops. Bounded to one full retry so a genuinely broken report
// (auth, deprecated, schema change) still surfaces as a hard error instead
// of looping.
export async function fetchAllPages(
  client: AppFolioRestClient,
  reportName: string,
  options: { fromDate?: Date; toDate?: Date; extraFilters?: Record<string, unknown> } = {}
): Promise<RawRow[]> {
  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= MAX_FULL_RETRIES) {
    const out: RawRow[] = [];
    let nextPageUrl: string | null = null;
    let pages = 0;

    try {
      do {
        const page = await client.fetchReport(reportName, {
          fromDate: pages === 0 ? options.fromDate : undefined,
          toDate: pages === 0 ? options.toDate : undefined,
          extraFilters: pages === 0 ? options.extraFilters : undefined,
          nextPageUrl,
        });
        out.push(...page.results);
        nextPageUrl = page.nextPageUrl;
        pages += 1;
        if (pages >= MAX_PAGES) {
          console.warn(
            `[appfolio] fetchAllPages(${reportName}) hit MAX_PAGES=${MAX_PAGES}, stopping`
          );
          break;
        }
      } while (nextPageUrl);

      if (attempt > 0) {
        console.log(
          `[appfolio] fetchAllPages(${reportName}) recovered after cursor-expiry retry; ${out.length} rows across ${pages} pages`
        );
      }
      return out;
    } catch (err) {
      lastErr = err;
      if (isCursorExpired(err) && attempt < MAX_FULL_RETRIES) {
        const phase = pages > 0 ? `after ${pages} page(s)` : "before first page";
        console.warn(
          `[appfolio] fetchAllPages(${reportName}) pagination cursor expired ${phase} — restarting from page 1 in ${PAGE_RETRY_DELAY_MS}ms`
        );
        await new Promise((r) => setTimeout(r, PAGE_RETRY_DELAY_MS));
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
  // Unreachable in practice; throw the last seen error so TS narrowing is
  // happy and any future loop logic change can't accidentally swallow it.
  throw lastErr ?? new Error(`AppFolio ${reportName} fetchAllPages failed`);
}

export async function testAppFolioConnection(
  integration: AppFolioIntegration
): Promise<{ ok: true } | { ok: false; error: string }> {
  const subdomain = integration.instanceSubdomain;
  if (!subdomain) return { ok: false, error: "Subdomain is required" };

  let clientId: string;
  let clientSecret: string;
  try {
    const creds = resolveRestCreds(integration);
    clientId = creds.clientId;
    clientSecret = creds.clientSecret;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Missing credentials",
    };
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  // Probe sequence (v2 POST, YYYY-MM-DD dates):
  //   1. chart_of_accounts — no required params, instant 200 if auth is valid
  //   2. prospect_source_tracking with a 30-day window — confirms lead access
  // A 401/403 anywhere = definitive auth failure.
  // A 200 anywhere = success.
  const probes: Array<{ reportName: string; body: Record<string, unknown> }> = [
    { reportName: "chart_of_accounts", body: { paginate_results: true } },
    {
      reportName: "prospect_source_tracking",
      body: {
        paginate_results: true,
        date_filters: {
          from_date: isoDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
          to_date: isoDate(new Date()),
        },
      },
    },
  ];

  let lastError = "Connection test failed";
  for (const probe of probes) {
    const url = `https://${subdomain}.appfolio.com/api/v2/reports/${probe.reportName}.json`;
    let response: Response;
    try {
      response = await doAppFolioPost(url, basic, probe.body);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
      continue;
    }

    if (response.ok) return { ok: true };

    if (response.status === 401 || response.status === 403) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        error: `AppFolio authentication failed (${response.status}). Check your Client ID and Client Secret.${text ? ` Details: ${text.slice(0, 200)}` : ""}`,
      };
    }

    lastError = `AppFolio ${probe.reportName} returned ${response.status}`;
  }

  return { ok: false, error: lastError };
}

// ---------------------------------------------------------------------------
// Pure mappers from raw AppFolio JSON → shapes our sync layer knows how to
// upsert. Pure functions, no DB access, so they're easy to unit-test.
// ---------------------------------------------------------------------------

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n == null ? null : Math.round(n);
}

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string") as string[];
  }
  if (typeof v === "string" && v.length) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const LEAD_SOURCE_LOOKUP: Record<string, LeadSource> = {
  google: LeadSource.GOOGLE_ADS,
  "google ads": LeadSource.GOOGLE_ADS,
  googleads: LeadSource.GOOGLE_ADS,
  facebook: LeadSource.META_ADS,
  meta: LeadSource.META_ADS,
  instagram: LeadSource.META_ADS,
  referral: LeadSource.REFERRAL,
  "word of mouth": LeadSource.REFERRAL,
  organic: LeadSource.ORGANIC,
  direct: LeadSource.DIRECT,
  email: LeadSource.EMAIL_CAMPAIGN,
  chatbot: LeadSource.CHATBOT,
  form: LeadSource.FORM,
  manual: LeadSource.MANUAL,
};

export function mapSourceToEnum(raw: unknown): {
  source: LeadSource;
  sourceDetail: string | null;
} {
  const s = asString(raw);
  if (!s) return { source: LeadSource.OTHER, sourceDetail: null };
  const hit = LEAD_SOURCE_LOOKUP[s.toLowerCase()];
  if (hit) return { source: hit, sourceDetail: s };
  return { source: LeadSource.OTHER, sourceDetail: s };
}

const LEAD_STATUS_LOOKUP: Record<string, LeadStatus> = {
  new: LeadStatus.NEW,
  contacted: LeadStatus.CONTACTED,
  contact: LeadStatus.CONTACTED,
  "tour scheduled": LeadStatus.TOUR_SCHEDULED,
  scheduled: LeadStatus.TOUR_SCHEDULED,
  showing: LeadStatus.TOUR_SCHEDULED,
  toured: LeadStatus.TOURED,
  "tour complete": LeadStatus.TOURED,
  "application sent": LeadStatus.APPLICATION_SENT,
  applying: LeadStatus.APPLICATION_SENT,
  applied: LeadStatus.APPLIED,
  "application submitted": LeadStatus.APPLIED,
  approved: LeadStatus.APPROVED,
  signed: LeadStatus.SIGNED,
  "lease signed": LeadStatus.SIGNED,
  leased: LeadStatus.SIGNED,
  lost: LeadStatus.LOST,
  rejected: LeadStatus.LOST,
  unqualified: LeadStatus.UNQUALIFIED,
};

export function mapStatusToEnum(raw: unknown): LeadStatus {
  const s = asString(raw);
  if (!s) return LeadStatus.NEW;
  return LEAD_STATUS_LOOKUP[s.toLowerCase()] ?? LeadStatus.NEW;
}

const SHOWING_STATUS_LOOKUP: Record<string, TourStatus> = {
  requested: TourStatus.REQUESTED,
  scheduled: TourStatus.SCHEDULED,
  confirmed: TourStatus.SCHEDULED,
  completed: TourStatus.COMPLETED,
  "no show": TourStatus.NO_SHOW,
  "no-show": TourStatus.NO_SHOW,
  cancelled: TourStatus.CANCELLED,
  canceled: TourStatus.CANCELLED,
};

export function mapShowingStatus(raw: unknown): TourStatus {
  const s = asString(raw);
  if (!s) return TourStatus.SCHEDULED;
  return SHOWING_STATUS_LOOKUP[s.toLowerCase()] ?? TourStatus.SCHEDULED;
}

export type MappedLead = {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  source: LeadSource;
  sourceDetail: string | null;
  status: LeadStatus;
  desiredMoveIn: Date | null;
  budgetMaxCents: number | null;
  preferredUnitType: string | null;
  notes: string | null;
  propertyIds: string[];
  unitIds: string[];
  createdAt: Date | null;
  raw: RawRow;
};

// Splits AppFolio's combined "Last, First" name field into parts.
function splitGuestCardName(
  raw: unknown
): { firstName: string | null; lastName: string | null } {
  const s = asString(raw);
  if (!s) return { firstName: null, lastName: null };
  const idx = s.indexOf(",");
  if (idx === -1) return { firstName: s, lastName: null };
  const last = s.slice(0, idx).trim();
  const first = s.slice(idx + 1).trim();
  return { firstName: first || null, lastName: last || null };
}

// Mapper for the `guest_cards` v2 report — individual leads. Snake_case
// keys per the v2 response shape.
export function mapLeadPayload(raw: RawRow): MappedLead | null {
  const externalId = asString(
    raw.guest_card_uuid ?? raw.guest_card_id ?? raw.inquiry_id ?? raw.id
  );
  if (!externalId) return null;

  const { source, sourceDetail } = mapSourceToEnum(raw.source);
  const status = mapStatusToEnum(raw.status);
  const { firstName, lastName } = splitGuestCardName(raw.name);

  const maxRent = asNumber(raw.max_rent);
  const bedBath = asString(raw.bed_bath_preference);

  const propertyIds: string[] = [];
  const singleProp = asString(raw.property_id);
  if (singleProp) propertyIds.push(singleProp);
  const unitIds: string[] = [];
  const unitId = asString(raw.unit_id);
  if (unitId) unitIds.push(unitId);

  return {
    externalId,
    email: asString(raw.email_address)?.toLowerCase() ?? null,
    firstName,
    lastName,
    phone: asString(raw.phone_number),
    source,
    sourceDetail,
    status,
    desiredMoveIn: asDate(raw.move_in_preference),
    budgetMaxCents: maxRent != null ? Math.round(maxRent * 100) : null,
    preferredUnitType: bedBath && bedBath !== "- / -" ? bedBath : null,
    notes: [
      asString(raw.credit_score) ? `Credit score: ${raw.credit_score}` : null,
      asString(raw.monthly_income)
        ? `Monthly income: ${raw.monthly_income}`
        : null,
      asString(raw.pet_preference) ? `Pets: ${raw.pet_preference}` : null,
      asString(raw.last_activity_type)
        ? `Last activity: ${raw.last_activity_type}`
        : null,
      asString(raw.notes) ? String(raw.notes) : null,
    ]
      .filter(Boolean)
      .join(" • ") || null,
    propertyIds,
    unitIds,
    createdAt: asDate(raw.received),
    raw,
  };
}

export type MappedShowing = {
  externalId: string;
  leadExternalId: string | null;
  unitExternalId: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  status: TourStatus;
  notes: string | null;
  assignedUserExternalId: string | null;
  raw: RawRow;
};

export function mapShowingPayload(raw: RawRow): MappedShowing | null {
  const externalId = asString(raw.Id ?? raw.id);
  if (!externalId) return null;
  const status = mapShowingStatus(raw.Status);
  const start = asDate(raw.StartAt ?? raw.ScheduledAt);
  const end = asDate(raw.EndAt ?? raw.CompletedAt);
  return {
    externalId,
    leadExternalId: asString(raw.LeadId),
    unitExternalId: asString(raw.UnitId),
    scheduledAt: start,
    completedAt: status === TourStatus.COMPLETED ? end ?? start : end,
    status,
    notes: asString(raw.Notes),
    assignedUserExternalId: asString(raw.AssignedUserId),
    raw,
  };
}

export type MappedTenant = {
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  unitExternalId: string | null;
  propertyExternalId: string | null;
  raw: RawRow;
};

// Picks the first email from `tenant_directory.emails`, which is a
// comma-separated string when a tenant has multiple addresses on file.
function firstEmail(raw: unknown): string | null {
  const s = asString(raw);
  if (!s) return null;
  const first = s.split(/[,;]/)[0]?.trim();
  return first ? first.toLowerCase() : null;
}

// Mapper for the `tenant_directory` v2 report. Each row represents a
// tenant-occupancy pairing, so the stable identifier is the occupancy
// (a tenant can have multiple occupancies over time).
export function mapTenantPayload(raw: RawRow): MappedTenant | null {
  const externalId = asString(
    raw.occupancy_id ??
      raw.selected_tenant_id ??
      raw.tenant_integration_id ??
      raw.guest_card_id ??
      raw.id
  );
  if (!externalId) return null;
  return {
    externalId,
    email: firstEmail(raw.emails),
    firstName: asString(raw.first_name),
    lastName: asString(raw.last_name),
    companyName: asString(raw.company_name),
    unitExternalId: asString(raw.unit_id),
    propertyExternalId: asString(raw.property_id),
    raw,
  };
}

// "Yes"/"No" coercion for AppFolio's string boolean columns.
function asYesNo(v: unknown): boolean | null {
  const s = asString(v);
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === "yes" || lower === "true" || lower === "y") return true;
  if (lower === "no" || lower === "false" || lower === "n") return false;
  return null;
}

// Mapper for the `unit_directory` v2 report. Snake_case columns; numeric
// id; rent fields can be string ("0.00") or null; sqft is a comma-formatted
// string ("2,680"); availability comes from `rent_ready` ("Yes"/"No").
export function mapListingPayload(raw: RawRow): NormalizedListing | null {
  const externalId = asString(raw.unit_id ?? raw.id ?? raw.rentable_uid);
  if (!externalId) return null;
  const rent = asNumber(raw.market_rent ?? raw.advertised_rent ?? raw.rent);
  const beds = asNumber(raw.bedrooms);
  const baths = asNumber(raw.bathrooms);
  const sqft = asInt(raw.sqft);
  const available = asDate(raw.ready_for_showing_on);
  const description = asString(raw.marketing_description ?? raw.description);
  const rentReady = asYesNo(raw.rent_ready);
  const rentable = asYesNo(raw.rentable);
  const isAvailable =
    rentReady !== null ? rentReady : rentable !== null ? rentable : true;

  return {
    backendListingId: externalId,
    unitType: asString(raw.unit_type),
    unitNumber: asString(raw.unit_name),
    bedrooms: beds,
    bathrooms: baths,
    squareFeet: sqft,
    priceCents: rent != null ? Math.round(rent * 100) : null,
    isAvailable,
    availableFrom: available,
    photoUrls: [],
    description,
    raw: { source: "rest", ...raw } as Prisma.InputJsonValue,
  };
}

// Fetches listings via the REST reports endpoint. Falls back to the
// NormalizedListing shape used by the existing syncListingsForOrg.
async function fetchRest(
  integration: AppFolioIntegration
): Promise<NormalizedListing[]> {
  const client = appfolioRestClient(integration);
  const rows = await fetchAllPages(client, "unit_directory", {
    // unit_directory doesn't strictly require a date window, but AppFolio
    // sometimes 400s without one. Use a wide window.
    fromDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    toDate: new Date(),
    extraFilters: integration.propertyGroupFilter
      ? { property_group: integration.propertyGroupFilter }
      : undefined,
  });
  const normalized: NormalizedListing[] = [];
  for (const row of rows) {
    const mapped = mapListingPayload(row);
    if (mapped) normalized.push(mapped);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// AppFolio mirrored entity mappers.
//
// These five mappers cover the operator-relevant reports the dashboard
// surfaces (residents, leases, delinquency, work orders, properties).
// Every mapper:
//   - returns null when the row is missing the canonical id
//   - reads snake_case keys with fallbacks for AppFolio variants
//   - never mutates the raw row; raw is preserved for the .raw column
// ---------------------------------------------------------------------------

export type MappedResident = {
  externalId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  unitExternalId: string | null;
  propertyExternalId: string | null;
  unitNumber: string | null;
  status: "ACTIVE" | "PAST" | "NOTICE_GIVEN" | "EVICTED" | "APPLICANT";
  moveInDate: Date | null;
  moveOutDate: Date | null;
  noticeGivenDate: Date | null;
  monthlyRentCents: number | null;
  raw: RawRow;
};

function residentStatusFromRaw(raw: RawRow): MappedResident["status"] {
  const s = (asString(raw.status) ?? asString(raw.tenant_status) ?? "")
    .toLowerCase();
  if (s.includes("evict")) return "EVICTED";
  if (s.includes("notice")) return "NOTICE_GIVEN";
  if (s.includes("applicant")) return "APPLICANT";
  if (s === "current" || s === "active") return "ACTIVE";
  if (asDate(raw.move_out)) return "PAST";
  return "ACTIVE";
}

// Mapper for `tenant_directory`. Reused for both Resident roster and the
// existing tenant-signed attribution. The legacy MappedTenant return type
// is kept; this richer mapper is additive.
export function mapResidentPayload(raw: RawRow): MappedResident | null {
  const externalId = asString(
    raw.tenant_id ?? raw.occupancy_id ?? raw.id,
  );
  if (!externalId) return null;

  const firstName = asString(raw.first_name) ?? null;
  const lastName = asString(raw.last_name) ?? null;
  const email = asString(raw.email_address ?? raw.email)?.toLowerCase() ?? null;
  const phone = asString(raw.phone_number ?? raw.phone) ?? null;

  const unitExternalId = asString(raw.unit_id) ?? null;
  const propertyExternalId = asString(raw.property_id) ?? null;
  const unitNumber = asString(raw.unit_name) ?? null;

  const monthlyRent = asNumber(raw.rent ?? raw.monthly_rent ?? raw.market_rent);
  const monthlyRentCents = monthlyRent != null ? Math.round(monthlyRent * 100) : null;

  return {
    externalId,
    firstName,
    lastName,
    email,
    phone,
    unitExternalId,
    propertyExternalId,
    unitNumber,
    status: residentStatusFromRaw(raw),
    moveInDate: asDate(raw.move_in ?? raw.move_in_date) ?? null,
    moveOutDate: asDate(raw.move_out ?? raw.move_out_date) ?? null,
    noticeGivenDate: asDate(raw.notice_given_date ?? raw.notice_date) ?? null,
    monthlyRentCents,
    raw,
  };
}

// ---------------------------------------------------------------------------

export type MappedLease = {
  externalId: string;
  residentExternalId: string | null;
  unitExternalId: string | null;
  propertyExternalId: string | null;
  status: "PENDING" | "ACTIVE" | "EXPIRING" | "RENEWED" | "ENDED" | "EVICTED";
  startDate: Date | null;
  endDate: Date | null;
  monthlyRentCents: number | null;
  securityDepositCents: number | null;
  termMonths: number | null;
  raw: RawRow;
};

function leaseStatusFromRaw(raw: RawRow): MappedLease["status"] {
  const s = (asString(raw.status) ?? asString(raw.lease_status) ?? "")
    .toLowerCase();
  if (s.includes("evict")) return "EVICTED";
  if (s === "expired" || s === "ended" || s === "moved out") return "ENDED";
  if (s === "renewed") return "RENEWED";
  if (s === "expiring") return "EXPIRING";
  if (s === "pending" || s === "future") return "PENDING";
  // Heuristic on dates if status is missing
  const end = asDate(raw.end_date ?? raw.lease_end_date);
  if (end) {
    const now = Date.now();
    const days = (end.getTime() - now) / (24 * 60 * 60 * 1000);
    if (days < 0) return "ENDED";
    if (days <= 60) return "EXPIRING";
  }
  return "ACTIVE";
}

// Mapper for `rent_roll` — one row per active lease with monthly rent
// and lease end date. Used for the renewals pipeline and rent-roll KPI.
export function mapLeasePayload(raw: RawRow): MappedLease | null {
  const externalId = asString(
    raw.lease_id ?? raw.occupancy_id ?? raw.id,
  );
  if (!externalId) return null;

  const monthlyRent = asNumber(raw.rent ?? raw.market_rent ?? raw.monthly_rent);
  const security = asNumber(raw.security_deposit ?? raw.deposit);
  const term = asNumber(raw.lease_term ?? raw.term_months);

  // AppFolio's rent_roll v2 report uses snake_case lease_from / lease_to
  // (NOT start_date / end_date as the field names imply). It also exposes
  // move_in / move_out as the actual physical dates a tenant lives in the
  // unit. Fall through every variant so the mapper handles AppFolio's
  // schema drift across plan tiers without losing the renewal pipeline.
  return {
    externalId,
    residentExternalId: asString(raw.tenant_id ?? raw.occupant_id) ?? null,
    unitExternalId: asString(raw.unit_id) ?? null,
    propertyExternalId: asString(raw.property_id) ?? null,
    status: leaseStatusFromRaw(raw),
    startDate:
      asDate(raw.lease_from) ??
      asDate(raw.move_in) ??
      asDate(raw.start_date) ??
      asDate(raw.lease_start_date) ??
      null,
    endDate:
      asDate(raw.lease_to) ??
      asDate(raw.move_out) ??
      asDate(raw.end_date) ??
      asDate(raw.lease_end_date) ??
      null,
    monthlyRentCents: monthlyRent != null ? Math.round(monthlyRent * 100) : null,
    securityDepositCents: security != null ? Math.round(security * 100) : null,
    termMonths: term != null ? Math.round(term) : null,
    raw,
  };
}

// ---------------------------------------------------------------------------

export type MappedDelinquency = {
  leaseExternalId: string;
  currentBalanceCents: number;
  isPastDue: boolean;
  asOf: Date;
};

// Mapper for `delinquency`. Returns balance + flag keyed off lease/occupancy.
// We intentionally don't model an entire DelinquencyRecord row — the data
// is denormalized onto Lease (currentBalanceCents, isPastDue, pastDueAsOf).
export function mapDelinquencyPayload(
  raw: RawRow,
): MappedDelinquency | null {
  const leaseExternalId = asString(
    raw.lease_id ?? raw.occupancy_id ?? raw.tenant_id ?? raw.id,
  );
  if (!leaseExternalId) return null;
  const balance = asNumber(
    raw.balance ?? raw.total_balance ?? raw.amount_due ?? raw.past_due,
  );
  const cents = balance != null ? Math.round(balance * 100) : 0;
  return {
    leaseExternalId,
    currentBalanceCents: cents,
    isPastDue: cents > 0,
    asOf: asDate(raw.as_of ?? raw.report_date) ?? new Date(),
  };
}

// ---------------------------------------------------------------------------

export type MappedWorkOrder = {
  externalId: string;
  workOrderNumber: string | null;
  status:
    | "NEW"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED"
    | "ON_HOLD";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  category: string | null;
  title: string | null;
  description: string | null;
  unitNumber: string | null;
  unitExternalId: string | null;
  propertyExternalId: string | null;
  residentExternalId: string | null;
  vendorName: string | null;
  vendorEmail: string | null;
  reportedAt: Date | null;
  scheduledFor: Date | null;
  completedAt: Date | null;
  estimatedCostCents: number | null;
  actualCostCents: number | null;
  raw: RawRow;
};

function workOrderStatusFromRaw(raw: RawRow): MappedWorkOrder["status"] {
  const s = (asString(raw.status) ?? asString(raw.work_order_status) ?? "")
    .toLowerCase();
  if (s === "new" || s === "open") return "NEW";
  if (s === "scheduled") return "SCHEDULED";
  if (s.includes("progress") || s === "assigned") return "IN_PROGRESS";
  if (s === "completed" || s === "closed" || s === "done") return "COMPLETED";
  if (s === "cancelled" || s === "canceled") return "CANCELLED";
  if (s.includes("hold")) return "ON_HOLD";
  return "NEW";
}

function workOrderPriorityFromRaw(raw: RawRow): MappedWorkOrder["priority"] {
  const s = (asString(raw.priority) ?? "").toLowerCase();
  if (s === "low") return "LOW";
  if (s === "high") return "HIGH";
  if (s === "urgent" || s === "emergency") return "URGENT";
  return "NORMAL";
}

// Mapper for `work_order` — maintenance tickets.
export function mapWorkOrderPayload(raw: RawRow): MappedWorkOrder | null {
  const externalId = asString(
    raw.work_order_id ?? raw.service_request_id ?? raw.id,
  );
  if (!externalId) return null;

  const estimated = asNumber(raw.estimated_cost ?? raw.estimate);
  const actual = asNumber(raw.actual_cost ?? raw.cost ?? raw.invoice_total);

  return {
    externalId,
    workOrderNumber: asString(raw.work_order_number ?? raw.number) ?? null,
    status: workOrderStatusFromRaw(raw),
    priority: workOrderPriorityFromRaw(raw),
    category: asString(raw.category ?? raw.type) ?? null,
    title: asString(raw.subject ?? raw.title) ?? null,
    description: asString(raw.description ?? raw.notes) ?? null,
    unitNumber: asString(raw.unit_name) ?? null,
    unitExternalId: asString(raw.unit_id) ?? null,
    propertyExternalId: asString(raw.property_id) ?? null,
    residentExternalId:
      asString(raw.tenant_id ?? raw.requested_by_tenant_id) ?? null,
    vendorName: asString(raw.vendor_name ?? raw.assigned_to) ?? null,
    vendorEmail: asString(raw.vendor_email) ?? null,
    reportedAt: asDate(raw.created_on ?? raw.reported_on ?? raw.date_reported) ?? null,
    scheduledFor: asDate(raw.scheduled_for ?? raw.scheduled_date) ?? null,
    completedAt: asDate(raw.completed_on ?? raw.completed_date) ?? null,
    estimatedCostCents: estimated != null ? Math.round(estimated * 100) : null,
    actualCostCents: actual != null ? Math.round(actual * 100) : null,
    raw,
  };
}

// ---------------------------------------------------------------------------

export type MappedProperty = {
  externalId: string;
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  totalUnits: number | null;
  yearBuilt: number | null;
  raw: RawRow;
};

// Mapper for `property_directory`. Used to auto-create Property rows when
// AppFolio reveals new buildings, so the operator doesn't have to add them
// manually before sync runs.
export function mapPropertyPayload(raw: RawRow): MappedProperty | null {
  const externalId = asString(raw.property_id ?? raw.id);
  if (!externalId) return null;
  return {
    externalId,
    name: asString(raw.name ?? raw.property_name) ?? null,
    addressLine1: asString(raw.address_line_1 ?? raw.address) ?? null,
    addressLine2: asString(raw.address_line_2) ?? null,
    city: asString(raw.city) ?? null,
    state: asString(raw.state) ?? null,
    postalCode: asString(raw.postal_code ?? raw.zip) ?? null,
    country: asString(raw.country) ?? "US",
    totalUnits: asInt(raw.unit_count ?? raw.total_units) ?? null,
    yearBuilt: asInt(raw.year_built) ?? null,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Top-level sync. Fetches, matches listings to Property rows by
// `backendPropertyGroup` (case-insensitive), upserts, and refreshes
// Property denorm fields (priceMin, priceMax, availableCount,
// lastSyncedAt).
// ---------------------------------------------------------------------------

export type SyncOutcome = {
  synced: number;
  matchedProperties: number;
  skippedUnknownProperty: number;
  error: string | null;
};

export async function syncListingsForOrg(
  orgId: string,
  options: { force?: boolean } = {}
): Promise<SyncOutcome> {
  const integration = await prisma.appFolioIntegration.findUnique({
    where: { orgId },
  });
  if (!integration) {
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: "No AppFolio integration configured",
    };
  }
  if (!options.force && integration.syncStatus === "syncing") {
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: "Sync already in progress",
    };
  }

  await prisma.appFolioIntegration.update({
    where: { orgId },
    data: { syncStatus: "syncing", lastError: null },
  });

  const properties = await prisma.property.findMany({
    where: { orgId, backendPlatform: BackendPlatform.APPFOLIO },
  });

  try {
    const hasRestCreds = Boolean(
      integration.clientIdEncrypted &&
        (integration.clientSecretEncrypted || integration.apiKeyEncrypted)
    );
    const mode: AppFolioSyncMode = integration.useEmbedFallback
      ? "EMBED_SCRAPE"
      : hasRestCreds
      ? "REST"
      : "EMBED_SCRAPE";

    let remoteListings: NormalizedListing[];
    if (mode === "REST") {
      remoteListings = await fetchRest(integration);
    } else {
      // If the tenant only manages one property, scope the scrape by its
      // street address to avoid sucking in listings from sibling buildings.
      const addressMatch =
        properties.length === 1 ? properties[0].addressLine1 ?? null : null;
      remoteListings = await fetchEmbedScrape(integration, addressMatch);
    }

    const propertyByGroup = new Map<string, Property>();
    for (const p of properties) {
      if (p.backendPropertyGroup) {
        propertyByGroup.set(p.backendPropertyGroup.toLowerCase(), p);
      }
    }

    let synced = 0;
    let skipped = 0;
    const matchedSet = new Set<string>();

    for (const rl of remoteListings) {
      const fallbackProperty = properties[0];
      // TODO: richer property matching once AppFolio payload exposes
      // property_group reliably in embed-scrape mode. For now we assume
      // everything from the scrape lives under the first property — correct
      // for single-building tenants; multi-building tenants fall back to
      // REST mode.
      const property = fallbackProperty;
      if (!property) {
        skipped++;
        continue;
      }

      const listingWhere = {
        propertyId_backendListingId: {
          propertyId: property.id,
          backendListingId: rl.backendListingId,
        },
      } as const;
      const listingData = {
        unitType: rl.unitType ?? null,
        unitNumber: rl.unitNumber ?? null,
        bedrooms: rl.bedrooms ?? null,
        bathrooms: rl.bathrooms ?? null,
        squareFeet: rl.squareFeet ?? null,
        priceCents: rl.priceCents ?? null,
        isAvailable: rl.isAvailable,
        availableFrom: rl.availableFrom ?? null,
        photoUrls: rl.photoUrls
          ? (rl.photoUrls as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        description: rl.description ?? null,
        raw: rl.raw,
        lastSyncedAt: new Date(),
      };
      const existingListing = await prisma.listing.findUnique({ where: listingWhere, select: { id: true } });
      if (existingListing) {
        await prisma.listing.update({ where: listingWhere, data: listingData });
      } else {
        await prisma.listing.create({
          data: { propertyId: property.id, backendListingId: rl.backendListingId, ...listingData },
        });
      }
      matchedSet.add(property.id);
      synced++;
    }

    // Refresh Property denormalized fields.
    for (const p of properties) {
      const agg = await prisma.listing.aggregate({
        where: { propertyId: p.id, isAvailable: true },
        _min: { priceCents: true },
        _max: { priceCents: true },
        _count: { _all: true },
      });
      await prisma.property.update({
        where: { id: p.id },
        data: {
          priceMin: agg._min.priceCents ?? null,
          priceMax: agg._max.priceCents ?? null,
          availableCount: agg._count._all,
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
    }

    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: {
        syncStatus: "idle",
        lastSyncAt: new Date(),
        lastError: null,
      },
    });

    return {
      synced,
      matchedProperties: matchedSet.size,
      skippedUnknownProperty: skipped,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.appFolioIntegration.update({
      where: { orgId },
      data: { syncStatus: "error", lastError: message },
    });
    for (const p of properties) {
      await prisma.property.update({
        where: { id: p.id },
        data: { syncError: message },
      });
    }
    return {
      synced: 0,
      matchedProperties: 0,
      skippedUnknownProperty: 0,
      error: message,
    };
  }
}
