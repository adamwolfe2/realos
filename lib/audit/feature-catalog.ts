// Feature catalog — single source of truth for the LeaseStack features
// the audit recommendation engine can surface.
//
// Every action item on the /audit result page is tagged with a feature
// slug. That slug routes through this catalog to:
//   1. A dedicated `/features/<slug>` page when one exists (high-quality
//      page authored by the team — see /features/pixel, /features/chatbot,
//      etc).
//   2. Otherwise, `/onboarding?feature=<slug>` so sales captures the
//      operator's signal even on features that don't have public proof
//      pages yet.
//
// Adam 2026-06-01: do NOT auto-generate stub feature pages. If a feature
// page doesn't meet the bar of /features/pixel (interactive demo, clear
// problem/how/look), it routes through onboarding instead.

import type { Pillar } from "./quiz-questions";

export interface FeatureCatalogEntry {
  slug: string;
  /** Operator-facing name. */
  title: string;
  /** One-line description used inside recommendation cards. */
  blurb: string;
  /** Pillar the feature primarily reinforces. */
  pillar: Pillar;
  /** True when a real `/features/<slug>` page exists. Drives the CTA copy. */
  hasPage: boolean;
}

// Slugs in this catalog must match (a) the recommendation engine's
// featureSlug field and (b) the directory name under
// `app/(platform)/features/<slug>` when `hasPage` is true.
export const FEATURE_CATALOG: Record<string, FeatureCatalogEntry> = {
  // ----- Features with dedicated /features/<slug> pages --------------------
  chatbot: {
    slug: "chatbot",
    title: "AI Chatbot",
    blurb: "Books tours 24/7, hot leads by morning.",
    pillar: "conversion",
    hasPage: true,
  },
  pixel: {
    slug: "pixel",
    title: "Visitor Identification",
    blurb: "Names and emails on anonymous traffic, before they fill a form.",
    pillar: "tracking",
    hasPage: true,
  },
  ads: {
    slug: "ads",
    title: "Managed Ads",
    blurb: "Spend tied to signed leases, not impressions.",
    pillar: "tracking",
    hasPage: true,
  },
  "seo-aeo": {
    slug: "seo-aeo",
    title: "SEO & AEO",
    blurb: "Rank on Google, get cited by ChatGPT, Claude, Perplexity, Gemini.",
    pillar: "findability",
    hasPage: true,
  },
  "keyword-trends": {
    slug: "keyword-trends",
    title: "Keyword Trends",
    blurb: "Weekly rank tracking on every query that matters.",
    pillar: "findability",
    hasPage: true,
  },
  "website-build": {
    slug: "website-build",
    title: "Website Build",
    blurb: "Live on your domain in 14 days. Conversion-built, not pretty-built.",
    pillar: "conversion",
    hasPage: true,
  },
  popups: {
    slug: "popups",
    title: "Popups",
    blurb: "Exit-intent + scroll-trigger capture for off-hours leads.",
    pillar: "conversion",
    hasPage: true,
  },

  // ----- Features routed through /onboarding until authored ----------------
  reputation: {
    slug: "reputation",
    title: "Reputation Management",
    blurb: "Every public mention, every 90 days, with reply suggestions.",
    pillar: "reputation",
    hasPage: false,
  },
  attribution: {
    slug: "attribution",
    title: "Per-property attribution",
    blurb: "Which channel filled which unit — at property and portfolio level.",
    pillar: "tracking",
    hasPage: false,
  },
  "lead-sources": {
    slug: "lead-sources",
    title: "Lead source tracking",
    blurb: "One source of truth for website, chatbot, calendar, ILS leads.",
    pillar: "tracking",
    hasPage: false,
  },
  "tour-tracking": {
    slug: "tour-tracking",
    title: "Tour tracking",
    blurb: "Every tour booked, every show, every no-show, in one place.",
    pillar: "conversion",
    hasPage: false,
  },
  "market-intelligence": {
    slug: "market-intelligence",
    title: "Portfolio market intelligence",
    blurb:
      "Real-time commercial, residential, and price data across your portfolio.",
    pillar: "findability",
    hasPage: false,
  },
  "resident-ops": {
    slug: "resident-ops",
    title: "Resident operations",
    blurb: "Renewals, work orders, applications — tracked alongside marketing.",
    pillar: "conversion",
    hasPage: false,
  },
  "aeo-briefing": {
    slug: "aeo-briefing",
    title: "AEO referral insights",
    blurb: "See which AI engines drove the visit, which prompts surfaced you.",
    pillar: "findability",
    hasPage: false,
  },
  "apartments-com-sync": {
    slug: "apartments-com-sync",
    title: "Apartments.com source of truth",
    blurb: "One inventory feed, synced everywhere, never out of date.",
    pillar: "listings",
    hasPage: false,
  },
};

/** Returns the CTA destination + label for a feature slug. */
export function getFeatureCta(slug: string): {
  href: string;
  label: string;
} | null {
  const entry = FEATURE_CATALOG[slug];
  if (!entry) return null;
  if (entry.hasPage) {
    return {
      href: `/features/${entry.slug}`,
      label: "See it live →",
    };
  }
  return {
    href: `/onboarding?feature=${encodeURIComponent(entry.slug)}`,
    label: "Talk to us about this →",
  };
}

/** Resolve a feature entry by slug, or null. Used by the recommendation
 *  renderer to fetch title + blurb when building cards. */
export function getFeature(slug: string): FeatureCatalogEntry | null {
  return FEATURE_CATALOG[slug] ?? null;
}
