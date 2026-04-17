// ---------------------------------------------------------------------------
// Compat shim. The distribution-era portal-config was deeply coupled to
// Wholesail's per-client config (pricing tiers, referral codes, loyalty
// thresholds, etc.). We replaced most of those concepts with per-Organization
// rows in the new schema. Anything that still imports from this module now
// gets plain env-backed brand values so the build can pass. Callers migrate
// to `@/lib/brand` and per-Organization settings over the course of Sprints
// 02-05.
// TODO(Sprint 05): remove this file once portal UI imports are fully
// migrated to the tenancy-aware helpers.
// ---------------------------------------------------------------------------

import { BRAND_NAME, getSiteUrl } from "./brand";

export const portalConfig = {
  brandName: BRAND_NAME,
  brandNameServer: BRAND_NAME,
  brandLocation: process.env.BRAND_LOCATION ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "hello@realos.dev",
  opsName: process.env.OPS_NAME ?? `${BRAND_NAME} Team`,
  fromEmail:
    process.env.RESEND_FROM_EMAIL ?? `${BRAND_NAME} <hello@realos.dev>`,
  appUrl: getSiteUrl(),
  primaryColor: process.env.BRAND_PRIMARY_COLOR ?? "#0A0A0A",
  calLink: process.env.NEXT_PUBLIC_CAL_LINK ?? "adamwolfe/realos",
  calNamespace: process.env.NEXT_PUBLIC_CAL_NAMESPACE ?? "realos",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@realos.dev",
  defaultTaxRate: Number(process.env.DEFAULT_TAX_RATE ?? 0),
} as const;

export type PortalConfig = typeof portalConfig;
