import "server-only";
import * as cheerio from "cheerio";
import { isAllowedUrlWithDns } from "@/lib/utils/ssrf-protection";
import { parseZillowUrl } from "@/lib/zillow/url";

/**
 * Server-side fetch + parse for a Zillow listing URL. Returns either a
 * normalized payload or an error code we can surface to the caller
 * verbatim ("BLOCKED" when Zillow served us a bot wall, "EMPTY" when the
 * page parsed but contained no usable listing data, etc.).
 *
 * Design notes:
 *   - Realistic browser User-Agent. Zillow gates aggressively on
 *     curl/python/node UAs.
 *   - 8s timeout via AbortController so we never hang the API route.
 *   - 4MB body cap so a runaway response can't OOM the lambda.
 *   - We pull from three sources in priority order:
 *       1. __NEXT_DATA__ JSON blob (the structured store Zillow renders
 *          for the React app). This is the most reliable.
 *       2. OG meta tags. Less complete but resilient to JSON shape changes.
 *       3. Hard-coded fallback constants for fields that can't be inferred.
 *   - All numbers are coerced to integers / floats explicitly so the
 *     Json column doesn't grow a tail of stringy numbers.
 */

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type ZillowListing = {
  zpid: string;
  url: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: string | null; // human-readable: "0.25 acres" / "10,890 sqft"
  yearBuilt: number | null;
  zestimate: number | null;
  rentZestimate: number | null;
  daysOnMarket: number | null;
  primaryImageUrl: string | null;
  homeType: string | null;
  homeStatus: string | null;
};

export type ScrapeError =
  | "INVALID_URL"
  | "SSRF_BLOCKED"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED"
  | "BLOCKED"
  | "EMPTY"
  | "TOO_LARGE";

export type ScrapeResult =
  | { ok: true; listing: ZillowListing }
  | { ok: false; error: ScrapeError; status?: number };

export async function scrapeZillowListing(
  rawUrl: string,
): Promise<ScrapeResult> {
  const parts = parseZillowUrl(rawUrl);
  if (!parts) return { ok: false, error: "INVALID_URL" };

  // SSRF guard. parseZillowUrl already requires HTTPS + zillow.com host,
  // but we still do the DNS-resolution check in case zillow.com ever
  // resolves to something funky from inside the lambda.
  const allowed = await isAllowedUrlWithDns(parts.url);
  if (!allowed) return { ok: false, error: "SSRF_BLOCKED" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(parts.url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as { name?: string }).name === "AbortError") {
      return { ok: false, error: "FETCH_TIMEOUT" };
    }
    return { ok: false, error: "FETCH_FAILED" };
  }
  clearTimeout(timer);

  if (res.status === 403 || res.status === 429) {
    return { ok: false, error: "BLOCKED", status: res.status };
  }
  if (!res.ok) {
    return { ok: false, error: "FETCH_FAILED", status: res.status };
  }

  // Read body with a hard cap so a runaway response can't OOM us.
  const reader = res.body?.getReader();
  if (!reader) return { ok: false, error: "FETCH_FAILED" };
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // swallow
        }
        return { ok: false, error: "TOO_LARGE" };
      }
      chunks.push(value);
    }
  }
  const html = Buffer.concat(chunks).toString("utf8");

  const listing = parseListingHtml(html, parts.url, parts.zpid);
  if (!listing) return { ok: false, error: "EMPTY" };
  return { ok: true, listing };
}

// ---------------------------------------------------------------------------
// HTML → listing extraction.
// ---------------------------------------------------------------------------

function parseListingHtml(
  html: string,
  url: string,
  zpid: string,
): ZillowListing | null {
  // Quick bot-wall heuristic. Zillow's PerimeterX page has a stable title
  // and almost no body content.
  if (
    /Press &amp; Hold to confirm/i.test(html) ||
    /captcha-delivery/i.test(html)
  ) {
    return null;
  }

  const $ = cheerio.load(html);

  // 1. Pull the structured payload from __NEXT_DATA__.
  let next: unknown = null;
  const nextScript = $("script#__NEXT_DATA__").first().text();
  if (nextScript) {
    try {
      next = JSON.parse(nextScript);
    } catch {
      next = null;
    }
  }

  const fromNext = next ? extractFromNextData(next) : null;

  // 2. OG fallback for headline fields.
  const ogTitle = $('meta[property="og:title"]').attr("content") ?? null;
  const ogImage = $('meta[property="og:image"]').attr("content") ?? null;
  const ogPrice =
    $('meta[property="og:price:amount"]').attr("content") ??
    $('meta[property="product:price:amount"]').attr("content") ??
    null;
  const ogDescription =
    $('meta[property="og:description"]').attr("content") ?? null;

  // 3. Inline data attributes — last-ditch fallback that sometimes catches
  // the address when both NEXT_DATA and OG fail (very rare, but cheap).
  const inlineAddress =
    $("[data-test='property-address']").first().text().trim() ||
    $("h1").first().text().trim() ||
    null;

  const address =
    fromNext?.address ??
    parseAddressFromOgTitle(ogTitle) ??
    inlineAddress ??
    ogDescription ??
    null;

  const listPrice =
    fromNext?.listPrice ?? coerceNumber(ogPrice) ?? null;

  // If we have *neither* an address nor a price, the page is effectively
  // empty for our purposes. Bail with EMPTY so the caller renders a
  // proper error instead of a half-blank report.
  if (!address && !listPrice) return null;

  return {
    zpid,
    url,
    address,
    city: fromNext?.city ?? null,
    state: fromNext?.state ?? null,
    zip: fromNext?.zip ?? null,
    listPrice,
    beds: fromNext?.beds ?? null,
    baths: fromNext?.baths ?? null,
    sqft: fromNext?.sqft ?? null,
    lotSize: fromNext?.lotSize ?? null,
    yearBuilt: fromNext?.yearBuilt ?? null,
    zestimate: fromNext?.zestimate ?? null,
    rentZestimate: fromNext?.rentZestimate ?? null,
    daysOnMarket: fromNext?.daysOnMarket ?? null,
    primaryImageUrl: fromNext?.primaryImageUrl ?? ogImage ?? null,
    homeType: fromNext?.homeType ?? null,
    homeStatus: fromNext?.homeStatus ?? null,
  };
}

type NextDataExtract = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: string | null;
  yearBuilt: number | null;
  zestimate: number | null;
  rentZestimate: number | null;
  daysOnMarket: number | null;
  primaryImageUrl: string | null;
  homeType: string | null;
  homeStatus: string | null;
};

/**
 * Best-effort walk through Zillow's __NEXT_DATA__ JSON. The shape has
 * shifted at least three times in the past two years, so we look for the
 * listing object under several known paths and merge whatever we find.
 */
function extractFromNextData(next: unknown): NextDataExtract | null {
  const candidates = collectListingCandidates(next);
  if (!candidates.length) return null;

  // Merge fields, preferring the first candidate that has a value.
  const pick = <T>(key: string, coerce: (v: unknown) => T | null): T | null => {
    for (const c of candidates) {
      if (c && typeof c === "object" && key in c) {
        const v = (c as Record<string, unknown>)[key];
        const out = coerce(v);
        if (out !== null && out !== undefined) return out;
      }
    }
    return null;
  };

  const streetAddress = pick("streetAddress", coerceString);
  const city = pick("city", coerceString);
  const state = pick("state", coerceString);
  const zip =
    pick("zipcode", coerceString) ?? pick("postalCode", coerceString);

  const fullAddress = [streetAddress, [city, state].filter(Boolean).join(", "), zip]
    .filter(Boolean)
    .join(", ")
    .trim();

  return {
    address: fullAddress || null,
    city,
    state,
    zip,
    listPrice: pick("price", coerceNumber) ?? pick("listPrice", coerceNumber),
    beds: pick("bedrooms", coerceNumber),
    baths: pick("bathrooms", coerceNumber),
    sqft:
      pick("livingArea", coerceNumber) ??
      pick("livingAreaValue", coerceNumber),
    lotSize: pick("lotSize", coerceString) ?? formatLotSize(candidates),
    yearBuilt: pick("yearBuilt", coerceNumber),
    zestimate: pick("zestimate", coerceNumber),
    rentZestimate: pick("rentZestimate", coerceNumber),
    daysOnMarket:
      pick("daysOnZillow", coerceNumber) ??
      pick("timeOnZillow", coerceNumber),
    primaryImageUrl:
      pick("hiResImageLink", coerceString) ??
      pick("desktopWebHdpImageLink", coerceString) ??
      pick("imgSrc", coerceString),
    homeType: pick("homeType", coerceString),
    homeStatus: pick("homeStatus", coerceString),
  };
}

/**
 * Walk the NEXT_DATA tree looking for objects that look like the listing
 * (have a zpid or homeStatus or bedrooms). We collect every such object
 * so the merge step above can pick fields from whichever variant Zillow
 * happened to render. Bounded depth/breadth to keep us out of CPU jail.
 */
function collectListingCandidates(next: unknown): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const stack: Array<{ node: unknown; depth: number }> = [{ node: next, depth: 0 }];
  let visited = 0;
  while (stack.length) {
    const { node, depth } = stack.pop()!;
    visited++;
    if (visited > 5000 || depth > 12) continue;
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node) stack.push({ node: item, depth: depth + 1 });
      continue;
    }
    const obj = node as Record<string, unknown>;
    if (
      "zpid" in obj ||
      "homeStatus" in obj ||
      ("bedrooms" in obj && "price" in obj)
    ) {
      out.push(obj);
    }
    for (const v of Object.values(obj)) {
      stack.push({ node: v, depth: depth + 1 });
    }
  }
  return out;
}

function formatLotSize(
  candidates: Array<Record<string, unknown>>,
): string | null {
  for (const c of candidates) {
    const value = coerceNumber(c.lotAreaValue);
    const unit = coerceString(c.lotAreaUnits);
    if (value && unit) {
      return `${value.toLocaleString()} ${unit.toLowerCase()}`;
    }
  }
  return null;
}

function coerceNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[,$\s]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function coerceString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// OG titles look like "1234 Main St, Austin, TX 78701 | Zillow"
function parseAddressFromOgTitle(title: string | null): string | null {
  if (!title) return null;
  const cleaned = title.replace(/\s*[|·-]\s*Zillow.*$/i, "").trim();
  return cleaned || null;
}
