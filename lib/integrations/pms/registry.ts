// ---------------------------------------------------------------------------
// Property Management System (PMS) connector registry.
//
// LeaseStack started AppFolio-only. As we move into other verticals
// (multifamily, commercial), operators come in on Yardi, Buildium,
// Entrata, RealPage, MRI, ResMan, etc. Rather than scatter PMS-specific
// flags across the codebase, we centralize:
//
//   * The list of supported PMS platforms
//   * Per-platform metadata for the onboarding UI (display name, status,
//     auth fields, copy)
//   * A factory hook so each platform can plug its connector when
//     implemented
//
// AppFolio is live today (REST + EMBED modes). Yardi, Buildium, and
// Entrata are scaffolded as "coming soon" so the onboarding wizard
// shows them in the list and collects expressions of interest — when
// each one ships, we register a real connector and the same wizard
// flips to live without touching the UI.
// ---------------------------------------------------------------------------

import type { BackendPlatform } from "@prisma/client";

export type PmsStatus =
  | "live" // operator can self-serve connect today
  | "beta" // working but requires our team to provision credentials
  | "coming_soon" // collecting interest, not yet shippable
  | "manual_only"; // PMS isn't planned; manual entry only

export type PmsAuthField = {
  key: string;
  label: string;
  type: "text" | "password" | "subdomain";
  placeholder?: string;
  helpText?: string;
  required?: boolean;
};

export type PmsDefinition = {
  // BackendPlatform enum value on Property/Organization, or null for the
  // manual-entry option.
  platform: BackendPlatform | "MANUAL";
  // Stable id used in URLs + state. Lowercase, no spaces.
  id: string;
  name: string;
  tagline: string;
  status: PmsStatus;
  // Logo asset path under /public. Null falls back to a colored
  // monogram mark derived from `brandColor` + `monogram`.
  logoSrc: string | null;
  // Brand color (hex) for the fallback monogram tile. Lifted from
  // each PMS's marketing site / brand guidelines; not a perfect
  // match but recognizable enough that customers don't squint.
  brandColor: string;
  // 1-2 character monogram for the fallback tile.
  monogram: string;
  // Fields the operator fills in during connection. Empty array means
  // either manual-only OR the platform is OAuth-based and the
  // connection happens elsewhere.
  authFields: PmsAuthField[];
  // Short note shown beneath the auth form. Use to clarify which
  // contract tier of the PMS we support (e.g. AppFolio Core vs Plus).
  contractNote?: string;
  // Optional URL where operators learn how to find their credentials.
  helpUrl?: string;
};

export const PMS_REGISTRY: PmsDefinition[] = [
  {
    platform: "APPFOLIO",
    id: "appfolio",
    name: "AppFolio",
    tagline: "Property Manager Core, Plus, and Max.",
    status: "live",
    logoSrc: null,
    brandColor: "#1B468A",
    monogram: "AF",
    authFields: [
      {
        key: "subdomain",
        label: "AppFolio subdomain",
        type: "subdomain",
        placeholder: "yourcompany",
        helpText:
          "The part before .appfolio.com on your login URL. We can pull live listings with just this on Core plans.",
        required: true,
      },
      {
        key: "clientId",
        label: "Developer Portal client ID",
        type: "text",
        placeholder: "Optional, for Plus / Max plans",
        helpText:
          "Optional. Required only if you have AppFolio Plus or Max and want full v2 API sync (residents, leases, work orders, delinquency).",
      },
      {
        key: "clientSecret",
        label: "Developer Portal client secret",
        type: "password",
        placeholder: "Optional, for Plus / Max plans",
        required: false,
      },
    ],
    contractNote:
      "Core plans use embed scraping (subdomain only). Plus / Max plans unlock full data sync with Developer Portal credentials.",
    helpUrl: "https://help.appfolio.com/s/article/Developer-API",
  },
  {
    platform: "YARDI_VOYAGER",
    id: "yardi",
    name: "Yardi Voyager",
    tagline: "Voyager 7s, Breeze, and Genesis2.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#9E1B32",
    monogram: "Y",
    authFields: [
      {
        key: "serverUrl",
        label: "Yardi server URL",
        type: "text",
        placeholder: "https://yourcompany.yardione.com",
      },
      {
        key: "database",
        label: "Database name",
        type: "text",
        placeholder: "voyager_live",
      },
      {
        key: "username",
        label: "API user",
        type: "text",
        placeholder: "leasestack_integration",
      },
      {
        key: "password",
        label: "API password",
        type: "password",
      },
    ],
    contractNote:
      "Yardi integration requires a one-time setup call with your Yardi admin to provision the API user. We'll reach out within 24 hours of submission to schedule it.",
    helpUrl: "https://www.yardi.com/products/yardi-voyager/",
  },
  {
    platform: "BUILDIUM",
    id: "buildium",
    name: "Buildium",
    tagline: "Property management for SMB operators.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#0073C7",
    monogram: "B",
    authFields: [
      {
        key: "clientId",
        label: "Buildium API client ID",
        type: "text",
      },
      {
        key: "clientSecret",
        label: "Buildium API client secret",
        type: "password",
      },
    ],
    contractNote:
      "Requires a Buildium Premium plan with Open API enabled. We'll guide you through generating credentials when we activate the connector.",
    helpUrl: "https://developer.buildium.com/",
  },
  {
    platform: "ENTRATA",
    id: "entrata",
    name: "Entrata",
    tagline: "Multifamily + student housing operators at scale.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#00A99D",
    monogram: "E",
    authFields: [
      {
        key: "username",
        label: "Entrata API username",
        type: "text",
      },
      {
        key: "password",
        label: "Entrata API password",
        type: "password",
      },
    ],
    contractNote:
      "Entrata's API is gated behind their Integration Partner Program. We're an enrolled partner; provisioning your credentials takes about 3 business days.",
    helpUrl: "https://www.entrata.com/integrations",
  },
  {
    platform: "REALPAGE",
    id: "realpage",
    name: "RealPage / OneSite",
    tagline: "Enterprise multifamily and student housing.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#1B3766",
    monogram: "RP",
    authFields: [
      {
        key: "tenantId",
        label: "RealPage tenant ID",
        type: "text",
      },
      {
        key: "apiKey",
        label: "RealPage API key",
        type: "password",
      },
    ],
    contractNote:
      "RealPage integrations route through their Enterprise Data Exchange. We'll coordinate with your RealPage CSM to enable access.",
    helpUrl: "https://www.realpage.com/",
  },
  {
    platform: "MRI",
    id: "mri",
    name: "MRI Software",
    tagline: "Commercial real estate and large residential portfolios.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#003F72",
    monogram: "MRI",
    authFields: [
      {
        key: "serverUrl",
        label: "MRI server URL",
        type: "text",
        placeholder: "https://yourcompany.mrisoftware.com",
      },
      {
        key: "username",
        label: "API user",
        type: "text",
      },
      {
        key: "password",
        label: "API password",
        type: "password",
      },
    ],
    contractNote:
      "MRI integrations require coordination with your MRI admin to provision the API user.",
    helpUrl: "https://www.mrisoftware.com/",
  },
  {
    platform: "OTHER",
    id: "resman",
    name: "ResMan",
    tagline: "Mid-market multifamily (50 to 10,000 units).",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#FF6A39",
    monogram: "RM",
    authFields: [
      {
        key: "accountId",
        label: "ResMan account ID",
        type: "text",
      },
    ],
    contractNote:
      "ResMan integrations route through their Marketplace partner program. We're enrolled; provisioning takes about 5 business days.",
    helpUrl: "https://www.myresman.com/",
  },
  {
    platform: "PROPERTYWARE",
    id: "propertyware",
    name: "Propertyware",
    tagline: "Single-family rental operators.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#2D6A9F",
    monogram: "PW",
    authFields: [
      {
        key: "apiKey",
        label: "Propertyware API key",
        type: "password",
      },
    ],
    contractNote:
      "Generate an API key from your Propertyware settings and paste it here. Self-serve once we ship the connector.",
    helpUrl: "https://www.propertyware.com/",
  },
  {
    platform: "RENTMANAGER",
    id: "rentmanager",
    name: "Rent Manager",
    tagline: "Diversified portfolios with mixed residential + commercial.",
    status: "coming_soon",
    logoSrc: null,
    brandColor: "#3E5C76",
    monogram: "RM2",
    authFields: [
      {
        key: "corporateId",
        label: "Corporate ID",
        type: "text",
      },
      {
        key: "username",
        label: "API username",
        type: "text",
      },
      {
        key: "password",
        label: "API password",
        type: "password",
      },
    ],
    contractNote:
      "Rent Manager uses session-based API auth. We provision a service user on your behalf.",
    helpUrl: "https://www.rentmanager.com/",
  },
  {
    platform: "MANUAL",
    id: "manual",
    name: "Add properties manually",
    tagline: "Skip the PMS connection. Configure each property by hand.",
    status: "live",
    logoSrc: null,
    brandColor: "#64748B",
    monogram: "•",
    authFields: [],
    contractNote:
      "Perfect if your portfolio is small or you're not on a supported PMS yet. You can still connect a PMS later from settings.",
  },
];

export function getPmsById(id: string): PmsDefinition | null {
  return PMS_REGISTRY.find((p) => p.id === id) ?? null;
}

export function livePmsList(): PmsDefinition[] {
  return PMS_REGISTRY.filter((p) => p.status === "live");
}

export function comingSoonPmsList(): PmsDefinition[] {
  return PMS_REGISTRY.filter((p) => p.status === "coming_soon");
}
