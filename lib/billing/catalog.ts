// ---------------------------------------------------------------------------
// LeaseStack billing catalog — the single source of truth for every Stripe
// product + price we sell.
//
// The shape here drives THREE downstream consumers:
//
//   1. scripts/stripe-setup.ts          — creates products + prices in Stripe
//                                         (idempotent via stable lookup_keys)
//   2. lib/billing/plans.ts             — maps lookup_keys → tier + module
//                                         entitlements at runtime
//   3. The public /pricing page UI      — sanity-checked against this list so
//                                         the catalog and the marketing page
//                                         never drift
//
// Why a single file? Because the *pricing* of a SaaS product changes more
// often than its *structure*, and the cost of mismatch (a tier showing one
// price on /pricing while Stripe charges another) is catastrophic for trust.
// One file, one source, one place to bump a number.
//
// CRITICAL: lookup_keys are forever. Once a price is created in Stripe with
// a given lookup_key, do NOT change that key. If you need to change the
// price amount, archive the old price (we never delete) and create a new
// one with a fresh `_v2`, `_v3`, etc. lookup_key. The plans.ts mapping is
// what dictates which version is "current" at the application layer.
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
  creativeRequestsPerMonth: number | "unlimited";
};

export type TierDefinition = {
  id: Lowercase<Exclude<SubscriptionTier, "CUSTOM">>;
  tier: SubscriptionTier;
  productLookupKey: string; // Used to find/create the Product in Stripe
  productName: string;
  productDescription: string;
  // Per-property monthly price. `quantity` on the subscription item drives
  // multi-property scaling (with a separate discount price for additional
  // properties at 20% off).
  monthly: { lookupKey: string; unitAmountCents: number };
  annual: { lookupKey: string; unitAmountCents: number }; // monthly-equivalent of the annual prepay
  additionalPropertyMonthly: { lookupKey: string; unitAmountCents: number };
  additionalPropertyAnnual: { lookupKey: string; unitAmountCents: number };
  setupFee: { lookupKey: string; unitAmountCents: number };
  modules: ModuleFlags;
  limits: TierLimits;
};

// Helper — full-on modules per tier. Foundation gets the bare set;
// Growth adds paid + creative + SEO + pixel; Scale adds outbound + referrals
// + audience sync (audience sync uses moduleEmail flag for now, will split
// later if we add a dedicated flag).
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
      "Managed marketing site, AppFolio listings sync, AI chatbot, lead capture + CRM, reputation monitoring. For owner-operators with 1-2 properties.",
    monthly: { lookupKey: "ls_foundation_monthly_v1", unitAmountCents: 59900 },
    annual: { lookupKey: "ls_foundation_annual_v1", unitAmountCents: 49900 },
    additionalPropertyMonthly: {
      lookupKey: "ls_foundation_addl_monthly_v1",
      unitAmountCents: 47900, // 599 * 0.80
    },
    additionalPropertyAnnual: {
      lookupKey: "ls_foundation_addl_annual_v1",
      unitAmountCents: 39900, // 499 * 0.80
    },
    setupFee: { lookupKey: "ls_foundation_setup_v1", unitAmountCents: 150000 },
    modules: FOUNDATION_MODULES,
    limits: {
      chatbotConversationsPerMonth: 1000,
      pixelVisitorsPerMonth: 0,
      outboundEmailSendsPerMonth: 0,
      creativeRequestsPerMonth: 0,
    },
  },
  {
    id: "growth",
    tier: "GROWTH",
    productLookupKey: "ls_growth_product",
    productName: "LeaseStack Growth",
    productDescription:
      "Everything in Foundation, plus Cursive Pixel (5K visitors/mo), Google + Meta ad management, creative studio (2/mo), SEO module, advanced attribution. For mid-market operators.",
    monthly: { lookupKey: "ls_growth_monthly_v1", unitAmountCents: 89900 },
    annual: { lookupKey: "ls_growth_annual_v1", unitAmountCents: 74900 },
    additionalPropertyMonthly: {
      lookupKey: "ls_growth_addl_monthly_v1",
      unitAmountCents: 71900, // 899 * 0.80
    },
    additionalPropertyAnnual: {
      lookupKey: "ls_growth_addl_annual_v1",
      unitAmountCents: 59900, // 749 * 0.80
    },
    setupFee: { lookupKey: "ls_growth_setup_v1", unitAmountCents: 250000 },
    modules: GROWTH_MODULES,
    limits: {
      chatbotConversationsPerMonth: 5000,
      pixelVisitorsPerMonth: 5000,
      outboundEmailSendsPerMonth: 0,
      creativeRequestsPerMonth: 2,
    },
  },
  {
    id: "scale",
    tier: "SCALE",
    productLookupKey: "ls_scale_product",
    productName: "LeaseStack Scale",
    productDescription:
      "Everything in Growth, plus 25K identified visitors/mo, unlimited creative requests, audience builder + sync (Meta, Google, TikTok), outbound email (3K/mo), referral program, quarterly business review, priority support + CSM. For portfolios with 5+ properties.",
    monthly: { lookupKey: "ls_scale_monthly_v1", unitAmountCents: 149900 },
    annual: { lookupKey: "ls_scale_annual_v1", unitAmountCents: 119900 },
    additionalPropertyMonthly: {
      lookupKey: "ls_scale_addl_monthly_v1",
      unitAmountCents: 119900, // 1499 * 0.80
    },
    additionalPropertyAnnual: {
      lookupKey: "ls_scale_addl_annual_v1",
      unitAmountCents: 95900, // 1199 * 0.80
    },
    setupFee: { lookupKey: "ls_scale_setup_v1", unitAmountCents: 350000 },
    modules: SCALE_MODULES,
    limits: {
      chatbotConversationsPerMonth: "unlimited",
      pixelVisitorsPerMonth: 25000,
      outboundEmailSendsPerMonth: 3000,
      creativeRequestsPerMonth: "unlimited",
    },
  },
];

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

export type AddOnDefinition = {
  productLookupKey: string;
  productName: string;
  productDescription: string;
  priceLookupKey: string;
  unitAmountCents: number;
  // "recurring_monthly" | "one_time" | "metered" — drives the Stripe price
  // creation parameters in the setup script.
  billingMode: "recurring_monthly" | "one_time" | "metered";
  // For metered prices, the unit. Webhook / cron reports usage in this unit.
  // e.g. "visitor" for pixel overage, "send" for email overage.
  meteredUnit?: string;
  // For metered prices only — Stripe Billing Meter event name + display
  // name. Stripe (as of API 2025-03-31) requires every metered price be
  // backed by a Meter; the meter ingests usage events with this
  // `event_name` and the price aggregates against them.
  meterEventName?: string;
  meterDisplayName?: string;
  // Surfaces in the UI's "added to your plan" line items.
  uiLabel: string;
};

export const ADDONS: AddOnDefinition[] = [
  // Capability (recurring)
  {
    productLookupKey: "ls_addon_reputation_pro",
    productName: "Reputation Pro",
    productDescription:
      "Adds commercial-RE + hospitality sources (Tripadvisor, Niche, ApartmentRatings deep crawl) to the standard reputation monitoring.",
    priceLookupKey: "ls_reputation_pro_monthly_v1",
    unitAmountCents: 9900,
    billingMode: "recurring_monthly",
    uiLabel: "Reputation Pro",
  },
  {
    productLookupKey: "ls_addon_white_label",
    productName: "White-label tenant portal",
    productDescription:
      "Hides every \"Powered by LeaseStack\" reference across the tenant portal. Useful for agencies and operators reselling internally.",
    priceLookupKey: "ls_white_label_monthly_v1",
    unitAmountCents: 49900,
    billingMode: "recurring_monthly",
    uiLabel: "White-label portal",
  },
  {
    productLookupKey: "ls_addon_premium_sla",
    productName: "Premium SLA",
    productDescription:
      "1-hour response time during business hours, weekend coverage, and a dedicated Slack escalation channel.",
    priceLookupKey: "ls_premium_sla_monthly_v1",
    unitAmountCents: 39900,
    billingMode: "recurring_monthly",
    uiLabel: "Premium SLA",
  },

  // Service (one-time)
  {
    productLookupKey: "ls_addon_quarterly_strategy",
    productName: "Quarterly strategy session",
    productDescription:
      "90-minute working session with our team to review attribution data, paid mix, creative performance, and the next quarter's plan.",
    priceLookupKey: "ls_quarterly_strategy_v1",
    unitAmountCents: 75000,
    billingMode: "one_time",
    uiLabel: "Quarterly strategy session",
  },
  {
    productLookupKey: "ls_addon_extra_creative",
    productName: "Extra ad creative request",
    productDescription:
      "One additional ad creative concept with 3 variants for A/B testing — on top of your tier's monthly creative cap.",
    priceLookupKey: "ls_extra_creative_v1",
    unitAmountCents: 15000,
    billingMode: "one_time",
    uiLabel: "Extra creative request",
  },
  {
    productLookupKey: "ls_addon_video_shoot",
    productName: "Co-marketing video shoot",
    productDescription:
      "On-site shoot for property tour video, resident testimonial, or amenity highlight reel. Delivered as ad-ready cuts for Meta + Google.",
    priceLookupKey: "ls_video_shoot_v1",
    unitAmountCents: 250000,
    billingMode: "one_time",
    uiLabel: "Co-marketing video shoot",
  },

  // Capacity (metered usage)
  // Stripe charges per reported unit. The cron + webhook code report usage
  // monthly in arrears using the `meteredUnit` quantity.
  {
    productLookupKey: "ls_addon_pixel_overage",
    productName: "Pixel visitor overage",
    productDescription:
      "Identified visitors beyond your plan's monthly cap. Billed monthly against actual identified visitors.",
    priceLookupKey: "ls_pixel_overage_per_visitor_v1",
    unitAmountCents: 5, // $0.05/visitor
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
      "Above Scale's 3,000 sends/mo. Includes deliverability monitoring + unsubscribe handling.",
    priceLookupKey: "ls_email_overage_per_send_v1",
    unitAmountCents: 1, // $0.01/send
    billingMode: "metered",
    meteredUnit: "send",
    meterEventName: "leasestack.email_send_overage",
    meterDisplayName: "Outbound email overage",
    uiLabel: "Outbound email overage",
  },
  {
    productLookupKey: "ls_addon_ad_management",
    productName: "Ad spend management",
    productDescription:
      "15% management fee on top of the ad spend you pay Google + Meta directly. Only billed when we run your campaigns.",
    priceLookupKey: "ls_ad_management_per_dollar_v1",
    // Stripe metered prices charge per reported unit. We report dollars of
    // spend, and the unit_amount is 15 cents per dollar (= 15% markup).
    unitAmountCents: 15,
    billingMode: "metered",
    meteredUnit: "dollar_of_spend",
    meterEventName: "leasestack.ad_spend_dollars",
    meterDisplayName: "Ad spend management",
    uiLabel: "Ad spend management (15%)",
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
        t.additionalPropertyMonthly.lookupKey === lookupKey ||
        t.additionalPropertyAnnual.lookupKey === lookupKey
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
      // Enterprise: don't auto-flip — the agency team configures manually.
      return null;
    default:
      return null;
  }
}
