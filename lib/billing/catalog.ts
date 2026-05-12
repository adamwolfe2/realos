// ---------------------------------------------------------------------------
// LeaseStack billing catalog — the single source of truth for every Stripe
// product + price we sell.
//
// MODEL: self-serve SaaS, per property, per month. Pay through Stripe
// Checkout, get a LeaseStack workspace with the matching tier's features
// gated on. Customer connects their own AppFolio, installs their own
// pixel, builds their own site through the in-product builder. No setup
// fees, no managed agency labor, no done-for-you services. Add-ons are
// platform capability flips or metered usage, nothing requiring our team.
//
// The shape here drives three downstream consumers:
//
//   1. scripts/stripe-setup.ts   creates products + prices in Stripe
//                                idempotent via stable lookup_keys
//   2. lib/billing/plans.ts      maps lookup_keys to tier + entitlements
//                                at runtime
//   3. /pricing page UI          renders the public price grid, sanity-
//                                checked against this list so the catalog
//                                and marketing copy never drift
//
// CRITICAL: lookup_keys are forever. Once a price is created in Stripe
// with a given lookup_key, do NOT change that key. If you need to change
// the price amount, archive the old price (we never delete) and bump
// the lookup_key version (_v1 to _v2). The plans.ts mapping decides
// which version is current at the application layer.
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from "@prisma/client";

// Module entitlements granted by a tier. Mirror of the Organization
// `module*` columns. Webhook applies these on `customer.subscription.updated`.
export type ModuleFlags = {
  moduleWebsite: boolean;
  modulePixel: boolean;
  moduleChatbot: boolean;
  moduleGoogleAds: boolean;
  moduleMetaAds: boolean;
  moduleSEO: boolean;
  moduleEmail: boolean;
  moduleOutboundEmail: boolean;
  moduleReferrals: boolean;
  moduleCreativeStudio: boolean;
  moduleLeadCapture: boolean;
};

// Per-tier soft caps surfaced in the UI + enforced server-side via
// metered usage prices.
export type TierLimits = {
  chatbotConversationsPerMonth: number | "unlimited";
  pixelVisitorsPerMonth: number | "unlimited";
  outboundEmailSendsPerMonth: number;
};

// Graduated per-property discount brackets. Stripe applies these as a
// single `billing_scheme=tiered, tiers_mode=graduated` price, with
// `quantity` on the subscription item driving the property count. The
// brackets are expressed as discount percentages off the base
// per-property monthly rate so a single source of truth (the tier's
// `monthly.unitAmountCents`) drives everything.
//
// Bracket math:
//   Property 1            -> 0% off (full base rate)
//   Properties 2 to 9     -> 20% off
//   Properties 10 to 24   -> 30% off
//   Properties 25 to 99   -> 40% off
//   100+                  -> contact sales (not on self-serve checkout)
export type DiscountBracket = {
  // Last property number included in this bracket. `null` for the
  // open-ended top bracket (which we cap externally at 99 for
  // self-serve; 100+ routes through Enterprise).
  upTo: number | null;
  discountPct: number; // 0 to 1
};

export const PROPERTY_BRACKETS: DiscountBracket[] = [
  { upTo: 1, discountPct: 0 },
  { upTo: 9, discountPct: 0.2 },
  { upTo: 24, discountPct: 0.3 },
  { upTo: 99, discountPct: 0.4 },
];

// Hard cap on the self-serve property stepper / checkout.
// Anything above this routes to Enterprise's "talk to sales" path.
export const SELF_SERVE_PROPERTY_CAP = 99;

export type TierDefinition = {
  id: Lowercase<Exclude<SubscriptionTier, "CUSTOM">>;
  tier: SubscriptionTier;
  productLookupKey: string;
  productName: string;
  productDescription: string;
  // Per-property monthly price for the FIRST property. Additional
  // properties get the per-bracket discount applied via Stripe's
  // graduated tiered pricing (see PROPERTY_BRACKETS above).
  monthly: { lookupKey: string; unitAmountCents: number };
  annual: { lookupKey: string; unitAmountCents: number };
  // Lookup keys for the graduated tiered Stripe Prices. One per cycle.
  // The setup script creates these with `billing_scheme=tiered` so a
  // single subscription item with quantity=N bills correctly under the
  // bracket math.
  graduatedMonthly: { lookupKey: string };
  graduatedAnnual: { lookupKey: string };
  modules: ModuleFlags;
  limits: TierLimits;
};

// Compute total monthly cents for a tier + property count using the
// graduated brackets. Used by the UI to render accurate totals and by
// scripts/billing-checks to sanity-check Stripe's invoice math.
export function computeGraduatedMonthlyCents(
  baseUnitAmountCents: number,
  propertyCount: number,
): number {
  if (propertyCount <= 0) return 0;
  let total = 0;
  let counted = 0;
  for (const bracket of PROPERTY_BRACKETS) {
    const bracketLastUnit = bracket.upTo ?? Number.MAX_SAFE_INTEGER;
    if (propertyCount <= counted) break;
    const unitsInBracket = Math.max(
      0,
      Math.min(propertyCount, bracketLastUnit) - counted,
    );
    if (unitsInBracket <= 0) continue;
    const perUnit = Math.round(
      baseUnitAmountCents * (1 - bracket.discountPct),
    );
    total += perUnit * unitsInBracket;
    counted += unitsInBracket;
  }
  return total;
}

// Effective per-property cents at a given property count. Used to show
// "you're paying $X per property" in the UI without exposing the full
// bracket structure.
export function effectivePerPropertyCents(
  baseUnitAmountCents: number,
  propertyCount: number,
): number {
  if (propertyCount <= 0) return baseUnitAmountCents;
  return Math.round(
    computeGraduatedMonthlyCents(baseUnitAmountCents, propertyCount) /
      propertyCount,
  );
}

// Module sets per tier. Foundation gets the baseline; Growth adds
// pixel + paid + SEO + creative library; Scale adds outbound +
// referrals + audience sync.
const FOUNDATION_MODULES: ModuleFlags = {
  moduleWebsite: true,
  modulePixel: false,
  moduleChatbot: true,
  moduleGoogleAds: false,
  moduleMetaAds: false,
  moduleSEO: false,
  moduleEmail: false,
  moduleOutboundEmail: false,
  moduleReferrals: false,
  moduleCreativeStudio: false,
  moduleLeadCapture: true,
};

const GROWTH_MODULES: ModuleFlags = {
  ...FOUNDATION_MODULES,
  modulePixel: true,
  moduleGoogleAds: true,
  moduleMetaAds: true,
  moduleSEO: true,
  moduleCreativeStudio: true,
};

const SCALE_MODULES: ModuleFlags = {
  ...GROWTH_MODULES,
  moduleEmail: true,
  moduleOutboundEmail: true,
  moduleReferrals: true,
};

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export const TIERS: TierDefinition[] = [
  {
    id: "starter",
    tier: "STARTER",
    productLookupKey: "ls_foundation_product",
    productName: "LeaseStack Foundation",
    productDescription:
      "Core platform: marketing site builder, AppFolio listings sync, AI leasing chatbot, lead capture and tour scheduling, reputation monitoring. Self-serve. Connect your data, launch in a day.",
    monthly: { lookupKey: "ls_foundation_monthly_v1", unitAmountCents: 49900 },
    annual: { lookupKey: "ls_foundation_annual_v1", unitAmountCents: 41900 },
    graduatedMonthly: { lookupKey: "ls_foundation_graduated_monthly_v1" },
    graduatedAnnual: { lookupKey: "ls_foundation_graduated_annual_v1" },
    modules: FOUNDATION_MODULES,
    limits: {
      chatbotConversationsPerMonth: 1000,
      pixelVisitorsPerMonth: 0,
      outboundEmailSendsPerMonth: 0,
    },
  },
  {
    id: "growth",
    tier: "GROWTH",
    productLookupKey: "ls_growth_product",
    productName: "LeaseStack Growth",
    productDescription:
      "Everything in Foundation, plus Cursive visitor pixel (5,000 identified visitors per month), Google and Meta ads campaign builder, SEO module with GSC and GA4 integration, multi-touch attribution, creative library and brand kit.",
    monthly: { lookupKey: "ls_growth_monthly_v1", unitAmountCents: 89900 },
    annual: { lookupKey: "ls_growth_annual_v1", unitAmountCents: 74900 },
    graduatedMonthly: { lookupKey: "ls_growth_graduated_monthly_v1" },
    graduatedAnnual: { lookupKey: "ls_growth_graduated_annual_v1" },
    modules: GROWTH_MODULES,
    limits: {
      chatbotConversationsPerMonth: 5000,
      pixelVisitorsPerMonth: 5000,
      outboundEmailSendsPerMonth: 0,
    },
  },
  {
    id: "scale",
    tier: "SCALE",
    productLookupKey: "ls_scale_product",
    productName: "LeaseStack Scale",
    productDescription:
      "Everything in Growth, plus 25,000 identified visitors per month, audience builder with sync to Meta, Google and TikTok, outbound email campaigns (3,000 sends per month), resident referral program, scheduled custom reports, unlimited chatbot conversations.",
    monthly: { lookupKey: "ls_scale_monthly_v1", unitAmountCents: 149900 },
    annual: { lookupKey: "ls_scale_annual_v1", unitAmountCents: 124900 },
    graduatedMonthly: { lookupKey: "ls_scale_graduated_monthly_v1" },
    graduatedAnnual: { lookupKey: "ls_scale_graduated_annual_v1" },
    modules: SCALE_MODULES,
    limits: {
      chatbotConversationsPerMonth: "unlimited",
      pixelVisitorsPerMonth: 25000,
      outboundEmailSendsPerMonth: 3000,
    },
  },
];

// ---------------------------------------------------------------------------
// Add-ons
//
// Self-serve only. Each one is either:
//   * A capability flip (Reputation Pro, White-label) billed monthly,
//     activated automatically when the subscription item lands
//   * Metered usage above the plan caps (pixel overage, email overage)
//     billed in arrears against actual usage reported by a Stripe
//     Billing Meter
//
// What is NOT here (intentionally removed in the self-serve pivot):
//   * Ad spend management (15% markup) — that's a managed service
//   * Quarterly strategy session — that's our team's time
//   * Extra ad creative request — that's our team's time
//   * Co-marketing video shoot — that's a production service
//   * Premium SLA — we provide self-serve support to everyone
//   * Custom PMS integration — that's a one-off engineering project,
//     handled through sales contact, not the public Stripe catalog
// ---------------------------------------------------------------------------

export type AddOnDefinition = {
  productLookupKey: string;
  productName: string;
  productDescription: string;
  priceLookupKey: string;
  unitAmountCents: number;
  billingMode: "recurring_monthly" | "metered";
  meteredUnit?: string;
  meterEventName?: string;
  meterDisplayName?: string;
  uiLabel: string;
};

export const ADDONS: AddOnDefinition[] = [
  // Capability flips
  {
    productLookupKey: "ls_addon_reputation_pro",
    productName: "Reputation Pro",
    productDescription:
      "Adds commercial real estate and hospitality review sources (Tripadvisor, Niche, ApartmentRatings deep crawl) to the standard reputation monitoring. Self-serve, on by default the moment your subscription syncs.",
    priceLookupKey: "ls_reputation_pro_monthly_v1",
    unitAmountCents: 9900,
    billingMode: "recurring_monthly",
    uiLabel: "Reputation Pro",
  },
  {
    productLookupKey: "ls_addon_white_label",
    productName: "White-label workspace",
    productDescription:
      "Removes LeaseStack branding from the tenant portal, public marketing site, and outbound emails. Useful for agencies and operators who want to resell internally without exposing the underlying platform.",
    priceLookupKey: "ls_white_label_monthly_v1",
    unitAmountCents: 49900,
    billingMode: "recurring_monthly",
    uiLabel: "White-label workspace",
  },

  // Metered usage above the tier caps
  {
    productLookupKey: "ls_addon_pixel_overage",
    productName: "Pixel visitor overage",
    productDescription:
      "Additional identified visitors above your tier cap. Charged per identified visitor in arrears at the end of each billing cycle. Capped at 100x your tier cap as a safety stop.",
    priceLookupKey: "ls_pixel_overage_per_visitor_v1",
    unitAmountCents: 5,
    billingMode: "metered",
    meteredUnit: "visitor",
    meterEventName: "leasestack.pixel_visitor_overage",
    meterDisplayName: "Pixel visitor overage",
    uiLabel: "Pixel visitor overage",
  },
  {
    productLookupKey: "ls_addon_email_overage",
    productName: "Outbound email overage",
    productDescription:
      "Additional outbound email sends above Scale's 3,000 per month cap. Charged per send. Includes the same deliverability monitoring, unsubscribe handling, and bounce processing as your base sends.",
    priceLookupKey: "ls_email_overage_per_send_v1",
    unitAmountCents: 1,
    billingMode: "metered",
    meteredUnit: "send",
    meterEventName: "leasestack.email_send_overage",
    meterDisplayName: "Outbound email overage",
    uiLabel: "Outbound email overage",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTierById(
  id: TierDefinition["id"]
): TierDefinition | null {
  return TIERS.find((t) => t.id === id) ?? null;
}

export function findTierByLookupKey(
  lookupKey: string
): TierDefinition | null {
  return (
    TIERS.find(
      (t) =>
        t.monthly.lookupKey === lookupKey ||
        t.annual.lookupKey === lookupKey ||
        t.graduatedMonthly.lookupKey === lookupKey ||
        t.graduatedAnnual.lookupKey === lookupKey,
    ) ?? null
  );
}

export function getModulesForTier(tier: SubscriptionTier): ModuleFlags | null {
  switch (tier) {
    case "STARTER":
      return FOUNDATION_MODULES;
    case "GROWTH":
      return GROWTH_MODULES;
    case "SCALE":
      return SCALE_MODULES;
    case "CUSTOM":
      // Enterprise: managed manually by our team, no auto entitlements
      return null;
    default:
      return null;
  }
}
