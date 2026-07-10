// ---------------------------------------------------------------------------
// Plan display data — a read-only projection of lib/billing/catalog.ts for
// the public pricing surfaces (tier cards + comparison table).
//
// The catalog is the single source of truth for plan names and prices.
// Both PricingTiers and ComparisonTable render from THIS module so the
// two surfaces can never drift apart again (they previously shipped as
// Foundation/Growth/Scale cards vs a Pilot/Standard/Portfolio table).
//
// Render-only: nothing here mutates or reinterprets billing logic.
// ---------------------------------------------------------------------------

import {
  TIERS as CATALOG_TIERS,
  type TierDefinition,
} from "@/lib/billing/catalog";

export type PlanDisplay = {
  // Catalog id, as accepted by getTierById() on the server.
  catalogId: TierDefinition["id"];
  // Public tier name, derived from the catalog productName with the
  // brand prefix stripped ("LeaseStack Growth" -> "Growth").
  name: string;
  // First-property monthly price in whole dollars.
  monthlyDollars: number;
  // Monthly-equivalent of the annual prepay, in whole dollars.
  annualDollars: number;
};

function requireCatalogTier(id: TierDefinition["id"]): TierDefinition {
  const tier = CATALOG_TIERS.find((t) => t.id === id);
  if (!tier) {
    throw new Error(`lib/billing/catalog.ts has no tier with id "${id}"`);
  }
  return tier;
}

function toDisplay(id: TierDefinition["id"]): PlanDisplay {
  const tier = requireCatalogTier(id);
  return {
    catalogId: tier.id,
    name: tier.productName.replace(/^LeaseStack\s+/, ""),
    monthlyDollars: tier.monthly.unitAmountCents / 100,
    annualDollars: tier.annual.unitAmountCents / 100,
  };
}

// Keyed by the marketing-surface slug. "foundation" maps to the catalog
// "starter" id (SubscriptionTier.STARTER); the public name comes from
// the catalog productName either way.
export const PLAN_DISPLAY: {
  foundation: PlanDisplay;
  growth: PlanDisplay;
  scale: PlanDisplay;
} = {
  foundation: toDisplay("starter"),
  growth: toDisplay("growth"),
  scale: toDisplay("scale"),
};
