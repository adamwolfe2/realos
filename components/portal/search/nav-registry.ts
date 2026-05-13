// ---------------------------------------------------------------------------
// Cmd+K navigation registry.
//
// Static catalogue of every page + module reachable from the portal so the
// global search can route users to "seo", "marketplace", "billing" etc.
// even when the org has zero data records to match against. Filtered
// client-side — no API round-trip needed since the list is fixed.
//
// Add new entries here whenever a new page lands. Keywords are searched
// in addition to the label so common synonyms (e.g. "ads" → Campaigns,
// "calls" → Conversations) still hit.
// ---------------------------------------------------------------------------

export type NavRegistryItem = {
  /** Where the user lands. */
  href: string;
  /** Visible primary label in the result row. */
  label: string;
  /** One-liner shown under the label. Keep ≤ 70 chars. */
  description: string;
  /** Extra terms matched in addition to the label. */
  keywords: string[];
  /** Logical bucket. Drives the section header in the results list. */
  group: NavGroupKey;
};

export type NavGroupKey =
  | "Pages"
  | "Modules"
  | "Settings";

export const NAV_REGISTRY: NavRegistryItem[] = [
  // Top-level pages
  {
    href: "/portal",
    label: "Dashboard",
    description: "Cross-property home — leads, occupancy, ads, reputation",
    keywords: ["home", "overview", "kpis"],
    group: "Pages",
  },
  {
    href: "/portal/marketplace",
    label: "Marketplace",
    description: "Activate add-on modules — free during your trial",
    keywords: ["addons", "add-ons", "modules", "store", "cart", "unlock", "buy"],
    group: "Pages",
  },
  {
    href: "/portal/setup",
    label: "Setup",
    description: "First-time onboarding checklist for your portal",
    keywords: ["onboarding", "wizard", "getting started", "checklist"],
    group: "Pages",
  },
  {
    href: "/portal/attribution",
    label: "Attribution",
    description: "Channel performance — leads, tours, leases by source",
    keywords: ["analytics", "channels", "sources", "roi", "report"],
    group: "Pages",
  },
  {
    href: "/portal/properties",
    label: "Properties",
    description: "Every property in your portfolio",
    keywords: ["units", "buildings", "portfolio"],
    group: "Pages",
  },
  {
    href: "/portal/leads",
    label: "Leads",
    description: "Inbound prospects across every channel",
    keywords: ["prospects", "inquiries", "crm", "pipeline"],
    group: "Pages",
  },
  {
    href: "/portal/tours",
    label: "Tours",
    description: "Booked and pending property showings",
    keywords: ["showings", "appointments", "calendar"],
    group: "Pages",
  },
  {
    href: "/portal/visitors",
    label: "Visitors",
    description: "Identified visitors from your Cursive pixel feed",
    keywords: ["pixel", "anonymous", "cursive", "identified"],
    group: "Pages",
  },
  {
    href: "/portal/applications",
    label: "Applications",
    description: "Lease applications from your tenant marketing site",
    keywords: ["apply", "lease application", "renters"],
    group: "Pages",
  },
  {
    href: "/portal/reputation",
    label: "Reputation",
    description: "Google, Reddit, Yelp, and AI-engine mentions in one inbox",
    keywords: ["reviews", "mentions", "yelp", "google reviews", "ratings"],
    group: "Pages",
  },
  {
    href: "/portal/residents",
    label: "Residents",
    description: "Active and notice-given residents synced from AppFolio",
    keywords: ["tenants", "appfolio", "leases"],
    group: "Pages",
  },
  {
    href: "/portal/renewals",
    label: "Renewals",
    description: "Leases coming up for renewal in the next 120 days",
    keywords: ["lease renewals", "expirations"],
    group: "Pages",
  },
  {
    href: "/portal/conversations",
    label: "Conversations",
    description: "AI chatbot conversations with prospects",
    keywords: ["chats", "messages", "calls", "chatbot history"],
    group: "Pages",
  },
  {
    href: "/portal/chatbot",
    label: "Chatbot",
    description: "Configure and train your leasing chatbot",
    keywords: ["bot", "ai", "chat widget", "leasing agent"],
    group: "Modules",
  },
  {
    href: "/portal/ads",
    label: "Ads",
    description: "Live spend, CPL, and conversions from Google + Meta Ads",
    keywords: ["google ads", "meta ads", "facebook", "instagram", "ppc", "paid"],
    group: "Pages",
  },
  {
    href: "/portal/campaigns",
    label: "Campaigns",
    description: "Campaign builds across every paid channel",
    keywords: ["ad campaigns", "marketing campaigns"],
    group: "Pages",
  },
  {
    href: "/portal/creative",
    label: "Creative Studio",
    description: "Request and review on-brand ad creative",
    keywords: ["design", "creative requests", "ad creative", "graphics"],
    group: "Pages",
  },
  {
    href: "/portal/seo",
    label: "SEO",
    description: "Per-neighborhood landing pages, citations, and AI discovery",
    keywords: ["aeo", "search", "google search", "rankings", "schema", "ai discovery", "perplexity", "chatgpt"],
    group: "Modules",
  },
  {
    href: "/portal/referrals",
    label: "Resident Referrals",
    description: "Resident-driven leads with managed rewards",
    keywords: ["referral program", "rewards"],
    group: "Modules",
  },
  {
    href: "/portal/briefing",
    label: "Briefing",
    description: "AI-drafted call sheet of what to action this week",
    keywords: ["weekly briefing", "ai brief", "summary"],
    group: "Pages",
  },
  {
    href: "/portal/insights",
    label: "Insights",
    description: "AI-generated insights across your portfolio",
    keywords: ["ai insights", "recommendations"],
    group: "Pages",
  },
  {
    href: "/portal/reports",
    label: "Reports",
    description: "Weekly and monthly owner reports",
    keywords: ["owner reports", "monthly report"],
    group: "Pages",
  },

  // Settings
  {
    href: "/portal/billing",
    label: "Billing",
    description: "Subscription, invoices, payment method, add-ons",
    keywords: [
      "subscription",
      "invoice",
      "payment",
      "credit card",
      "stripe",
      "trial",
      "upgrade",
      "downgrade",
      "cancel",
      "plan",
    ],
    group: "Settings",
  },
  {
    href: "/portal/settings",
    label: "Settings",
    description: "Workspace, brand, and team configuration",
    keywords: ["workspace", "preferences", "configuration"],
    group: "Settings",
  },
  {
    href: "/portal/settings/team-panel",
    label: "Team",
    description: "Invite teammates and manage roles",
    keywords: ["users", "invite", "roles", "permissions", "members"],
    group: "Settings",
  },
  {
    href: "/portal/settings/integrations",
    label: "Integrations",
    description: "AppFolio, GA4, GSC, Google Ads, Meta Ads, Cursive pixel",
    keywords: [
      "appfolio",
      "google analytics",
      "ga4",
      "google search console",
      "gsc",
      "google ads",
      "meta ads",
      "cursive",
      "pixel",
      "connect",
    ],
    group: "Settings",
  },
  {
    href: "/portal/settings/api-keys",
    label: "API keys",
    description: "Generate and rotate keys for the public ingest API",
    keywords: ["api key", "tokens", "ingest", "webhook auth"],
    group: "Settings",
  },
  {
    href: "/portal/notifications",
    label: "Notifications",
    description: "In-app inbox of mentions, alerts, and digest reports",
    keywords: ["alerts", "inbox", "bell"],
    group: "Settings",
  },
];

/**
 * Lightweight client-side fuzzy match. Splits the query into tokens and
 * scores each registry entry by how many tokens hit the label, keywords,
 * description, or href slug. Returns up to `limit` results sorted by score.
 */
export function searchNavRegistry(
  query: string,
  limit = 8,
): NavRegistryItem[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ item: NavRegistryItem; score: number }> = [];
  for (const item of NAV_REGISTRY) {
    const haystack = [
      item.label.toLowerCase(),
      item.description.toLowerCase(),
      item.href.toLowerCase(),
      ...item.keywords.map((k) => k.toLowerCase()),
    ].join("  ");

    let score = 0;
    for (const t of tokens) {
      if (!haystack.includes(t)) {
        score = 0;
        break;
      }
      // Stronger weight when the token matches the label start —
      // typing "se" should rank "SEO" and "Settings" above pages
      // whose description happens to mention either word.
      if (item.label.toLowerCase().startsWith(t)) score += 5;
      // Exact match on a keyword is the strongest signal.
      if (item.keywords.some((k) => k.toLowerCase() === t)) score += 4;
      // Otherwise any substring hit is worth a point.
      score += 1;
    }
    if (score > 0) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
