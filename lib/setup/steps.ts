import type { Organization, CursiveIntegration, AppFolioIntegration, TenantSiteConfig, AdAccount, SeoIntegration } from "@prisma/client";
import { AdPlatform, SeoProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Setup Hub step definitions.
//
// The 10 onboarding steps clients work through during their first 1–2 weeks.
// Each step encapsulates its title, icon, CTA, completion logic, and optional
// module gating. Steps are intentionally hardcoded — the set is small and
// evolves slowly, so a config file beats a DB table.
//
// Completion is derived from existing data — no new schema columns.
// ---------------------------------------------------------------------------

export type SetupPhase = "foundation" | "growth" | "polish";

export type SetupModuleKey =
  | "moduleGoogleAds"
  | "moduleMetaAds"
  | "moduleSEO"
  | "moduleChatbot"
  | "modulePixel";

export type SetupCheckContext = {
  org: Pick<
    Organization,
    | "logoUrl"
    | "primaryColor"
    | "moduleGoogleAds"
    | "moduleMetaAds"
    | "moduleSEO"
    | "moduleChatbot"
    | "modulePixel"
  >;
  cursive: Pick<CursiveIntegration, "cursivePixelId" | "lastEventAt"> | null;
  appfolio: Pick<AppFolioIntegration, "lastSyncAt"> | null;
  tenantSiteConfig: Pick<TenantSiteConfig, "chatbotEnabled"> | null;
  adAccounts: Array<Pick<AdAccount, "platform" | "lastSyncAt">>;
  seoIntegrations: Array<Pick<SeoIntegration, "provider" | "lastSyncAt">>;
  hasWeeklyReport: boolean;
  userCount: number;
};

export type SetupStepDefinition = {
  id: string;
  phase: SetupPhase;
  icon: string;              // lucide-react icon name, resolved at render time
  title: string;
  description: string;
  estimateMinutes: number;
  actionHref: string;
  actionLabel: string;
  hideAction?: boolean;      // for the "signed in" step — CTA is unnecessary
  requiresModule?: SetupModuleKey;
  lockedLabel?: string;      // chip label when locked, e.g. "Growth plan required"
  isComplete: (ctx: SetupCheckContext) => boolean;
};

const trueCheck = () => true;

export const SETUP_STEPS: SetupStepDefinition[] = [
  // ── Foundation (Week 1) ───────────────────────────────────────────────────
  {
    id: "signed_in",
    phase: "foundation",
    icon: "LogIn",
    title: "Sign in to your portal",
    description:
      "You're in. This is where every lead, tour, and lease will land over the next two weeks.",
    estimateMinutes: 0,
    actionHref: "/portal",
    actionLabel: "Open dashboard",
    hideAction: true,
    isComplete: trueCheck,
  },
  {
    id: "appfolio",
    phase: "foundation",
    icon: "Database",
    title: "Connect AppFolio",
    description:
      "See every lead, tour, and signed lease in real time. If you're on Core, pick Public Listings mode — just your subdomain, no API keys. Plus/Max plans can connect the full Reports API.",
    estimateMinutes: 5,
    actionHref: "/portal/settings/integrations",
    actionLabel: "Connect AppFolio",
    isComplete: (ctx) => ctx.appfolio?.lastSyncAt != null,
  },
  {
    id: "cursive",
    phase: "foundation",
    icon: "Radar",
    title: "Install the Cursive pixel",
    description:
      "Name every anonymous visitor. See who's on your site right now.",
    estimateMinutes: 5,
    actionHref: "/portal/settings/integrations",
    actionLabel: "Install pixel",
    isComplete: (ctx) =>
      ctx.cursive?.cursivePixelId != null && ctx.cursive?.lastEventAt != null,
  },
  {
    id: "chatbot",
    phase: "foundation",
    icon: "Bot",
    title: "Configure your chatbot",
    description:
      "Capture leads 24/7 with an AI that knows your units, amenities, and pricing.",
    estimateMinutes: 15,
    actionHref: "/portal/chatbot",
    actionLabel: "Configure chatbot",
    isComplete: (ctx) => ctx.tenantSiteConfig?.chatbotEnabled === true,
  },
  {
    id: "team",
    phase: "foundation",
    icon: "Users",
    title: "Invite your leasing team",
    description:
      "Everyone on your team sees the lead stream the moment it arrives.",
    estimateMinutes: 5,
    actionHref: "/portal/settings#team",
    actionLabel: "Invite team",
    isComplete: (ctx) => ctx.userCount > 1,
  },

  // ── Growth (Week 2) ───────────────────────────────────────────────────────
  {
    id: "google_ads",
    phase: "growth",
    icon: "Search",
    title: "Connect Google Ads",
    description:
      "Attribute signed leases to campaigns. See true cost per lease by keyword.",
    estimateMinutes: 10,
    actionHref: "/portal/settings/integrations",
    actionLabel: "Connect Google Ads",
    requiresModule: "moduleGoogleAds",
    lockedLabel: "Growth plan required",
    isComplete: (ctx) =>
      ctx.adAccounts.some(
        (a) => a.platform === AdPlatform.GOOGLE_ADS && a.lastSyncAt != null
      ),
  },
  {
    id: "meta_ads",
    phase: "growth",
    icon: "Facebook",
    title: "Connect Meta Ads",
    description:
      "Same for Instagram and Facebook. See every paid lead attributed to ad set.",
    estimateMinutes: 10,
    actionHref: "/portal/settings/integrations",
    actionLabel: "Connect Meta Ads",
    requiresModule: "moduleMetaAds",
    lockedLabel: "Growth plan required",
    isComplete: (ctx) =>
      ctx.adAccounts.some(
        (a) => a.platform === AdPlatform.META && a.lastSyncAt != null
      ),
  },
  {
    id: "ga4",
    phase: "growth",
    icon: "LineChart",
    title: "Connect Google Analytics",
    description:
      "See which pages drive tours. Understand every traffic source in context.",
    estimateMinutes: 5,
    actionHref: "/portal/settings/integrations",
    actionLabel: "Connect GA4",
    isComplete: (ctx) =>
      ctx.seoIntegrations.some(
        (s) => s.provider === SeoProvider.GA4 && s.lastSyncAt != null
      ),
  },

  // ── Polish (anytime) ──────────────────────────────────────────────────────
  {
    id: "brand",
    phase: "polish",
    icon: "Palette",
    title: "Brand your portal",
    description:
      "Add your logo and colors. Your team's portal, not ours.",
    estimateMinutes: 10,
    actionHref: "/portal/settings",
    actionLabel: "Customize brand",
    isComplete: (ctx) =>
      ctx.org.logoUrl != null && ctx.org.primaryColor != null,
  },
  {
    id: "weekly_report",
    phase: "polish",
    icon: "Mail",
    title: "Set up weekly reports",
    description:
      "Your leasing team gets a Monday morning summary. Auto-generated, owner-ready.",
    estimateMinutes: 5,
    actionHref: "/portal/reports",
    actionLabel: "Set up reports",
    isComplete: (ctx) => ctx.hasWeeklyReport,
  },
];

export const PHASE_LABELS: Record<SetupPhase, string> = {
  foundation: "Foundation · Week 1",
  growth: "Growth · Week 2",
  polish: "Polish · Anytime",
};

export const PHASE_ORDER: SetupPhase[] = ["foundation", "growth", "polish"];
