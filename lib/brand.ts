// ---------------------------------------------------------------------------
// Brand constants for RealOS. Placeholder values live here so
// `{{PRODUCT_NAME}}` can be renamed globally once the product name is final.
// See NAMING.md at repo root.
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "RealOS",
  shortName: "realos",
  tagline: "Managed marketing for real estate operators",
  email: "hello@realos.dev",
  supportEmail: "support@realos.dev",
  url: "https://realos.dev",
  agencySlug: process.env.AGENCY_ORG_SLUG ?? "realos-agency",
} as const;

export const BRAND_NAME = process.env.BRAND_NAME ?? BRAND.name;
export const BRAND_TEAM = `${BRAND_NAME} Team`;
export const BRAND_EMAIL = process.env.RESEND_FROM_EMAIL ?? BRAND.email;
export const BRAND_LOCATION = process.env.BRAND_LOCATION ?? "";
export const BRAND_COLOR = process.env.BRAND_PRIMARY_COLOR ?? "#0A0A0A";

export const AI_MODEL = process.env.AI_CONFIG_MODEL ?? "claude-haiku-4-5-20251001";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? BRAND.url;
}
