// ---------------------------------------------------------------------------
// Tier-based retention policy for historical paid-ads metrics.
//
// AdMetricDaily rows are the high-resolution series the dashboard uses for
// the recent window. Older rows get folded into AdMetricMonthly buckets
// (one row per orgId+adAccountId+year+month) by `runAdRetentionForOrg`
// (see `lib/billing/ad-retention-job.ts`), then the daily rows are
// deleted. The /portal/ads read path unions both shapes so charts stay
// continuous across the daily/monthly boundary.
//
// Tier mapping (canonical names: catalog.ts `TIERS[]`):
//   Foundation (id "starter", enum STARTER) -> 1 month daily, no aggregates
//   Growth     (id "growth",  enum GROWTH)  -> 12 months daily + aggregates
//   Scale      (id "scale",   enum SCALE)   -> 24 months daily + aggregates
//   Enterprise (id "scale",   enum CUSTOM)  -> Scale defaults, override OK
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from "@prisma/client";

export type AdRetentionTier = "foundation" | "growth" | "scale" | "enterprise";

export type AdRetentionPolicy = {
  tier: AdRetentionTier;
  /** Whole months of AdMetricDaily granularity to keep before rollup. */
  dailyWindowMonths: number;
  /** When true, the rollup job materializes AdMetricMonthly buckets. */
  monthlyEnabled: boolean;
  /**
   * Operator-supplied override in months. NULL = use tier default.
   * Only honored on Scale / Enterprise; ignored for Foundation + Growth so
   * we don't accidentally let a lower-tier org keep 10 years of daily rows.
   */
  customOverride: number | null;
};

const TIER_DEFAULTS: Record<AdRetentionTier, Omit<AdRetentionPolicy, "customOverride">> = {
  foundation: { tier: "foundation", dailyWindowMonths: 1, monthlyEnabled: false },
  growth: { tier: "growth", dailyWindowMonths: 12, monthlyEnabled: true },
  scale: { tier: "scale", dailyWindowMonths: 24, monthlyEnabled: true },
  enterprise: { tier: "enterprise", dailyWindowMonths: 24, monthlyEnabled: true },
};

/**
 * Map a Prisma SubscriptionTier (or null/string from a join projection) to
 * the retention tier id. Unknown / null -> "foundation" (the safest, most
 * restrictive default).
 */
export function retentionTierFromSubscription(
  tier: SubscriptionTier | string | null | undefined,
): AdRetentionTier {
  if (!tier) return "foundation";
  switch (tier) {
    case "STARTER":
      return "foundation";
    case "GROWTH":
      return "growth";
    case "SCALE":
      return "scale";
    case "CUSTOM":
      return "enterprise";
    default:
      return "foundation";
  }
}

/**
 * Resolve the policy in force for an org. Pure function; caller fetches
 * the org row with just the two columns we read.
 */
export function getAdRetentionPolicy(org: {
  tier?: SubscriptionTier | string | null;
  subscriptionTier?: SubscriptionTier | string | null;
  adDataRetentionMonths?: number | null;
}): AdRetentionPolicy {
  const tierInput = org.tier ?? org.subscriptionTier ?? null;
  const tier = retentionTierFromSubscription(tierInput);
  const defaults = TIER_DEFAULTS[tier];

  // Sanity-clamp the override so a typo (-1, 999) can't wipe history or
  // never trigger rollup. 1..120 months covers every legitimate need.
  const rawOverride = org.adDataRetentionMonths ?? null;
  const customOverride =
    rawOverride != null && Number.isFinite(rawOverride)
      ? Math.max(1, Math.min(120, Math.floor(rawOverride)))
      : null;

  // Only Scale / Enterprise honor overrides. For Foundation + Growth the
  // override is stored but inert; the UI hides the field for those tiers
  // anyway.
  const honorsOverride = tier === "scale" || tier === "enterprise";
  const dailyWindowMonths =
    honorsOverride && customOverride != null
      ? customOverride
      : defaults.dailyWindowMonths;

  return {
    tier,
    dailyWindowMonths,
    monthlyEnabled: defaults.monthlyEnabled,
    customOverride: honorsOverride ? customOverride : null,
  };
}

/**
 * Human-readable summary for the operator UI. Kept here so copy stays in
 * lockstep with the actual policy math.
 */
export function describeAdRetentionPolicy(policy: AdRetentionPolicy): string {
  const months = policy.dailyWindowMonths;
  const daily =
    months === 1
      ? "Daily granularity for the last 28 days."
      : months === 12
        ? "Daily granularity for the last 12 months."
        : `Daily granularity for the last ${months} months.`;
  const rollup = policy.monthlyEnabled
    ? "Older data is rolled up into monthly buckets and kept indefinitely."
    : "Older data is purged on the nightly retention cron.";
  return `${daily} ${rollup}`;
}
