// ---------------------------------------------------------------------------
// Integrations catalog — the source of truth for the tenant marketplace.
//
// Each entry describes one integration tile: display metadata, category,
// brand color (for the icon fallback), and the auth method that governs
// how connecting works. The portal page reads from this list to render the
// grid; when a new integration is added here, it appears automatically.
//
// Keep this file boring. No React, no Prisma imports beyond types. Status
// resolution lives in lib/integrations/status.ts.
// ---------------------------------------------------------------------------

export type IntegrationCategory =
  | "property_platform"
  | "analytics"
  | "ads"
  | "communication"
  | "scheduling"
  | "automation";

export type IntegrationAuthMethod =
  // Managed by the agency on the tenant's behalf. Tile shows Manage/Connected.
  | "agency_managed"
  // Client can self-provision via an existing config form in the portal.
  | "self_serve"
  // OAuth handshake with the third party. Not yet wired — tile shows Request.
  | "oauth"
  // Generate a bearer token in /portal/settings/api-keys and paste it elsewhere.
  | "api_key"
  // We'll turn it on for them. Creates an IntegrationRequest row on click.
  | "request";

export type IntegrationDefinition = {
  slug: string;
  name: string;
  category: IntegrationCategory;
  // One-line summary rendered under the title in the tile.
  tagline: string;
  // Full description rendered in the drawer.
  description: string;
  // What lands in the portal when connected.
  landsIn: string[];
  // Solid background color for the initial-letter tile (hex).
  brandColor: string;
  // Short brand token(s) rendered inside the icon tile. 1-2 characters ideal.
  initials: string;
  auth: IntegrationAuthMethod;
  // Enable later, keeps the tile visible but greyed out with a "Coming soon" pill.
  comingSoon?: boolean;
};

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  property_platform: "Property platform",
  analytics: "Analytics",
  ads: "Ads",
  communication: "Communication",
  scheduling: "Scheduling",
  automation: "Automation",
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  // ---------------------- Property platforms (PMS) -----------------------
  {
    slug: "appfolio",
    name: "AppFolio",
    category: "property_platform",
    tagline: "Sync listings, applications, and residents from AppFolio.",
    description:
      "Pull live unit inventory and application status from your AppFolio instance. Listings on your site stay in sync with your PMS within the hour. Applicant + tenant records flow into the portal for end-to-end attribution.",
    landsIn: ["Properties", "Listings", "Leads", "Applications"],
    brandColor: "#0059A9",
    initials: "Af",
    auth: "self_serve",
  },
  {
    slug: "yardi-breeze",
    name: "Yardi Breeze",
    category: "property_platform",
    tagline: "Sync units and leases from Yardi Breeze.",
    description:
      "Live listings, applicant tracking, and resident records from Yardi Breeze. We handle the RETS / API bridge; you get a portal that mirrors Breeze without the double entry.",
    landsIn: ["Properties", "Listings", "Leads"],
    brandColor: "#00A28F",
    initials: "Yb",
    auth: "request",
  },
  {
    slug: "yardi-voyager",
    name: "Yardi Voyager",
    category: "property_platform",
    tagline: "Enterprise Yardi sync with full data feed.",
    description:
      "For portfolios on Yardi Voyager. Full property, unit, and lease data flows into the portal on a nightly batch plus hourly deltas.",
    landsIn: ["Properties", "Listings", "Leads", "Applications"],
    brandColor: "#006547",
    initials: "Yv",
    auth: "request",
  },
  {
    slug: "buildium",
    name: "Buildium",
    category: "property_platform",
    tagline: "Listing and application sync from Buildium.",
    description:
      "Connect your Buildium account to stream available units and rental applications into the portal. We manage the API integration and keep it healthy.",
    landsIn: ["Properties", "Listings", "Applications"],
    brandColor: "#007AC1",
    initials: "Bu",
    auth: "request",
  },
  {
    slug: "entrata",
    name: "Entrata",
    category: "property_platform",
    tagline: "Feed Entrata availability and leases into the portal.",
    description:
      "For operators on Entrata. Syncs units, floor plans, leases, and residents. Supports per-property scoping for multi-asset portfolios.",
    landsIn: ["Properties", "Listings", "Leads"],
    brandColor: "#21223B",
    initials: "En",
    auth: "request",
  },
  {
    slug: "realpage",
    name: "RealPage",
    category: "property_platform",
    tagline: "RealPage property + leasing data into the portal.",
    description:
      "Pulls RealPage's unit inventory, availability, and pricing signals. Works alongside your existing revenue management setup.",
    landsIn: ["Properties", "Listings"],
    brandColor: "#0063A6",
    initials: "Rp",
    auth: "request",
  },

  // --------------------------- Analytics / pixel -------------------------
  {
    slug: "visitor-identification",
    name: "Visitor identification",
    category: "analytics",
    tagline: "Names and emails on your anonymous site traffic.",
    description:
      "A lightweight script we provision per-tenant, installed on your custom domain. It matches anonymous visitors against a consented identity graph and drops named leads into your CRM — along with the pages they viewed and how they found you.",
    landsIn: ["Visitors", "Leads", "Retargeting audiences"],
    brandColor: "#2F6FE5",
    initials: "Vi",
    auth: "agency_managed",
  },
  {
    slug: "ga4",
    name: "Google Analytics 4",
    category: "analytics",
    tagline: "Pipe GA4 events into the portal alongside our pixel.",
    description:
      "If you already run GA4, we'll wire it up so you can see sessions, conversions, and traffic sources alongside the visitors the identity pixel named — one view instead of two tabs.",
    landsIn: ["Visitors", "Dashboard analytics"],
    brandColor: "#F9AB00",
    initials: "Ga",
    auth: "request",
  },

  // ------------------------------- Ads -----------------------------------
  {
    slug: "google-ads",
    name: "Google Ads",
    category: "ads",
    tagline: "Managed campaigns with pixel-powered retargeting.",
    description:
      "We connect your Google Ads account via OAuth, build geo-fenced campaigns per property, feed pixel-identified visitors back as custom audiences, and refresh creative weekly out of our Creative Studio.",
    landsIn: ["Ad campaigns", "Lead attribution"],
    brandColor: "#4285F4",
    initials: "Ga",
    auth: "request",
  },
  {
    slug: "meta-ads",
    name: "Meta Ads",
    category: "ads",
    tagline: "Facebook + Instagram ads, audiences, and creative.",
    description:
      "OAuth into Meta Business Manager. Campaigns, audiences synced from the identity pixel, and feed + story creative refreshed every week.",
    landsIn: ["Ad campaigns", "Lead attribution"],
    brandColor: "#0866FF",
    initials: "Me",
    auth: "request",
  },
  {
    slug: "tiktok-ads",
    name: "TikTok Ads",
    category: "ads",
    tagline: "Short-form paid social targeting, managed.",
    description:
      "OAuth into TikTok Ads. Best for student housing and multifamily with a 18-34 demographic. Creative studio ships vertical video in 48 hours.",
    landsIn: ["Ad campaigns", "Lead attribution"],
    brandColor: "#000000",
    initials: "Tt",
    auth: "request",
  },
  {
    slug: "linkedin-ads",
    name: "LinkedIn Ads",
    category: "ads",
    tagline: "B2B targeting for commercial + senior living.",
    description:
      "Most relevant for commercial brokers, corporate housing, and senior living family decision-makers. OAuth into LinkedIn Campaign Manager; campaign templates per vertical.",
    landsIn: ["Ad campaigns", "Lead attribution"],
    brandColor: "#0A66C2",
    initials: "Li",
    auth: "request",
  },

  // --------------------------- Communication -----------------------------
  {
    slug: "slack",
    name: "Slack",
    category: "communication",
    tagline: "New-lead alerts and chatbot escalations to Slack.",
    description:
      "Pipe high-intent leads, tour requests, and chatbot escalations into a Slack channel of your choice. OAuth, one channel per event type.",
    landsIn: ["Slack channel of your choice"],
    brandColor: "#4A154B",
    initials: "Sl",
    auth: "request",
  },
  {
    slug: "twilio-sms",
    name: "Twilio SMS",
    category: "communication",
    tagline: "Lead follow-up and tour reminders over SMS.",
    description:
      "Automated SMS for new leads, tour confirmations, and applicant follow-up. Optional call tracking on managed numbers.",
    landsIn: ["Leads", "Tours", "Audit log"],
    brandColor: "#F22F46",
    initials: "Tw",
    auth: "request",
  },

  // ----------------------------- Scheduling ------------------------------
  {
    slug: "calendly",
    name: "Calendly",
    category: "scheduling",
    tagline: "Tour bookings from Calendly into the portal.",
    description:
      "Connect Calendly to auto-create Tour rows in the portal whenever someone books a property tour. Lead dedupe on email.",
    landsIn: ["Tours", "Leads"],
    brandColor: "#006BFF",
    initials: "Ca",
    auth: "request",
  },
  {
    slug: "cal-com",
    name: "Cal.com",
    category: "scheduling",
    tagline: "Open-source scheduling → Tour rows.",
    description:
      "Same as Calendly but for operators using Cal.com. Event webhooks create Tour rows with source attribution.",
    landsIn: ["Tours", "Leads"],
    brandColor: "#111111",
    initials: "Cl",
    auth: "request",
  },

  // ----------------------------- Automation ------------------------------
  {
    slug: "zapier",
    name: "Zapier",
    category: "automation",
    tagline: "5,000+ apps via an API key.",
    description:
      "Generate a scoped API key and use Zapier's generic Webhooks + HTTP action to push leads, visitors, tours, or chatbot sessions into the portal from anywhere Zapier connects to.",
    landsIn: ["Leads", "Visitors", "Tours", "Chatbot sessions"],
    brandColor: "#FF4A00",
    initials: "Za",
    auth: "api_key",
  },
  {
    slug: "make",
    name: "Make",
    category: "automation",
    tagline: "Scenario-based automations via API key.",
    description:
      "Same pattern as Zapier. Copy an API key from Settings, paste it into a Make HTTP module, and every scenario can write into the portal.",
    landsIn: ["Leads", "Visitors", "Tours", "Chatbot sessions"],
    brandColor: "#6D00CC",
    initials: "Mk",
    auth: "api_key",
  },
  {
    slug: "custom-webhook",
    name: "Custom webhook",
    category: "automation",
    tagline: "Any external system, via a scoped API key.",
    description:
      "POST JSON to /api/ingest/lead, /api/ingest/visitor, /api/ingest/tour, or /api/ingest/chatbot with an Authorization: Bearer header. Rate-limited per key, tenant-scoped, idempotent.",
    landsIn: ["Leads", "Visitors", "Tours", "Chatbot sessions"],
    brandColor: "#4B5563",
    initials: "Cw",
    auth: "api_key",
  },
];

export function findIntegration(slug: string): IntegrationDefinition | null {
  return INTEGRATIONS.find((i) => i.slug === slug) ?? null;
}

export function integrationsByCategory(): Record<
  IntegrationCategory,
  IntegrationDefinition[]
> {
  const out: Record<IntegrationCategory, IntegrationDefinition[]> = {
    property_platform: [],
    analytics: [],
    ads: [],
    communication: [],
    scheduling: [],
    automation: [],
  };
  for (const i of INTEGRATIONS) out[i.category].push(i);
  return out;
}
