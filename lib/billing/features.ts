// ---------------------------------------------------------------------------
// À-la-carte feature catalog (slice S2).
//
// The onboarding cart lets an operator pick individual features instead of a
// pre-built tier. This catalog is the single source of truth for WHICH
// features are selectable, what each maps to on the Organization (the module*
// flag), and the indicative per-property monthly price shown in the cart.
//
// Billing note: the 14-day trial is free, so the cart total here is the
// estimate the operator sees for what they'll pay after the trial. The
// subscriptionTier is INFERRED from the selection (inferTierFromSelection) for
// the billing record; true per-feature Stripe line items are a fast-follow.
// Module enablement during the trial is driven EXACTLY by the selection
// (buildModuleStateFromSelection) — picking a feature does NOT drag in a whole
// tier's worth of modules.
// ---------------------------------------------------------------------------

import type { SubscriptionTier } from "@prisma/client";

// Module flag keys that are always on for every workspace — the base platform.
// Not shown as toggles; included in the base platform fee.
export const ALWAYS_ON_MODULE_KEYS = [
  "moduleWebsite",
  "moduleLeadCapture",
] as const;

// Base platform fee (per property / month). Covers the marketing site,
// lead capture + inbox, and the dashboard. Every workspace pays this.
export const BASE_PLATFORM_CENTS = 9900;

export type FeatureKey =
  | "moduleChatbot"
  | "modulePixel"
  | "moduleSEO"
  | "moduleReputation"
  | "moduleGoogleAds"
  | "moduleMetaAds"
  | "modulePopups"
  | "moduleCreativeStudio"
  | "moduleEmail"
  | "moduleOutboundEmail"
  | "moduleReferrals"
  | "moduleInsights"
  | "moduleMarketIntelligence"
  | "moduleAttribution";

export type FeatureDef = {
  key: FeatureKey;
  name: string;
  copy: string;
  // Lucide icon name (resolved in the client component to avoid importing the
  // icon set into server/runtime code).
  icon: string;
  monthlyCents: number; // per property / month
  // Which tier this feature implies for the inferred billing label.
  tier: "STARTER" | "GROWTH" | "SCALE";
  recommended?: boolean;
};

export const FEATURE_CATALOG: FeatureDef[] = [
  {
    key: "moduleChatbot",
    name: "AI Leasing Chatbot",
    copy: "24/7 AI that answers, captures leads, and books tours. One per property.",
    icon: "Bot",
    monthlyCents: 14900,
    tier: "STARTER",
    recommended: true,
  },
  {
    key: "modulePixel",
    name: "Visitor Pixel",
    copy: "Identify anonymous site visitors — name, email, intent. One per property.",
    icon: "Eye",
    monthlyCents: 19900,
    tier: "GROWTH",
    recommended: true,
  },
  {
    key: "moduleSEO",
    name: "SEO + AI Discovery",
    copy: "Neighborhood pages built to rank and get cited by AI search. GA4 + GSC.",
    icon: "TrendingUp",
    monthlyCents: 14900,
    tier: "GROWTH",
    recommended: true,
  },
  {
    key: "moduleReputation",
    name: "Reputation Monitoring",
    copy: "Google, Yelp, Reddit, and the open web in one inbox, per property.",
    icon: "Star",
    monthlyCents: 7900,
    tier: "STARTER",
  },
  {
    key: "moduleGoogleAds",
    name: "Google Ads",
    copy: "Search + Performance Max campaigns with ROAS reporting.",
    icon: "BarChart3",
    monthlyCents: 9900,
    tier: "GROWTH",
  },
  {
    key: "moduleMetaAds",
    name: "Meta Ads",
    copy: "Facebook + Instagram campaigns with pixel retargeting.",
    icon: "BarChart3",
    monthlyCents: 9900,
    tier: "GROWTH",
  },
  {
    key: "modulePopups",
    name: "Popups & Offers",
    copy: "On-site promo, referral, and exit-intent popups, per property.",
    icon: "MessageSquare",
    monthlyCents: 4900,
    tier: "GROWTH",
  },
  {
    key: "moduleCreativeStudio",
    name: "Creative Studio",
    copy: "On-brand ad and social creative with 48-hour turnaround.",
    icon: "Brush",
    monthlyCents: 9900,
    tier: "GROWTH",
  },
  {
    key: "moduleEmail",
    name: "Email Marketing",
    copy: "Lifecycle + nurture email to your captured leads.",
    icon: "Mail",
    monthlyCents: 7900,
    tier: "SCALE",
  },
  {
    key: "moduleOutboundEmail",
    name: "Outbound Email",
    copy: "Cold + re-engagement sequences with deliverability monitoring.",
    icon: "Send",
    monthlyCents: 9900,
    tier: "SCALE",
  },
  {
    key: "moduleReferrals",
    name: "Resident Referrals",
    copy: "Trackable per-property referral links with full attribution.",
    icon: "Share2",
    monthlyCents: 7900,
    tier: "SCALE",
  },
  {
    key: "moduleInsights",
    name: "Insights & Reports",
    copy: "AI insights, briefings, and scheduled client-ready reports.",
    icon: "Sparkles",
    monthlyCents: 7900,
    tier: "GROWTH",
  },
  {
    key: "moduleMarketIntelligence",
    name: "Market Intelligence",
    copy: "RentCast market comps + rent AVM on every property.",
    icon: "LineChart",
    monthlyCents: 7900,
    tier: "GROWTH",
  },
  {
    key: "moduleAttribution",
    name: "Attribution",
    copy: "Cross-channel attribution across every lead source.",
    icon: "GitBranch",
    monthlyCents: 4900,
    tier: "GROWTH",
  },
];

const FEATURE_KEYS = new Set<string>(FEATURE_CATALOG.map((f) => f.key));

export function isFeatureKey(key: string): key is FeatureKey {
  return FEATURE_KEYS.has(key);
}

// Indicative per-property monthly total for a selection (base + selected
// features). The properties step multiplies this by the property count with
// the graduated brackets.
export function cartMonthlyCentsPerProperty(selected: string[]): number {
  const sum = FEATURE_CATALOG.filter((f) => selected.includes(f.key)).reduce(
    (acc, f) => acc + f.monthlyCents,
    0,
  );
  return BASE_PLATFORM_CENTS + sum;
}

// Infer the billing tier label from the selection: the highest tier any
// selected feature implies. Empty selection = STARTER (base platform only).
export function inferTierFromSelection(selected: string[]): SubscriptionTier {
  let tier: SubscriptionTier = "STARTER";
  for (const f of FEATURE_CATALOG) {
    if (!selected.includes(f.key)) continue;
    if (f.tier === "SCALE") return "SCALE";
    if (f.tier === "GROWTH") tier = "GROWTH";
  }
  return tier;
}

// Build the EXACT module state for the workspace from the cart selection:
// always-on base modules true, every catalog feature true iff selected, all
// others false. This is what gets written to the Organization so à-la-carte
// means à-la-carte (no tier bleed-through).
export function buildModuleStateFromSelection(
  selected: string[],
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  for (const k of ALWAYS_ON_MODULE_KEYS) state[k] = true;
  for (const f of FEATURE_CATALOG) {
    state[f.key] = selected.includes(f.key);
  }
  return state;
}
