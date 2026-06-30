import "server-only";

// ---------------------------------------------------------------------------
// Google Places API — nearby competitor search.
//
// Used by the competitor scan cron to find apartments / housing properties
// within a configured radius of each LIVE property. Returns the data the
// SEO Agent compares against (rating, review count, amenity hints).
//
// Pricing: $17 per 1,000 nearby searches via the "Nearby Search (New)"
// endpoint. At weekly cadence × 50 properties = ~200 calls/mo = ~$3/mo.
//
// Env-gated: returns { skipped: true } when GOOGLE_PLACES_API_KEY is
// missing so the cron job doesn't crash on cold envs.
// ---------------------------------------------------------------------------

const PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby";

export type NearbyCompetitor = {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  /** Distance from the search center in meters. */
  distanceMeters: number;
  rating: number | null;
  reviewCount: number | null;
  /** Type strings the API returns. We surface them as crude "amenity"
   *  hints — these are categorical (e.g. "lodging", "real_estate_agency",
   *  "apartment_complex"), not specific amenities like "fitness centre". */
  types: string[];
  /** Google Maps URL — useful as the operator's drill-in. */
  websiteUri: string | null;
  googleMapsUri: string | null;
};

type PlaceApiResponse = {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
    types?: string[];
    websiteUri?: string;
    googleMapsUri?: string;
  }>;
};

type NearbyResult =
  | { ok: true; competitors: NearbyCompetitor[] }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; error: string };

// Haversine distance in meters between two lat/lng pairs.
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Find apartment / housing competitors within `radiusMeters` of the
 * given lat/lng. Filters to the housing-relevant `includedTypes` so
 * we don't get hotels, hostels, etc.
 */
export async function findNearbyCompetitors(input: {
  latitude: number;
  longitude: number;
  /** Radius in meters. Default 1,609 (1 mile). Max 50,000. */
  radiusMeters?: number;
  /** Max results. Default 15, max 20 (API ceiling). */
  maxResults?: number;
}): Promise<NearbyResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return {
      ok: false,
      skipped: true,
      reason:
        "GOOGLE_PLACES_API_KEY not configured. Competitor scan skipped.",
    };
  }

  const radius = Math.min(50_000, Math.max(50, input.radiusMeters ?? 1_609));
  const maxResults = Math.min(20, Math.max(1, input.maxResults ?? 15));

  let res: Response;
  try {
    res = await fetch(PLACES_NEARBY_URL, {
      method: "POST",
      headers: {
        "X-Goog-Api-Key": key,
        // Field mask is required by the New Places API. List every
        // field we read so we don't pay for data we don't surface.
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.websiteUri,places.googleMapsUri",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // `apartment_complex` is the most relevant housing type. We
        // also include `lodging` to catch student-housing rebrands
        // that registered under the broader category. Filtering on
        // our side via types keeps results tight.
        includedTypes: ["apartment_complex", "lodging"],
        maxResultCount: maxResults,
        locationRestriction: {
          circle: {
            center: {
              latitude: input.latitude,
              longitude: input.longitude,
            },
            radius,
          },
        },
        rankPreference: "DISTANCE",
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, error: `Google Places nearby failed: ${message}` };
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `Google Places nearby ${res.status}: ${body.slice(0, 200)}`,
    };
  }

  const json = (await res.json()) as PlaceApiResponse;
  const places = json.places ?? [];

  const competitors: NearbyCompetitor[] = places.map((p) => {
    const lat = p.location?.latitude;
    const lng = p.location?.longitude;
    const distance =
      typeof lat === "number" && typeof lng === "number"
        ? haversineMeters(input.latitude, input.longitude, lat, lng)
        : 0;
    return {
      placeId: p.id,
      displayName: p.displayName?.text ?? "Unknown property",
      formattedAddress: p.formattedAddress ?? "",
      distanceMeters: distance,
      rating: typeof p.rating === "number" ? p.rating : null,
      reviewCount:
        typeof p.userRatingCount === "number" ? p.userRatingCount : null,
      types: p.types ?? [],
      websiteUri: p.websiteUri ?? null,
      googleMapsUri: p.googleMapsUri ?? null,
    };
  });

  console.log(
    `[google-places] nearby search returned ${competitors.length} candidates within ${radius}m`,
  );

  return { ok: true, competitors };
}

export function isGooglePlacesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}
