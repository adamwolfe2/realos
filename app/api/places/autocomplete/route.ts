// ---------------------------------------------------------------------------
// Google Places (New) autocomplete proxy.
//
// The browser MUST NOT see GOOGLE_PLACES_API_KEY. This route accepts a
// short search string from an authenticated portal user and returns a
// trimmed set of place predictions (id + label) suitable for a combobox.
//
// Endpoints used:
//   POST https://places.googleapis.com/v1/places:autocomplete
//   POST https://places.googleapis.com/v1/places/{placeId}  (fields fetch)
//
// Rate limited per-user via the existing enrichLimiter (5/min) to prevent a
// runaway typing loop from burning the Places quota.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireScope } from "@/lib/tenancy/scope";
import {
  checkRateLimit,
  enrichLimiter,
  rateLimited,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  // Free-form search input — what the user typed into the combobox.
  q: z.string().min(2).max(200),
  // Optional placeId — when provided, the route returns the fully-populated
  // place (address components + lat/lng) for the form to consume on selection.
  // Mutually exclusive with `q`: callers send EITHER `q` (autocomplete) OR
  // `placeId` (details).
  placeId: z.string().min(1).max(300).optional(),
});

type PlacePrediction = {
  placeId: string;
  primary: string;
  secondary: string;
};

type PlaceDetails = {
  placeId: string;
  formattedAddress: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function GET(request: Request) {
  // 1. AuthN — portal-only. Marketing visitors don't need this route, and
  //    requiring scope makes the per-user rate limiter trivially keyed.
  let scope;
  try {
    scope = await requireScope();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Rate limit by userId (5/min). Reuses the existing "enrich/scrape"
  //    limiter — same blast-radius semantics (external 3rd-party call from
  //    a portal-authenticated user).
  const rl = await checkRateLimit(enrichLimiter, `places-ac:${scope.userId}`);
  if (!rl.allowed) {
    return rateLimited("Too many place lookups, please slow down.", 60);
  }

  // 3. Validate query.
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    placeId: url.searchParams.get("placeId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query" },
      { status: 400 },
    );
  }

  // 4. Key check — return a structured "disabled" payload so the
  //    component can degrade to a free-text input instead of throwing.
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured", disabled: true },
      { status: 503 },
    );
  }

  try {
    if (parsed.data.placeId) {
      const details = await fetchPlaceDetails(parsed.data.placeId, apiKey);
      return NextResponse.json({ details });
    }
    const predictions = await fetchAutocomplete(parsed.data.q, apiKey);
    return NextResponse.json({ predictions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Places API error";
    console.error("[places/autocomplete] upstream error:", msg);
    return NextResponse.json(
      { error: "Places lookup failed" },
      { status: 502 },
    );
  }
}

// ---------------------------------------------------------------------------
// Places (New) helpers
// ---------------------------------------------------------------------------

async function fetchAutocomplete(
  q: string,
  apiKey: string,
): Promise<PlacePrediction[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        input: q,
        // Restrict to address-style suggestions — the form is binding
        // physical addresses, not random POIs.
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
        languageCode: "en",
      }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Places autocomplete ${res.status}`);
  }
  const json = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
      };
    }>;
  };
  return (json.suggestions ?? [])
    .map((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return null;
      return {
        placeId: p.placeId,
        primary:
          p.structuredFormat?.mainText?.text?.trim() ??
          p.text?.text?.trim() ??
          "",
        secondary: p.structuredFormat?.secondaryText?.text?.trim() ?? "",
      } satisfies PlacePrediction;
    })
    .filter((p): p is PlacePrediction => p !== null && p.primary.length > 0)
    .slice(0, 8);
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetails> {
  // Places (New) details endpoint. The placeId from autocomplete may
  // arrive with the "places/" prefix already — handle both forms.
  const id = placeId.startsWith("places/")
    ? placeId.slice("places/".length)
    : placeId;
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,formattedAddress,addressComponents,location",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!res.ok) {
    throw new Error(`Places details ${res.status}`);
  }
  const json = (await res.json()) as {
    id?: string;
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    addressComponents?: Array<{
      longText?: string;
      shortText?: string;
      types?: string[];
    }>;
  };

  // Walk the components and pluck the parts we care about. Google's
  // schema is "types: ['locality', 'political']" style — we look up the
  // first match for each conceptual slot.
  const get = (typeName: string, prefer: "long" | "short" = "long"): string | null => {
    const c = json.addressComponents?.find((c) =>
      c.types?.includes(typeName),
    );
    if (!c) return null;
    return (prefer === "short" ? c.shortText : c.longText) ?? c.longText ?? null;
  };

  const streetNumber = get("street_number");
  const route = get("route");
  const addressLine1 =
    streetNumber && route ? `${streetNumber} ${route}` : (route ?? streetNumber);

  return {
    placeId: json.id ?? id,
    formattedAddress: json.formattedAddress ?? null,
    addressLine1,
    city: get("locality") ?? get("postal_town") ?? get("sublocality"),
    state: get("administrative_area_level_1", "short"),
    postalCode: get("postal_code"),
    country: get("country", "short"),
    latitude: json.location?.latitude ?? null,
    longitude: json.location?.longitude ?? null,
  };
}
