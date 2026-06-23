// ---------------------------------------------------------------------------
// source-taxonomy.ts — the single canonical registry of lead/traffic sources.
//
// Every attribution surface (charts, flow diagram, leaderboard) classifies raw
// signal through THIS file so a referrer of "zillow.com", a UTM source of
// "zillow", and a GA4 sessionSource of "zillow.com" all collapse to the one
// canonical "Zillow" channel with its brand color + logo.
//
// No React here — this is pure data + classifiers so it can be imported from
// server queries, GA4 fusion, and client components alike.
// ---------------------------------------------------------------------------

import type { LeadSource } from "@prisma/client";

export type SourceCategory =
  | "ils" // Internet Listing Services — Zillow, Apartments.com, etc.
  | "search" // Organic search engines
  | "ai" // AI assistants / answer engines
  | "paid" // Paid acquisition channels
  | "social" // Organic social referrers
  | "owned" // Our own capture surfaces — chatbot, forms, pixel, email
  | "referral" // Generic inbound referral
  | "direct" // Type-in / bookmark / untagged
  | "other";

export type CanonicalSource = {
  id: string;
  label: string;
  category: SourceCategory;
  /** Brand hex used for the flow stream + logo tint. */
  color: string;
  /** Slug the <SourceLogo> dispatcher renders a mark for. */
  logo: string;
  /** Referrer hostname fragments that resolve to this source. */
  matchHosts: string[];
  /** UTM source values (lowercased, substring) that resolve to this source. */
  matchUtm: string[];
};

// Order matters: classifiers walk this list top-to-bottom and take the first
// host/utm match, so more specific brands precede generic search/social.
export const CANONICAL_SOURCES: CanonicalSource[] = [
  // --- ILS (Internet Listing Services) ------------------------------------
  { id: "zillow", label: "Zillow", category: "ils", color: "#006AFF", logo: "zillow", matchHosts: ["zillow."], matchUtm: ["zillow"] },
  { id: "apartments_com", label: "Apartments.com", category: "ils", color: "#1577B7", logo: "apartments_com", matchHosts: ["apartments.com"], matchUtm: ["apartments.com", "apartmentscom"] },
  { id: "trulia", label: "Trulia", category: "ils", color: "#0F9D58", logo: "trulia", matchHosts: ["trulia."], matchUtm: ["trulia"] },
  { id: "realtor_com", label: "Realtor.com", category: "ils", color: "#D92228", logo: "realtor_com", matchHosts: ["realtor.com"], matchUtm: ["realtor"] },
  { id: "hotpads", label: "HotPads", category: "ils", color: "#FF5A5F", logo: "hotpads", matchHosts: ["hotpads."], matchUtm: ["hotpads"] },
  { id: "apartment_list", label: "Apartment List", category: "ils", color: "#2D7FF9", logo: "apartment_list", matchHosts: ["apartmentlist."], matchUtm: ["apartmentlist", "apartment_list"] },
  { id: "zumper", label: "Zumper", category: "ils", color: "#FF5A60", logo: "zumper", matchHosts: ["zumper."], matchUtm: ["zumper"] },
  { id: "padmapper", label: "PadMapper", category: "ils", color: "#00A8E1", logo: "padmapper", matchHosts: ["padmapper."], matchUtm: ["padmapper"] },
  { id: "rent_com", label: "Rent.", category: "ils", color: "#5B2D8E", logo: "rent_com", matchHosts: ["rent.com", "rentpath"], matchUtm: ["rent.com", "rentcom"] },
  { id: "apartmentguide", label: "ApartmentGuide", category: "ils", color: "#F47B20", logo: "apartmentguide", matchHosts: ["apartmentguide."], matchUtm: ["apartmentguide"] },
  { id: "rentcafe", label: "RentCafe", category: "ils", color: "#00A28F", logo: "rentcafe", matchHosts: ["rentcafe."], matchUtm: ["rentcafe"] },
  { id: "craigslist", label: "Craigslist", category: "ils", color: "#5C2D91", logo: "craigslist", matchHosts: ["craigslist."], matchUtm: ["craigslist"] },
  { id: "loopnet", label: "LoopNet", category: "ils", color: "#0E4D8B", logo: "loopnet", matchHosts: ["loopnet."], matchUtm: ["loopnet"] },

  // --- AI answer engines (precede search; some live on google domains) -----
  { id: "chatgpt", label: "ChatGPT", category: "ai", color: "#10A37F", logo: "chatgpt", matchHosts: ["chatgpt.", "chat.openai."], matchUtm: ["chatgpt", "openai"] },
  { id: "perplexity", label: "Perplexity", category: "ai", color: "#20808D", logo: "perplexity", matchHosts: ["perplexity."], matchUtm: ["perplexity"] },
  { id: "gemini", label: "Gemini", category: "ai", color: "#8E75F8", logo: "gemini", matchHosts: ["gemini.google."], matchUtm: ["gemini"] },
  { id: "claude_ai", label: "Claude", category: "ai", color: "#D97757", logo: "claude_ai", matchHosts: ["claude.ai"], matchUtm: ["claude"] },

  // --- Paid (resolved primarily via LeadSource enum / utm medium) ----------
  { id: "google_ads", label: "Google Ads", category: "paid", color: "#4285F4", logo: "google_ads", matchHosts: [], matchUtm: ["google-ads", "googleads", "gads", "adwords"] },
  { id: "meta_ads", label: "Meta Ads", category: "paid", color: "#0866FF", logo: "meta_ads", matchHosts: [], matchUtm: ["meta-ads", "metaads", "fb-ads", "facebook-ads"] },

  // --- Organic social ------------------------------------------------------
  { id: "facebook", label: "Facebook", category: "social", color: "#0866FF", logo: "facebook", matchHosts: ["facebook.", "fb.com", "fb.me", "lm.facebook"], matchUtm: ["facebook", "fb"] },
  { id: "instagram", label: "Instagram", category: "social", color: "#E4405F", logo: "instagram", matchHosts: ["instagram.", "l.instagram"], matchUtm: ["instagram", "ig"] },
  { id: "tiktok", label: "TikTok", category: "social", color: "#010101", logo: "tiktok", matchHosts: ["tiktok."], matchUtm: ["tiktok"] },
  { id: "linkedin", label: "LinkedIn", category: "social", color: "#0A66C2", logo: "linkedin", matchHosts: ["linkedin.", "lnkd.in"], matchUtm: ["linkedin"] },
  { id: "reddit", label: "Reddit", category: "social", color: "#FF4500", logo: "reddit", matchHosts: ["reddit.", "redd.it"], matchUtm: ["reddit"] },
  { id: "youtube", label: "YouTube", category: "social", color: "#FF0000", logo: "youtube", matchHosts: ["youtube.", "youtu.be"], matchUtm: ["youtube"] },
  { id: "x_twitter", label: "X / Twitter", category: "social", color: "#010101", logo: "x_twitter", matchHosts: ["twitter.", "x.com", "t.co"], matchUtm: ["twitter", "x.com"] },

  // --- Organic search ------------------------------------------------------
  { id: "google_organic", label: "Google", category: "search", color: "#4285F4", logo: "google", matchHosts: ["google."], matchUtm: ["google"] },
  { id: "bing_organic", label: "Bing", category: "search", color: "#258FFA", logo: "bing", matchHosts: ["bing."], matchUtm: ["bing"] },
  { id: "duckduckgo", label: "DuckDuckGo", category: "search", color: "#DE5833", logo: "duckduckgo", matchHosts: ["duckduckgo."], matchUtm: ["duckduckgo", "ddg"] },
  { id: "yahoo", label: "Yahoo", category: "search", color: "#6001D2", logo: "yahoo", matchHosts: ["search.yahoo.", "yahoo."], matchUtm: ["yahoo"] },

  // --- Owned capture surfaces ---------------------------------------------
  { id: "chatbot", label: "Chatbot", category: "owned", color: "#2563EB", logo: "chatbot", matchHosts: [], matchUtm: ["chatbot"] },
  { id: "web_form", label: "Web form", category: "owned", color: "#1D4ED8", logo: "web_form", matchHosts: [], matchUtm: ["form", "webform"] },
  { id: "pixel_outreach", label: "Pixel outreach", category: "owned", color: "#7C3AED", logo: "pixel_outreach", matchHosts: [], matchUtm: ["pixel", "pixel-outreach"] },
  { id: "email", label: "Email", category: "owned", color: "#0EA5E9", logo: "email", matchHosts: ["mail.google.", "outlook."], matchUtm: ["email", "newsletter", "drip", "cold-email"] },

  // --- Catch-alls ----------------------------------------------------------
  { id: "referral", label: "Referral", category: "referral", color: "#6B7280", logo: "referral", matchHosts: [], matchUtm: ["referral"] },
  { id: "manual", label: "Manual entry", category: "other", color: "#6B7280", logo: "manual", matchHosts: [], matchUtm: ["manual"] },
  { id: "direct", label: "Direct", category: "direct", color: "#94A3B8", logo: "direct", matchHosts: [], matchUtm: ["direct", "(direct)", "(none)"] },
  { id: "other", label: "Other", category: "other", color: "#9CA3AF", logo: "other", matchHosts: [], matchUtm: [] },
];

// Canonical id → primary domain, used to fetch the real brand logo
// (logo.clearbit.com/{domain}). Owned surfaces have no external domain and
// fall back to a lucide glyph in <SourceLogo>.
export const SOURCE_DOMAIN: Record<string, string> = {
  zillow: "zillow.com",
  apartments_com: "apartments.com",
  trulia: "trulia.com",
  realtor_com: "realtor.com",
  hotpads: "hotpads.com",
  apartment_list: "apartmentlist.com",
  zumper: "zumper.com",
  padmapper: "padmapper.com",
  rent_com: "rent.com",
  apartmentguide: "apartmentguide.com",
  rentcafe: "rentcafe.com",
  craigslist: "craigslist.org",
  loopnet: "loopnet.com",
  chatgpt: "openai.com",
  perplexity: "perplexity.ai",
  gemini: "gemini.google.com",
  claude_ai: "claude.ai",
  google_ads: "google.com",
  meta_ads: "facebook.com",
  facebook: "facebook.com",
  instagram: "instagram.com",
  tiktok: "tiktok.com",
  linkedin: "linkedin.com",
  reddit: "reddit.com",
  youtube: "youtube.com",
  x_twitter: "x.com",
  google_organic: "google.com",
  bing_organic: "bing.com",
  duckduckgo: "duckduckgo.com",
  yahoo: "yahoo.com",
};

const BY_ID: Record<string, CanonicalSource> = Object.fromEntries(
  CANONICAL_SOURCES.map((s) => [s.id, s]),
);

const FALLBACK: CanonicalSource = BY_ID.other;
const DIRECT: CanonicalSource = BY_ID.direct;

/** Resolve a canonical source by id, falling back to "Other". */
export function getSource(id: string): CanonicalSource {
  return BY_ID[id] ?? FALLBACK;
}

// Map the Prisma LeadSource enum onto canonical ids. This is the last-touch
// classification already baked into each lead at creation time.
const LEAD_SOURCE_TO_CANONICAL: Record<LeadSource, string> = {
  CHATBOT: "chatbot",
  FORM: "web_form",
  PIXEL_OUTREACH: "pixel_outreach",
  REFERRAL: "referral",
  GOOGLE_ADS: "google_ads",
  META_ADS: "meta_ads",
  ORGANIC: "google_organic",
  DIRECT: "direct",
  EMAIL_CAMPAIGN: "email",
  COLD_EMAIL: "email",
  MANUAL: "manual",
  OTHER: "other",
};

export function sourceFromLeadEnum(source: LeadSource): CanonicalSource {
  return getSource(LEAD_SOURCE_TO_CANONICAL[source] ?? "other");
}

/**
 * Classify raw session signal (utmSource / utmMedium / referrer) into one
 * canonical source. Precedence:
 *   1. Paid intent (utm medium = cpc/paid + a known engine)
 *   2. Explicit UTM source match
 *   3. Referrer hostname match
 *   4. Direct
 */
export function classifySource(
  utmSource: string | null | undefined,
  referrer: string | null | undefined,
  utmMedium?: string | null | undefined,
): CanonicalSource {
  const utm = utmSource?.trim().toLowerCase() ?? "";
  const medium = utmMedium?.trim().toLowerCase() ?? "";

  // 1. Paid intent: a cpc/ppc/paid medium on a known engine → the ads channel.
  if (utm && (medium.includes("cpc") || medium.includes("ppc") || medium.includes("paid"))) {
    if (utm.includes("google")) return BY_ID.google_ads;
    if (utm.includes("facebook") || utm.includes("meta") || utm.includes("instagram")) return BY_ID.meta_ads;
  }

  // 2. Explicit UTM source.
  if (utm) {
    const byUtm = CANONICAL_SOURCES.find((s) => s.matchUtm.some((m) => utm.includes(m)));
    if (byUtm) return byUtm;
  }

  // 3. Referrer hostname.
  const host = hostOf(referrer);
  if (host) {
    const byHost = CANONICAL_SOURCES.find((s) => s.matchHosts.some((h) => host.includes(h)));
    if (byHost) return byHost;
    // Unknown but real referrer → generic referral (keeps the hostname as detail).
    return { ...BY_ID.referral, label: host };
  }

  // 4. No signal at all.
  return DIRECT;
}

function hostOf(referrer: string | null | undefined): string | null {
  if (!referrer || !referrer.trim()) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
