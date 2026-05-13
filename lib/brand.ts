// ---------------------------------------------------------------------------
// Brand constants for LeaseStack. Placeholder values live here so
// `{{PRODUCT_NAME}}` can be renamed globally once the product name is final.
// See NAMING.md at repo root.
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "LeaseStack",
  shortName: "leasestack",
  tagline: "Your leasing data. Finally working for you.",
  email: "hello@leasestack.co",
  supportEmail: "support@leasestack.co",
  url: "https://www.leasestack.co",
  agencySlug: process.env.AGENCY_ORG_SLUG ?? "leasestack-agency",
} as const;

// Vercel often stores env vars with trailing whitespace / newlines. Trim every
// brand value defensively so it can't poison email headers (Resend rejects
// any subject containing \n with "The `\n` is not allowed in the `subject`
// field"), URLs, or rendered copy.
const trim = (v: string | undefined | null) => v?.replace(/\s+$/g, "").trim();

export const BRAND_NAME = trim(process.env.BRAND_NAME) || BRAND.name;
export const BRAND_TEAM = `${BRAND_NAME} Team`;
export const BRAND_EMAIL = trim(process.env.RESEND_FROM_EMAIL) || BRAND.email;
export const BRAND_LOCATION = trim(process.env.BRAND_LOCATION) || "";
export const BRAND_COLOR = trim(process.env.BRAND_PRIMARY_COLOR) || "#0A0A0A";

export const AI_MODEL =
  trim(process.env.AI_CONFIG_MODEL) || "claude-haiku-4-5-20251001";

export function getSiteUrl() {
  return trim(process.env.NEXT_PUBLIC_APP_URL) || BRAND.url;
}
