import "server-only";

// ---------------------------------------------------------------------------
// RentCast API client — minimal typed wrapper for the two endpoints needed
// by Phase 1 (Property Detail Market Intelligence). Both endpoints share a
// common code path: bearer-style `X-Api-Key` header, 8s AbortController
// timeout, typed errors keyed by failure mode so the cache layer + the UI
// can branch sensibly without sniffing strings.
//
// We deliberately do NOT throw on missing key — instead we raise a typed
// `MISSING_KEY` error so dev environments without `RENTCAST_API_KEY` can
// still load the property detail page (the section renders a "RentCast
// not configured" empty state instead of a 500).
// ---------------------------------------------------------------------------

const BASE_URL = "https://api.rentcast.io/v1";
const DEFAULT_TIMEOUT_MS = 8_000;

export type RentCastErrorCode =
  | "AUTH"
  | "QUOTA"
  | "RATE_LIMIT"
  | "NOT_FOUND"
  | "UPSTREAM"
  | "TIMEOUT"
  | "MISSING_KEY";

export class RentCastError extends Error {
  readonly code: RentCastErrorCode;
  readonly status?: number;
  readonly upstreamBody?: string;

  constructor(
    code: RentCastErrorCode,
    message: string,
    opts?: { status?: number; upstreamBody?: string },
  ) {
    super(message);
    this.name = "RentCastError";
    this.code = code;
    this.status = opts?.status;
    this.upstreamBody = opts?.upstreamBody;
  }
}

// ---------------------------------------------------------------------------
// Public response shapes. Only the fields we surface on the property detail
// page are typed; the cache layer persists the full raw payload so a later
// phase can mine additional fields without re-fetching.
// ---------------------------------------------------------------------------

export type RentComparable = {
  formattedAddress: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  price: number | null;
  distance: number | null;
  daysOld: number | null;
  daysOnMarket: number | null;
  latitude: number | null;
  longitude: number | null;
};

export type RentAvmResponse = {
  rent: number;
  rentRangeLow: number;
  rentRangeHigh: number;
  subjectProperty?: Record<string, unknown>;
  comparables: RentComparable[];
};

export type MarketStatsByBedroom = {
  bedrooms: number;
  medianRent?: number;
  averageRent?: number;
  totalListings?: number;
  medianDaysOnMarket?: number;
};

export type MarketStatsResponse = {
  rentalData: {
    medianRent: number | null;
    averageRent: number | null;
    medianDaysOnMarket: number | null;
    totalListings: number | null;
    lastUpdatedDate: string | null;
    dataByBedrooms?: MarketStatsByBedroom[];
    history?: Record<string, unknown>;
  };
};

// ---------------------------------------------------------------------------
// Core fetch helper. Shared by both endpoints — picks up the key, applies
// the timeout, normalizes status codes to typed RentCastError codes, and
// JSON-parses the body. Caller is responsible for shaping the parsed JSON
// into a typed response.
// ---------------------------------------------------------------------------

async function rentCastFetch(path: string, query: Record<string, string | number | undefined>): Promise<unknown> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new RentCastError(
      "MISSING_KEY",
      "RENTCAST_API_KEY is not configured. Set it in Vercel to enable market intelligence.",
    );
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const url = `${BASE_URL}${path}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Key": apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
      // Don't cache at the fetch layer — we own caching at the DB layer.
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new RentCastError("TIMEOUT", `RentCast request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new RentCastError("UPSTREAM", `RentCast network error: ${message}`);
  } finally {
    clearTimeout(timer);
  }

  // Best-effort body read for error logging. Capped so a runaway HTML 500
  // page from RentCast can't blow up our process.
  let bodyText: string | undefined;
  if (!response.ok) {
    try {
      const raw = await response.text();
      bodyText = raw.length > 1024 ? `${raw.slice(0, 1024)}...` : raw;
    } catch {
      bodyText = undefined;
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new RentCastError(
      "AUTH",
      `RentCast auth rejected (HTTP ${response.status}). Verify RENTCAST_API_KEY.`,
      { status: response.status, upstreamBody: bodyText },
    );
  }
  if (response.status === 402) {
    throw new RentCastError(
      "QUOTA",
      "RentCast quota exceeded for the current billing period.",
      { status: response.status, upstreamBody: bodyText },
    );
  }
  if (response.status === 429) {
    throw new RentCastError(
      "RATE_LIMIT",
      "RentCast rate limit hit. Back off and retry.",
      { status: response.status, upstreamBody: bodyText },
    );
  }
  if (response.status === 404) {
    throw new RentCastError(
      "NOT_FOUND",
      "RentCast has no data for the requested address.",
      { status: response.status, upstreamBody: bodyText },
    );
  }
  if (!response.ok) {
    throw new RentCastError(
      "UPSTREAM",
      `RentCast returned HTTP ${response.status}.`,
      { status: response.status, upstreamBody: bodyText },
    );
  }

  return response.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type GetRentAvmInput = {
  address: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  compCount?: number;
};

export async function getRentAvm(input: GetRentAvmInput): Promise<RentAvmResponse> {
  const json = await rentCastFetch("/avm/rent/long-term", {
    address: input.address,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    squareFootage: input.squareFootage,
    compCount: input.compCount,
  });
  return parseRentAvm(json);
}

export type GetMarketStatsInput = {
  zipCode: string;
  historyRange?: number;
};

export async function getMarketStats(input: GetMarketStatsInput): Promise<MarketStatsResponse> {
  const json = await rentCastFetch("/markets", {
    zipCode: input.zipCode,
    dataType: "Rental",
    historyRange: input.historyRange ?? 6,
  });
  return parseMarketStats(json);
}

// ---------------------------------------------------------------------------
// Parsers — narrow the unknown JSON into typed shapes. Tolerant of missing
// fields (RentCast omits some properties when its dataset is thin) so the
// UI can render a partial state instead of throwing.
// ---------------------------------------------------------------------------

function asNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function parseRentAvm(raw: unknown): RentAvmResponse {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rent = asNumberOrNull(obj.rent);
  const low = asNumberOrNull(obj.rentRangeLow);
  const high = asNumberOrNull(obj.rentRangeHigh);
  if (rent === null || low === null || high === null) {
    throw new RentCastError(
      "UPSTREAM",
      "RentCast rent AVM response missing required rent/range fields.",
    );
  }
  const compsRaw = Array.isArray(obj.comparables) ? obj.comparables : [];
  const comparables: RentComparable[] = compsRaw.map((c) => {
    const co = (c ?? {}) as Record<string, unknown>;
    return {
      formattedAddress: typeof co.formattedAddress === "string" ? co.formattedAddress : null,
      bedrooms: asNumberOrNull(co.bedrooms),
      bathrooms: asNumberOrNull(co.bathrooms),
      squareFootage: asNumberOrNull(co.squareFootage),
      price: asNumberOrNull(co.price),
      distance: asNumberOrNull(co.distance),
      daysOld: asNumberOrNull(co.daysOld),
      daysOnMarket: asNumberOrNull(co.daysOnMarket),
      latitude: asNumberOrNull(co.latitude),
      longitude: asNumberOrNull(co.longitude),
    };
  });
  return {
    rent,
    rentRangeLow: low,
    rentRangeHigh: high,
    subjectProperty: (obj.subjectProperty as Record<string, unknown>) ?? undefined,
    comparables,
  };
}

function parseMarketStats(raw: unknown): MarketStatsResponse {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const rd = (obj.rentalData ?? {}) as Record<string, unknown>;
  const byBedroomsRaw = Array.isArray(rd.dataByBedrooms) ? rd.dataByBedrooms : [];
  const dataByBedrooms: MarketStatsByBedroom[] = byBedroomsRaw
    .map((row): MarketStatsByBedroom | null => {
      const r = (row ?? {}) as Record<string, unknown>;
      const bedrooms = asNumberOrNull(r.bedrooms);
      if (bedrooms === null) return null;
      return {
        bedrooms,
        medianRent: asNumberOrNull(r.medianRent) ?? undefined,
        averageRent: asNumberOrNull(r.averageRent) ?? undefined,
        totalListings: asNumberOrNull(r.totalListings) ?? undefined,
        medianDaysOnMarket: asNumberOrNull(r.medianDaysOnMarket) ?? undefined,
      };
    })
    .filter((row): row is MarketStatsByBedroom => row !== null);
  return {
    rentalData: {
      medianRent: asNumberOrNull(rd.medianRent),
      averageRent: asNumberOrNull(rd.averageRent),
      medianDaysOnMarket: asNumberOrNull(rd.medianDaysOnMarket),
      totalListings: asNumberOrNull(rd.totalListings),
      lastUpdatedDate: typeof rd.lastUpdatedDate === "string" ? rd.lastUpdatedDate : null,
      dataByBedrooms: dataByBedrooms.length > 0 ? dataByBedrooms : undefined,
      history: (rd.history as Record<string, unknown>) ?? undefined,
    },
  };
}
