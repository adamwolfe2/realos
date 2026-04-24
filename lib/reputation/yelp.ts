import "server-only";
import { MentionSource } from "@prisma/client";
import type { ScanSourceResult, ScannedMention, PropertySeed } from "./types";

// ---------------------------------------------------------------------------
// Yelp Fusion API — /businesses/{id}/reviews returns up to 3 most-recent
// reviews. This is a Yelp product limitation, not our design.
//
// If `Property.yelpBusinessId` is not set, we skip rather than attempt an
// auto-lookup; resolving names to Yelp business IDs adds an extra call and
// is often ambiguous for apartment complexes. Phase 2 can add a "Connect
// Yelp" prompt in property settings.
// ---------------------------------------------------------------------------

type YelpReview = {
  id: string;
  url?: string;
  text?: string;
  rating?: number;
  time_created?: string;
  user?: { name?: string; id?: string; image_url?: string };
};

type YelpReviewsResponse = {
  reviews?: YelpReview[];
  total?: number;
  possible_languages?: string[];
};

function toScannedMention(
  r: YelpReview,
  businessId: string
): ScannedMention {
  const url =
    r.url ?? `https://www.yelp.com/biz/${encodeURIComponent(businessId)}`;
  const publishedAt = r.time_created ? new Date(r.time_created) : null;
  return {
    source: MentionSource.YELP,
    sourceUrl: url,
    title: r.user?.name ? `Review by ${r.user.name}` : "Yelp review",
    excerpt: (r.text ?? "").slice(0, 1200),
    authorName: r.user?.name ?? null,
    publishedAt,
    rating: typeof r.rating === "number" ? r.rating : null,
  };
}

export async function searchYelp(
  property: PropertySeed
): Promise<ScanSourceResult> {
  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: "YELP_API_KEY not configured",
    };
  }

  const businessId = property.yelpBusinessId;
  if (!businessId) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: "Yelp not connected (yelpBusinessId not set on property)",
    };
  }

  try {
    const res = await fetch(
      `https://api.yelp.com/v3/businesses/${encodeURIComponent(
        businessId
      )}/reviews?limit=20&sort_by=yelp_sort`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        source: "yelp",
        ok: false,
        found: 0,
        mentions: [],
        error: `Yelp ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    const json = (await res.json()) as YelpReviewsResponse;
    const mentions = (json.reviews ?? []).map((r) =>
      toScannedMention(r, businessId)
    );
    return {
      source: "yelp",
      ok: true,
      found: mentions.length,
      mentions,
    };
  } catch (err) {
    return {
      source: "yelp",
      ok: false,
      found: 0,
      mentions: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
