import "server-only";

// ---------------------------------------------------------------------------
// Marketplace catalog
//
// The user-facing à-la-carte module catalog rendered on /portal/marketplace.
// Each entry maps to a `module*` boolean flag on the Organization model
// (prisma/schema.prisma lines 351–362) OR to one of the Stripe-billed
// add-ons in lib/billing/catalog.ts.
//
// Pricing model:
//   - During trial (subscriptionStatus=TRIALING), every flippable module
//     is FREE to activate. Users hit "Activate" and the corresponding
//     Boolean flips on at zero cost.
//   - After trial, activating routes the user into Stripe Checkout via
//     /api/portal/marketplace/toggle (returns requiresPayment:true).
//   - Always-on modules (Lead capture, Reputation monitoring) render as
//     "Included" — no toggle, just a deep-link to where to use them.
//   - Paid add-ons (Reputation Pro, White-label) are real Stripe SKUs;
//     activation always routes to billing regardless of trial state.
//   - Coming-soon entries render greyed-out with a "Notify me" CTA. We
//     keep them visible so customers see the roadmap, but they CANNOT
//     activate them — better than disappointment after a click.
//
// Adding a new module:
//   1. Add the `module*` Boolean to Organization in prisma/schema.prisma
//      (or use entitlement: "always-on" / "addon" if it doesn't need a flag)
//   2. Add a CatalogEntry below
//   3. Add the corresponding nav predicate in components/portal/portal-nav.tsx
//   4. Wire the setup page at the `setupHref` if it needs configuration
// ---------------------------------------------------------------------------

import {
  Eye,
  Bot,
  TrendingUp,
  BarChart3,
  Send,
  Share2,
  Brush,
  Globe,
  Mail,
  Star,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey =
  | "modulePixel"
  | "moduleChatbot"
  | "moduleSEO"
  | "moduleGoogleAds"
  | "moduleMetaAds"
  | "moduleEmail"
  | "moduleOutboundEmail"
  | "moduleReferrals"
  | "moduleCreativeStudio"
  | "moduleWebsite"
  | "moduleLeadCapture";

export type CatalogCategory =
  | "Acquisition"
  | "Engagement"
  | "Discovery"
  | "Operations"
  | "Pro Add-ons";

/**
 * How this entry behaves in the marketplace UI.
 *
 *   "toggle"   — flippable per-org Boolean (modulePixel, moduleChatbot, …).
 *                Free during trial, Stripe Checkout post-trial.
 *   "included" — always-on for every plan. Renders with an "Included" pill
 *                and a "Use it" deep-link instead of an Activate button.
 *   "addon"    — Stripe-billed add-on (Reputation Pro, White-label). Has
 *                no module<X> flag — activation always routes to billing.
 *   "coming"   — Coming soon. Greyed out, "Notify me" CTA, never activates.
 */
export type CatalogEntryKind = "toggle" | "included" | "addon" | "coming";

export type CatalogEntry = {
  /** Stable id used by the toggle API + analytics. For toggles this is the
      Organization column name; for add-ons / included / coming it can be
      any unique slug. */
  key: ModuleKey | string;
  kind: CatalogEntryKind;
  slug: string;
  name: string;
  tagline: string;
  bullets: string[];
  /** Listed monthly price in cents. 0 for "Included". */
  monthlyPriceCents: number;
  /** Stripe price lookup key for paid post-trial activation or addon
      checkout. */
  stripeLookupKey?: string;
  /** Where to send the user after activation. For included entries this
      is the "Use it" link; for coming-soon it's an optional doc link. */
  setupHref: string;
  icon: LucideIcon;
  category: CatalogCategory;
  popular?: boolean;
  hidden?: boolean;
  /** One-line setup-effort hint shown under the price ("Drop-in code, 5 min",
      "Connect Google account", "We handle setup", etc.). Helps users gauge
      time-to-value. */
  setupEffort?: string;
};

// ---------------------------------------------------------------------------
// Catalog. Order matters — this is the visual order within a category.
// ---------------------------------------------------------------------------

export const MARKETPLACE_ENTRIES: CatalogEntry[] = [
  // ============== Acquisition ==============
  {
    key: "modulePixel",
    kind: "toggle",
    slug: "visitor-pixel",
    name: "Visitor Identification Pixel",
    tagline:
      "Identify anonymous prospects on your site — name, email, employer — without an opt-in form.",
    bullets: [
      "5,000 identified visitors / month",
      "Intent score per visitor (0–100)",
      "Auto-syncs to your CRM as warm leads",
      "Drop-in JS snippet",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_pixel_v1",
    setupHref: "/portal/visitors",
    icon: Eye,
    category: "Acquisition",
    popular: true,
    setupEffort: "Drop-in snippet · 5 min",
  },
  {
    key: "moduleLeadCapture",
    kind: "included",
    slug: "lead-capture",
    name: "Lead Capture",
    tagline:
      "Forms, public APIs, and inbox routing for every lead that comes through your site.",
    bullets: [
      "Tour-booking + contact forms",
      "Public ingest API for off-platform forms",
      "Auto-deduped against your CRM",
      "Source attribution per lead",
    ],
    monthlyPriceCents: 0,
    setupHref: "/portal/leads",
    icon: Users,
    category: "Acquisition",
    setupEffort: "Already on",
  },
  {
    key: "moduleGoogleAds",
    kind: "toggle",
    slug: "google-ads",
    name: "Google Ads Manager",
    tagline:
      "Connect Google Ads, surface spend / CPL / conversions next to leasing data, and let our team run campaigns.",
    bullets: [
      "Live spend + ROAS dashboards",
      "Lead → tour → lease attribution",
      "Auto-pause underperforming creatives",
      "DFY campaign builds (Search + PMax)",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_google_ads_v1",
    setupHref: "/portal/ads",
    icon: BarChart3,
    category: "Acquisition",
    setupEffort: "Connect Google Ads · OAuth",
  },
  {
    key: "moduleMetaAds",
    kind: "toggle",
    slug: "meta-ads",
    name: "Meta Ads Manager",
    tagline:
      "Facebook + Instagram ads with first-party-pixel retargeting and unified attribution.",
    bullets: [
      "Cursive pixel powers Custom Audiences",
      "Lead → tour → lease attribution",
      "Auto-pause / scale rules",
      "AI-drafted creative variants weekly",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_meta_ads_v1",
    setupHref: "/portal/ads",
    icon: BarChart3,
    category: "Acquisition",
    setupEffort: "Connect Meta · OAuth",
  },

  // ============== Engagement ==============
  {
    key: "moduleChatbot",
    kind: "toggle",
    slug: "ai-chatbot",
    name: "AI Leasing Chatbot",
    tagline:
      "24/7 trained chatbot that answers prospect questions, books tours, and captures leads while you sleep.",
    bullets: [
      "Trained on your property KB + amenities",
      "Books tours straight into your calendar",
      "Captures email even when prospects abandon",
      "Conversations sync into the CRM",
    ],
    monthlyPriceCents: 14900,
    stripeLookupKey: "ls_addon_chatbot_v1",
    setupHref: "/portal/chatbot",
    icon: Bot,
    category: "Engagement",
    popular: true,
    setupEffort: "Configure persona · 10 min",
  },
  {
    key: "moduleCreativeStudio",
    kind: "toggle",
    slug: "creative-studio",
    name: "Creative Studio",
    tagline:
      "On-demand brand-consistent creative for ads, social, and email — designed and shipped in 48 hours.",
    bullets: [
      "Static + motion ad creative",
      "Brand kit + creative library included",
      "Unlimited revisions",
      "48-hour turnaround guarantee",
    ],
    monthlyPriceCents: 49900,
    stripeLookupKey: "ls_addon_creative_v1",
    setupHref: "/portal/creative",
    icon: Brush,
    category: "Engagement",
    setupEffort: "Submit your first request",
  },

  // ============== Discovery ==============
  {
    key: "moduleSEO",
    kind: "toggle",
    slug: "seo-aeo",
    name: "Search + AI Discovery (SEO/AEO)",
    tagline:
      "Per-neighborhood landing pages built to rank in Google AND get cited by ChatGPT, Perplexity, Claude, Gemini.",
    bullets: [
      "Per-neighborhood + per-unit-type pages",
      "Schema markup + sitemap automation",
      "Monthly AI-citation audit (5 engines)",
      "GSC + GA4 connected for live SERP data",
    ],
    monthlyPriceCents: 24900,
    stripeLookupKey: "ls_addon_seo_v1",
    setupHref: "/portal/seo",
    icon: TrendingUp,
    category: "Discovery",
    popular: true,
    setupEffort: "Connect GSC + GA4 · OAuth",
  },
  {
    key: "moduleWebsite",
    kind: "toggle",
    slug: "marketing-site",
    name: "Hosted Marketing Site",
    tagline:
      "Per-property marketing site, hosted on your domain, with built-in lead capture, tour booking, and CRM sync.",
    bullets: [
      "Hosted on your domain (we handle DNS)",
      "Lead capture + tour booking built-in",
      "Mobile-first, ranks in Google",
      "Live AppFolio listing sync",
    ],
    monthlyPriceCents: 9900,
    stripeLookupKey: "ls_addon_website_v1",
    setupHref: "/portal/site-builder",
    icon: Globe,
    category: "Discovery",
    setupEffort: "Configure site · ~30 min",
  },

  // ============== Operations ==============
  {
    key: "reputation-monitoring",
    kind: "included",
    slug: "reputation",
    name: "Reputation Monitoring",
    tagline:
      "Google reviews, Reddit, Yelp, and the open web rolled into one inbox per property.",
    bullets: [
      "Continuous scan of every review source",
      "Sentiment-tagged + flagged for follow-up",
      "Per-property + portfolio rollups",
      "Reply-or-comment paths per source",
    ],
    monthlyPriceCents: 0,
    setupHref: "/portal/reputation",
    icon: Star,
    category: "Operations",
    setupEffort: "Already on",
  },
  {
    key: "moduleReferrals",
    kind: "toggle",
    slug: "referrals",
    name: "Resident Referrals",
    tagline:
      "Generate trackable referral links per property and attribute every resident-driven lead back to source.",
    bullets: [
      "Per-property shareable referral link",
      "Auto-tags inbound leads as REFERRAL",
      "Source attribution into your CRM",
    ],
    monthlyPriceCents: 9900,
    stripeLookupKey: "ls_addon_referrals_v1",
    setupHref: "/portal/referrals",
    icon: Share2,
    category: "Operations",
    setupEffort: "Generate link · 1 min",
  },

  // ============== Pro Add-ons (paid Stripe SKUs, not free during trial) ==============
  {
    key: "ls_addon_reputation_pro",
    kind: "addon",
    slug: "reputation-pro",
    name: "Reputation Pro",
    tagline:
      "Adds extended commercial + hospitality review sources on top of standard reputation monitoring.",
    bullets: [
      "Tripadvisor + Niche + ApartmentRatings deep crawl",
      "Faster scan cadence (6h vs 24h)",
      "Adds to the same inbox you already have",
      "Self-serve, on by default once subscribed",
    ],
    monthlyPriceCents: 9900,
    stripeLookupKey: "ls_reputation_pro_monthly_v1",
    setupHref: "/portal/billing?addon=reputation-pro",
    icon: Sparkles,
    category: "Pro Add-ons",
    setupEffort: "Stripe checkout · instant",
  },
  {
    key: "ls_addon_white_label",
    kind: "addon",
    slug: "white-label",
    name: "White-label Workspace",
    tagline:
      "Removes LeaseStack branding from the tenant portal, public marketing site, and outbound emails.",
    bullets: [
      "Your logo + brand on the portal",
      "Tenant sites carry no LeaseStack mark",
      "Outbound emails sent from your domain",
      "Useful for agencies + private-label resellers",
    ],
    monthlyPriceCents: 49900,
    stripeLookupKey: "ls_white_label_monthly_v1",
    setupHref: "/portal/billing?addon=white-label",
    icon: Sparkles,
    category: "Pro Add-ons",
    setupEffort: "Stripe checkout + brand kit",
  },

  // ============== Coming soon (honest about what's not built yet) ==============
  {
    key: "moduleEmail",
    kind: "coming",
    slug: "email-nurture",
    name: "Email Nurture Sequences",
    tagline:
      "Operator-curated drip campaigns for leads, tour no-shows, and renewal windows. Building now.",
    bullets: [
      "Visual sequence builder",
      "Personalised by property + unit type",
      "Open / click / reply analytics per step",
      "Triggered by CRM stage changes",
    ],
    monthlyPriceCents: 9900,
    setupHref: "/portal/marketplace",
    icon: Mail,
    category: "Engagement",
    setupEffort: "Coming soon",
  },
  {
    key: "moduleOutboundEmail",
    kind: "coming",
    slug: "outbound-email",
    name: "Outbound Email",
    tagline:
      "Cold-outbound to ICP-matched prospect lists with deliverability built-in. Building now.",
    bullets: [
      "Domain warmup ramp",
      "Spam-test scoring before every send",
      "List import + suppression management",
      "DKIM / SPF / DMARC auto-configured",
    ],
    monthlyPriceCents: 14900,
    setupHref: "/portal/marketplace",
    icon: Send,
    category: "Acquisition",
    setupEffort: "Coming soon",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOGGLEABLE_KEYS = new Set<string>(
  MARKETPLACE_ENTRIES.filter((e) => e.kind === "toggle").map((e) => e.key),
);

/**
 * Allowlist guard for the toggle API. Only entries with kind="toggle" can
 * be flipped on/off via /api/portal/marketplace/toggle. Add-ons go through
 * Stripe Checkout, included modules can't be turned off, and coming-soon
 * entries reject every toggle attempt.
 */
export function isValidModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && TOGGLEABLE_KEYS.has(value);
}

export function getModuleByKey(key: string): CatalogEntry | null {
  return MARKETPLACE_ENTRIES.find((e) => e.key === key) ?? null;
}

export function groupModulesByCategory(): Array<{
  category: CatalogCategory;
  modules: CatalogEntry[];
}> {
  const order: CatalogCategory[] = [
    "Acquisition",
    "Engagement",
    "Discovery",
    "Operations",
    "Pro Add-ons",
  ];
  return order.map((category) => ({
    category,
    modules: MARKETPLACE_ENTRIES.filter(
      (e) => e.category === category && !e.hidden,
    ),
  }));
}

export function formatPriceUsd(cents: number): string {
  if (cents === 0) return "Free";
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

// Backwards compat — older imports referenced these names. Keep aliases so
// the page server component + tests don't need to be touched.
export const MARKETPLACE_MODULES = MARKETPLACE_ENTRIES;
export type CatalogModule = CatalogEntry;
