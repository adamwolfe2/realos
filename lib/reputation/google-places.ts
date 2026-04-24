import "server-only";
import { Redis } from "@upstash/redis";
import { MentionSource } from "@prisma/client";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";

// ---------------------------------------------------------------------------
// Google Places API (v1) — native Google Reviews for a property.
//
// The new Places API v1 endpoint is:
//   GET https://places.googleapis.com/v1/places/{placeId}
// with `X-Goog-Api-Key` + `X-Goog-FieldMask` headers.
//
// The response includes up to 5 "most helpful" reviews — Google does not
// expose paginated history. This is fine for on-demand scanning: we persist
// what we see, and catch new reviews on the next scan.
//
// Cache per placeId in Upstash KV for 24h — Google Reviews rarely change and
// every call costs ~$0.017.
// ---------------------------------------------------------------------------

export const GOOGLE_PLACES_COST_CENTS_PER_CALL = 2; // round up from $0.017

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h

type GoogleReview = {
  name?: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string };
  authorAttribution?: {
    displayName?: string;
    uri?: string;
    photoUri?: string;
  };
  publishTime?: string;
  googleMapsUri?: string;
};

type GooglePlaceResponse = {
  id?: string;
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReview[];
  googleMapsUri?: string;
};

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Best-effort extraction of a Place ID from a googleReviewUrl. Google's share
 * URLs come in several shapes — this covers the common ones. When the URL
 * only contains a `cid=` (customer id), we cannot derive the Place ID without
 * another API call, so we return null and the orchestrator will fall back to
 * text search.
 */
export function extractPlaceIdFromReviewUrl(url: string | null): string | null {
  if (!url) return null;
  // `!1s0x80858...:0x456...` pattern inside share URLs contains the FTID,
  // which is not a Place ID but can be resolved to one via searchText. We
  // don't parse it here; we leave it to the orchestrator.
  const directPlaceId = url.match(/[?&]place_id=([^&]+)/);
  if (directPlaceId) return decodeURIComponent(directPlaceId[1]);
  return null;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<GooglePlaceResponse> {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,rating,userRatingCount,reviews,googleMapsUri",
      },
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Places ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as GooglePlaceResponse;
}

/**
 * Resolve a property (by name + address) to its Google Place ID via the
 * Places Text Search endpoint. Used as a fallback when googlePlaceId is not
 * seeded on the Property row. Callers should cache the returned id onto the
 * property so we only do this once.
 */
export async function resolvePlaceIdFromAddress(
  property: PropertySeed
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  const query = [
    property.name,
    property.addressLine1,
    property.city,
    property.state,
    property.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
  if (!query) return null;

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: query }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      places?: Array<{ id?: string }>;
    };
    return json.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

function toScannedMention(
  r: GoogleReview,
  mapsUri: string | undefined,
  placeId: string
): ScannedMention {
  const text = r.text?.text ?? r.originalText?.text ?? "";
  const author = r.authorAttribution?.displayName ?? null;
  const publishedAt = r.publishTime ? new Date(r.publishTime) : null;
  // Prefer the review-specific URL when available; fall back to the place's
  // maps URI + the review name fragment for uniqueness during dedupe.
  const reviewFragment = r.name ? `#${encodeURIComponent(r.name)}` : "";
  const placeUri =
    r.googleMapsUri ??
    mapsUri ??
    `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  const sourceUrl = `${placeUri}${reviewFragment}`;
  return {
    source: MentionSource.GOOGLE_REVIEW,
    sourceUrl,
    title: author ?? "Google review",
    excerpt: text.slice(0, 1200),
    authorName: author,
    publishedAt,
    rating: typeof r.rating === "number" ? r.rating : null,
  };
}

export async function searchGooglePlaces(
  property: PropertySeed,
  placeIdOverride?: string
): Promise<ScanSourceResult & { resolvedPlaceId?: string | null }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return {
      source: "google",
      ok: false,
      found: 0,
      mentions: [],
      error: "GOOGLE_PLACES_API_KEY not configured",
    };
  }

  let placeId =
    placeIdOverride ??
    property.googlePlaceId ??
    extractPlaceIdFromReviewUrl(property.googleReviewUrl);

  let resolvedNow = false;
  if (!placeId) {
    placeId = await resolvePlaceIdFromAddress(property);
    resolvedNow = !!placeId;
  }

  if (!placeId) {
    return {
      source: "google",
      ok: false,
      found: 0,
      mentions: [],
      error: "No Google Place ID available for this property",
    };
  }

  // Cache by placeId. Orchestrator persists the normalized ScannedMention
  // list rather than the raw Google response so the cache shape is stable
  // even if the upstream response evolves.
  const redis = getRedis();
  const cacheKey = `reputation:google:${placeId}`;
  if (redis) {
    try {
      const cached = await redis.get<ScannedMention[]>(cacheKey);
      if (cached && Array.isArray(cached)) {
        return {
          source: "google",
          ok: true,
          found: cached.length,
          mentions: cached.map((m) => ({
            ...m,
            publishedAt: m.publishedAt ? new Date(m.publishedAt) : null,
          })),
          resolvedPlaceId: resolvedNow ? placeId : undefined,
        };
      }
    } catch {
      // Cache read failures are non-fatal; fall through to fresh fetch.
    }
  }

  try {
    const place = await fetchPlaceDetails(placeId, apiKey);
    const mentions = (place.reviews ?? []).map((r) =>
      toScannedMention(r, place.googleMapsUri, placeId as string)
    );

    if (redis) {
      try {
        await redis.set(cacheKey, mentions, { ex: CACHE_TTL_SECONDS });
      } catch {
        // Non-fatal.
      }
    }

    return {
      source: "google",
      ok: true,
      found: mentions.length,
      mentions,
      resolvedPlaceId: resolvedNow ? placeId : undefined,
    };
  } catch (err) {
    return {
      source: "google",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
      resolvedPlaceId: resolvedNow ? placeId : undefined,
    };
  }
}
