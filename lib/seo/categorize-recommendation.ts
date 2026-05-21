import type { SeoActionCategory } from "@prisma/client";

// ---------------------------------------------------------------------------
// categorize-recommendation — pure mapper from the database enum
// `SeoActionCategory` (10 values) to the operator-facing taxonomy
// used in the /portal/seo/recommendations Opportunities feed:
//
//   Setup
//     ├─ Basics          (connectivity + missing data we need before we can audit)
//     ├─ Audit Needed    (per-page audits + structured-data + content-freshness)
//     └─ Utilization     (the rec exists but the property is not yet exercising
//                         the capability we already built — citation rate,
//                         neighborhood-page coverage, etc.)
//
//   On Page              (content / metadata / internal links / per-page changes)
//   Off Page             (backlinks / authoritative mentions / external signals)
//
// Why a pure file: keeps the page.tsx server component dumb (one map call,
// one count call) and lets us add unit tests later without dragging React in.
// ---------------------------------------------------------------------------

export type TopCategory = "Setup" | "On Page" | "Off Page";

export type RecommendationBucket = {
  topCategory: TopCategory;
  subBucket: string;
};

// Lookup table keyed by SeoActionCategory enum values. Stable order matters
// only for human review here — sidebar order is defined separately below.
const CATEGORY_MAP: Record<SeoActionCategory, RecommendationBucket> = {
  // --- Setup -------------------------------------------------------------
  // Per-page audits live under Setup → Audit Needed: until the property has
  // been audited we don't have the data to recommend specific on-page fixes.
  ONPAGE_AUDIT: { topCategory: "Setup", subBucket: "Audit Needed" },
  SCHEMA_GAP: { topCategory: "Setup", subBucket: "Audit Needed" },
  REFRESH: { topCategory: "Setup", subBucket: "Audit Needed" },

  // AEO_NOT_CITED = "we found you in the index but no AI is citing you".
  // That's a utilization problem — the surface exists, the property is
  // just not exercising it. Treated as Setup → Utilization so it shows
  // up alongside neighborhood-page-coverage recs.
  AEO_NOT_CITED: { topCategory: "Setup", subBucket: "Utilization" },

  // --- On Page -----------------------------------------------------------
  CTR_FIX: { topCategory: "On Page", subBucket: "Metadata" },
  CONTENT_GAP: { topCategory: "On Page", subBucket: "Content" },
  AEO_GAP: { topCategory: "On Page", subBucket: "Content" },
  NEIGHBORHOOD_PAGE: { topCategory: "On Page", subBucket: "Pages" },
  INTERNAL_LINKING: { topCategory: "On Page", subBucket: "Links" },

  // --- Off Page ----------------------------------------------------------
  BACKLINK_OPPORTUNITY: { topCategory: "Off Page", subBucket: "Backlinks" },
};

// Default bucket for any rec category that lands in this file before the
// mapper is updated. Keeps the UI safe in production while still surfacing
// the rec.
const DEFAULT_BUCKET: RecommendationBucket = {
  topCategory: "Setup",
  subBucket: "Basics",
};

/**
 * Returns the operator-facing bucket for a recommendation. Accepts a string
 * (rather than the strict enum) because the engine occasionally introduces
 * new categories before the enum migration lands — defaulting to
 * Setup → Basics keeps the UI working until the mapper catches up.
 */
export function categorizeRecommendation(
  category: string | null | undefined,
): RecommendationBucket {
  if (!category) return DEFAULT_BUCKET;
  const hit = (CATEGORY_MAP as Record<string, RecommendationBucket>)[category];
  return hit ?? DEFAULT_BUCKET;
}

export type BucketCounts = Record<
  TopCategory,
  { total: number; subBuckets: Record<string, number> }
>;

// Sidebar render order — keeps the tree stable across renders even when
// counts shift. Sub-bucket order inside each top bucket is alphabetical at
// render time because counts vary by org and a fixed order would feel
// arbitrary.
export const TOP_CATEGORY_ORDER: readonly TopCategory[] = [
  "Setup",
  "On Page",
  "Off Page",
] as const;

/**
 * Counts recommendations by top category + sub-bucket. Single O(n) pass; no
 * allocations beyond the result object. Safe to call inside the server
 * component on every render — the underlying query is the bottleneck, not
 * this.
 */
export function bucketCountsForRecommendations(
  recs: ReadonlyArray<{ category: string | null | undefined }>,
): BucketCounts {
  const out: BucketCounts = {
    Setup: { total: 0, subBuckets: {} },
    "On Page": { total: 0, subBuckets: {} },
    "Off Page": { total: 0, subBuckets: {} },
  };

  for (const r of recs) {
    const { topCategory, subBucket } = categorizeRecommendation(r.category);
    const slot = out[topCategory];
    slot.total += 1;
    slot.subBuckets[subBucket] = (slot.subBuckets[subBucket] ?? 0) + 1;
  }

  return out;
}
