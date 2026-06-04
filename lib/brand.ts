// ---------------------------------------------------------------------------
// Brand constants for LeaseStack. Placeholder values live here so
// `{{PRODUCT_NAME}}` can be renamed globally once the product name is final.
// See NAMING.md at repo root.
// ---------------------------------------------------------------------------

export const BRAND = {
  name: "LeaseStack",
  shortName: "leasestack",
  tagline: "Your leasing data. Working for you.",
  email: "team@leasestack.co",
  supportEmail: "team@leasestack.co",
  // Canonical brand URL. 2026-06-04 primary-domain swap: apex is now
  // primary (www.leasestack.co 308-redirects here). Any consumer that
  // links / fetches this URL avoids the redirect hop.
  url: "https://leasestack.co",
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
// Canonical LeaseStack accent. Matches `--color-primary` in app/globals.css
// (the marketing site / dashboard / report views) so transactional emails
// render the same blue header as everything else. Override via env if a
// future re-skin moves the brand.
export const BRAND_COLOR = trim(process.env.BRAND_PRIMARY_COLOR) || "#2563EB";

// Canonical wordmark used as the email header logo. Sender HTML reads this
// when no white-label logo is in scope. Lives at /public/logos/.
// Resolved into an absolute URL by callers via getSiteUrl().
export const BRAND_LOGO_PATH = "/logos/leasestack-wordmark.png";

export const AI_MODEL =
  trim(process.env.AI_CONFIG_MODEL) || "claude-haiku-4-5-20251001";

export function getSiteUrl() {
  return trim(process.env.NEXT_PUBLIC_APP_URL) || BRAND.url;
}
