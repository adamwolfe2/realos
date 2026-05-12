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
  // Logo asset path under /public. Null falls back to a text mark.
  logoSrc: string | null;
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
    platform: "MANUAL",
    id: "manual",
    name: "Add properties manually",
    tagline: "Skip the PMS connection. Configure each property by hand.",
    status: "live",
    logoSrc: null,
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
