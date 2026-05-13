import "server-only";

// ---------------------------------------------------------------------------
// Marketplace catalog
//
// The user-facing à-la-carte module catalog rendered on /portal/marketplace.
// Each entry maps to a `module*` boolean flag on the Organization model
// (prisma/schema.prisma lines 351–362). Toggling a card flips the
// corresponding flag.
//
// Pricing model:
//   - During trial (subscriptionStatus=TRIALING), every module is FREE to
//     activate. Users add modules to their cart, hit "Unlock all", and
//     every flag flips on at zero cost — the goal is maximum platform
//     surface exploration during the 14-day window.
//   - After trial, activating a previously-locked module routes the user
//     into the Stripe Customer Portal (or a Checkout session) where they
//     pay the listed `monthlyPriceCents`.
//
// Adding a new module:
//   1. Add the `module*` Boolean to Organization in prisma/schema.prisma
//   2. Add a CatalogModule entry below
//   3. Add the corresponding nav predicate in components/portal/portal-nav.tsx
//   4. Wire any setup page at /portal/<slug>/setup if it needs configuration
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
  | "moduleWebsite";

export type CatalogCategory =
  | "Acquisition"
  | "Engagement"
  | "Discovery"
  | "Operations";

export type CatalogModule = {
  /** The Organization column we toggle. Must match prisma/schema.prisma. */
  key: ModuleKey;
  /** URL-safe slug. Used for cart deep links and analytics. */
  slug: string;
  /** Display name on the card. */
  name: string;
  /** One-sentence value prop, ~140 chars max. Renders under the name. */
  tagline: string;
  /** 3–5 short bullets of what unlocks. Rendered as a check-list. */
  bullets: string[];
  /** Listed price after trial. Free during trial regardless of value. */
  monthlyPriceCents: number;
  /** Optional Stripe price lookup key for post-trial activation. */
  stripeLookupKey?: string;
  /** Where to send the user after activation for setup. */
  setupHref: string;
  /** Brand icon. */
  icon: LucideIcon;
  /** Logical grouping for the marketplace shelf. */
  category: CatalogCategory;
  /** Marks the most-clicked / conversion-leading items. */
  popular?: boolean;
  /** Hides the card when true (e.g. for legacy modules). */
  hidden?: boolean;
};

// Order matters — this is the visual order on the shelf within a category.
export const MARKETPLACE_MODULES: CatalogModule[] = [
  {
    key: "modulePixel",
    slug: "visitor-pixel",
    name: "Visitor Identification Pixel",
    tagline:
      "Identify the actual prospects on your site — name, email, employer — without an opt-in form.",
    bullets: [
      "5,000+ identified visitors / month",
      "Auto-syncs to your CRM as warm leads",
      "Intent score per visitor (0–100)",
      "Drop-in JS snippet, ships in 5 minutes",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_pixel_v1",
    setupHref: "/portal/setup",
    icon: Eye,
    category: "Acquisition",
    popular: true,
  },
  {
    key: "moduleChatbot",
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
  },
  {
    key: "moduleSEO",
    slug: "seo-aeo",
    name: "Search + AI Discovery (SEO/AEO)",
    tagline:
      "Per-neighborhood landing pages built to rank in Google AND get cited by ChatGPT, Perplexity, Claude, Gemini.",
    bullets: [
      "Per-neighborhood + per-unit-type pages",
      "Schema markup + sitemap automation",
      "Monthly AI-citation audit (5 engines)",
      "Built-in technical SEO health checks",
    ],
    monthlyPriceCents: 24900,
    stripeLookupKey: "ls_addon_seo_v1",
    setupHref: "/portal/seo",
    icon: TrendingUp,
    category: "Discovery",
    popular: true,
  },
  {
    key: "moduleGoogleAds",
    slug: "google-ads",
    name: "Google Ads Manager",
    tagline:
      "Connect your Google Ads, surface spend / CPL / conversions next to leasing data, and let our team run campaigns.",
    bullets: [
      "Live spend + ROAS dashboards",
      "Auto-pause underperforming creatives",
      "DFY campaign builds (Search + PMax)",
      "Attribution back to signed leases",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_google_ads_v1",
    setupHref: "/portal/ads",
    icon: BarChart3,
    category: "Acquisition",
  },
  {
    key: "moduleMetaAds",
    slug: "meta-ads",
    name: "Meta Ads Manager",
    tagline:
      "Facebook + Instagram ads with first-party-pixel retargeting, brand-safe creative, and unified attribution.",
    bullets: [
      "Cursive pixel powers Custom Audiences",
      "AI-drafted creative variants weekly",
      "Auto-pause / scale rules",
      "Lead → tour → lease attribution",
    ],
    monthlyPriceCents: 19900,
    stripeLookupKey: "ls_addon_meta_ads_v1",
    setupHref: "/portal/ads",
    icon: BarChart3,
    category: "Acquisition",
  },
  {
    key: "moduleEmail",
    slug: "email-nurture",
    name: "Email Nurture",
    tagline:
      "Automated email sequences that warm cold leads into tours and convert tour no-shows into applications.",
    bullets: [
      "Pre-built sequences for every funnel stage",
      "Personalised by property + unit type",
      "Deliverability monitoring + bounce handling",
      "Open / click / reply analytics per sequence",
    ],
    monthlyPriceCents: 9900,
    stripeLookupKey: "ls_addon_email_v1",
    setupHref: "/portal/conversations",
    icon: Mail,
    category: "Engagement",
  },
  {
    key: "moduleOutboundEmail",
    slug: "outbound-email",
    name: "Outbound Email",
    tagline:
      "Cold-outbound to ICP-matched prospect lists with deliverability built-in. Land in the inbox, not promotions.",
    bullets: [
      "DKIM / SPF / DMARC auto-configured",
      "Daily warmup volume ramp",
      "Spam-test scoring before every send",
      "3,000 sends / month included",
    ],
    monthlyPriceCents: 14900,
    stripeLookupKey: "ls_addon_outbound_email_v1",
    setupHref: "/portal/conversations",
    icon: Send,
    category: "Acquisition",
  },
  {
    key: "moduleCreativeStudio",
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
  },
  {
    key: "moduleReferrals",
    slug: "referrals",
    name: "Resident Referrals",
    tagline:
      "Turn happy residents into your best lead source with a managed referral + reward program.",
    bullets: [
      "Branded referral portal per property",
      "Automated rewards (gift cards, rent credits)",
      "Track resident → lead → lease attribution",
      "Email + SMS nudges to top referrers",
    ],
    monthlyPriceCents: 9900,
    stripeLookupKey: "ls_addon_referrals_v1",
    setupHref: "/portal/referrals",
    icon: Share2,
    category: "Operations",
  },
  {
    key: "moduleWebsite",
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
    setupHref: "/portal/setup",
    icon: Globe,
    category: "Discovery",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODULE_KEYS = new Set<string>(MARKETPLACE_MODULES.map((m) => m.key));

/** Strict allowlist guard for the toggle API. */
export function isValidModuleKey(value: unknown): value is ModuleKey {
  return typeof value === "string" && MODULE_KEYS.has(value);
}

export function getModuleByKey(key: ModuleKey): CatalogModule | null {
  return MARKETPLACE_MODULES.find((m) => m.key === key) ?? null;
}

export function groupModulesByCategory(): Array<{
  category: CatalogCategory;
  modules: CatalogModule[];
}> {
  const order: CatalogCategory[] = [
    "Acquisition",
    "Engagement",
    "Discovery",
    "Operations",
  ];
  return order.map((category) => ({
    category,
    modules: MARKETPLACE_MODULES.filter(
      (m) => m.category === category && !m.hidden,
    ),
  }));
}

export function formatPriceUsd(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}
