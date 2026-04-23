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
//   1. EMBED_SCRAPE (ported from github.com/adamwolfe2/telegraph-commons),
//      works today against https://{subdomain}.appfolio.com/listings for any
//      tenant, even without the Plus plan. Parses cheerio-loaded HTML.
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
// Mode 1, EMBED_SCRAPE, ported from telegraph-commons/src/lib/appfolio.ts
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

// Report names used in our sync. AppFolio v2 report names may differ from
// v1 — these are the names we pass and the server will 400/404 if wrong.
const REPORT_NAMES = [
  "prospect_source_tracking",
  "showings",
  "tenants",
  "listings",
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
    // Pagination URLs are returned by AppFolio and used verbatim (GET).
    if (options.nextPageUrl) {
      const response = await fetch(options.nextPageUrl, {
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

export async function fetchAllPages(
  client: AppFolioRestClient,
  reportName: string,
  options: { fromDate?: Date; toDate?: Date; extraFilters?: Record<string, unknown> } = {}
): Promise<RawRow[]> {
  const out: RawRow[] = [];
  let nextPageUrl: string | null = null;
  let pages = 0;

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

  return out;
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

export function mapLeadPayload(raw: RawRow): MappedLead | null {
  const externalId = asString(raw.Id ?? raw.id);
  if (!externalId) return null;
  const { source, sourceDetail } = mapSourceToEnum(raw.Source);
  const status = mapStatusToEnum(raw.Status);

  const firstName = asString(raw.FirstName);
  const lastName = asString(raw.LastName);
  const middle = asString(raw.MiddleInitial);

  const maxRent = asNumber(raw.MaxRent);
  const bedrooms = asNumber(raw.Bedrooms);

  const propertyIds = asStringArray(raw.PropertyIds);
  const singleProp = asString(raw.PropertyId);
  if (singleProp && !propertyIds.includes(singleProp)) {
    propertyIds.unshift(singleProp);
  }
  const unitIds = asStringArray(raw.UnitIds);

  return {
    externalId,
    email: asString(raw.Email)?.toLowerCase() ?? null,
    firstName: firstName ?? null,
    lastName: lastName ?? null,
    phone: asString(raw.PhoneNumber),
    source,
    sourceDetail,
    status,
    desiredMoveIn: asDate(raw.DesiredMovein ?? raw.DesiredMoveIn),
    budgetMaxCents: maxRent != null ? Math.round(maxRent * 100) : null,
    preferredUnitType:
      bedrooms != null ? `${bedrooms}-bed` : asString(raw.UnitType),
    notes: [
      middle ? `Middle initial: ${middle}` : null,
      asString(raw.AdditionalOccupants)
        ? `Additional occupants: ${raw.AdditionalOccupants}`
        : null,
      asString(raw.CreditScore)
        ? `Credit score: ${raw.CreditScore}`
        : null,
      asString(raw.MonthlyIncome)
        ? `Monthly income: ${raw.MonthlyIncome}`
        : null,
      raw.HasCats ? "Has cats" : null,
      raw.HasDogs ? "Has dogs" : null,
      raw.HasOtherPet ? "Has other pet" : null,
    ]
      .filter(Boolean)
      .join(" • ") || null,
    propertyIds,
    unitIds,
    createdAt: asDate(raw.CreatedAt),
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

export function mapTenantPayload(raw: RawRow): MappedTenant | null {
  const externalId = asString(raw.Id ?? raw.id);
  if (!externalId) return null;
  return {
    externalId,
    email: asString(raw.Email)?.toLowerCase() ?? null,
    firstName: asString(raw.FirstName),
    lastName: asString(raw.LastName),
    companyName: asString(raw.CompanyName),
    unitExternalId: asString(raw.UnitId),
    propertyExternalId: asString(raw.PropertyId),
    raw,
  };
}

export function mapListingPayload(raw: RawRow): NormalizedListing | null {
  const externalId = asString(raw.Id ?? raw.id ?? raw.ListingId);
  if (!externalId) return null;
  const rent = asNumber(raw.Rent ?? raw.MarketRent ?? raw.rent);
  const beds = asNumber(raw.Bedrooms ?? raw.bedrooms);
  const baths = asNumber(raw.Bathrooms ?? raw.bathrooms);
  const sqft = asInt(raw.SquareFeet ?? raw.square_feet);
  const available = asDate(raw.AvailableOn ?? raw.AvailableFrom ?? raw.available_from);
  const photos = asStringArray(raw.Photos ?? raw.PhotoUrls ?? raw.photos);
  const isAvailable =
    raw.IsAvailable !== undefined
      ? Boolean(raw.IsAvailable)
      : raw.Available !== undefined
      ? Boolean(raw.Available)
      : true;

  return {
    backendListingId: externalId,
    unitType: asString(raw.UnitType ?? raw.unit_type ?? raw.Type),
    unitNumber: asString(raw.UnitNumber ?? raw.unit_number),
    bedrooms: beds,
    bathrooms: baths,
    squareFeet: sqft,
    priceCents: rent != null ? Math.round(rent * 100) : null,
    isAvailable,
    availableFrom: available,
    photoUrls: photos,
    description: asString(raw.Description ?? raw.description),
    raw: { source: "rest", ...raw } as Prisma.InputJsonValue,
  };
}

// Fetches listings via the REST reports endpoint. Falls back to the
// NormalizedListing shape used by the existing syncListingsForOrg.
async function fetchRest(
  integration: AppFolioIntegration
): Promise<NormalizedListing[]> {
  const client = appfolioRestClient(integration);
  const rows = await fetchAllPages(client, "listings", {
    // Listings report doesn't strictly require a date window, but AppFolio
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
      // TODO(Sprint 06): richer property matching once AppFolio payload
      // exposes property_group reliably in embed-scrape mode. For now we
      // assume everything from the scrape lives under the first property,
      // which matches Telegraph Commons' reality (single building).
      const property = fallbackProperty;
      if (!property) {
        skipped++;
        continue;
      }

      await prisma.listing.upsert({
        where: {
          propertyId_backendListingId: {
            propertyId: property.id,
            backendListingId: rl.backendListingId,
          },
        },
        create: {
          propertyId: property.id,
          backendListingId: rl.backendListingId,
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
        },
        update: {
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
        },
      });
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
