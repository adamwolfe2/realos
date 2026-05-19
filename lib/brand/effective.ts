// ---------------------------------------------------------------------------
// Effective brand resolver.
//
// Every operator-facing brand surface (portal chrome, public tenant
// marketing site, outbound email display name + footer) reads from this
// resolver instead of hardcoding `BRAND_NAME` / `BRAND.logoUrl`. When the
// $499/mo White-label add-on is active and the org populated their
// override fields, the surface renders the operator's brand. Otherwise it
// falls back to the LeaseStack defaults in `lib/brand.ts`.
//
// Wiring:
//   * Activation flag           → Organization.whiteLabel (boolean)
//   * Override fields           → whiteLabelBrandName, whiteLabelLogoUrl,
//                                 whiteLabelPrimaryColor
//   * Stripe activation         → app/api/webhooks/stripe/route.ts
//   * Settings UI               → app/portal/settings/white-label/page.tsx
//
// The shape returned here is intentionally narrow — only the fields a
// rendering surface actually needs. Resist the urge to leak the entire
// Organization row through; consumers should call this helper.
// ---------------------------------------------------------------------------

import { BRAND, BRAND_NAME, BRAND_EMAIL, BRAND_COLOR } from "@/lib/brand";

// Subset of Organization columns this resolver reads. Kept here so callers
// can `select` exactly these from Prisma without pulling the whole row.
export type WhiteLabelInput = {
  whiteLabel: boolean;
  whiteLabelBrandName: string | null;
  whiteLabelLogoUrl: string | null;
  whiteLabelPrimaryColor: string | null;
};

export type EffectiveBrand = {
  /** Display name shown in headers, page titles, email "from" name, etc. */
  name: string;
  /** Optional wordmark / logo URL. Null falls back to the LeaseStack wordmark.
   *  The LeaseStack wordmark lives in /public/logos/leasestack-wordmark.png. */
  logoUrl: string | null;
  /** Hex color used as the primary accent (header bg, CTA buttons). */
  primaryColor: string;
  /** Visible "questions?" email shown in email footers / portal "contact" tags. */
  supportEmail: string;
  /** Marketing site URL. Always the LeaseStack URL when not white-labeled. */
  url: string;
  /** True when the org is actively rendering under their own brand. UI can
   *  use this to suppress LeaseStack-attribution surfaces (favicon override,
   *  "Powered by LeaseStack" footer, marketing breadcrumbs, etc.). */
  isWhiteLabeled: boolean;
};

// Default LeaseStack brand. Kept here as a constant so consumers never
// need to know which env var holds which value — pull from `getEffectiveBrand(null)`
// if you need the defaults explicitly.
const DEFAULT_BRAND: EffectiveBrand = {
  name: BRAND_NAME,
  logoUrl: null, // surfaces render /logos/leasestack-wordmark.png when null
  primaryColor: BRAND_COLOR,
  supportEmail: BRAND_EMAIL,
  url: BRAND.url,
  isWhiteLabeled: false,
};

// Resolve the effective brand for a given organization.
//
// Returns the LeaseStack default brand if:
//   * org is null/undefined (e.g. unauthenticated / global chrome), OR
//   * org.whiteLabel is false (add-on not active), OR
//   * none of the override fields are populated (operator hasn't filled
//     in their kit yet — show LeaseStack defaults so the portal never
//     renders a "ghost" brand with empty header text).
//
// Otherwise returns the org-specific brand, with per-field fallback so a
// partial override (e.g. logo set, color not set) still degrades gracefully.
export function getEffectiveBrand(
  org: WhiteLabelInput | null | undefined,
): EffectiveBrand {
  if (!org || !org.whiteLabel) {
    return DEFAULT_BRAND;
  }
  // Treat empty strings as not-set; trim defensively to catch trailing
  // whitespace flowing in from copy/paste or env var substitutions.
  const name = org.whiteLabelBrandName?.trim() || null;
  const logoUrl = org.whiteLabelLogoUrl?.trim() || null;
  const color = org.whiteLabelPrimaryColor?.trim() || null;

  // No override fields filled in — the operator turned on the flag but
  // hasn't supplied any branding yet. Render LeaseStack defaults so the
  // portal still has a logo and color; the white-label settings page
  // surfaces the call-to-action to finish setup.
  if (!name && !logoUrl && !color) {
    return DEFAULT_BRAND;
  }

  return {
    name: name ?? BRAND_NAME,
    logoUrl: logoUrl,
    primaryColor: color ?? BRAND_COLOR,
    // We deliberately keep the support email + url tied to LeaseStack
    // even under white-label. The sending address has to remain ours for
    // DMARC/DKIM, so the visible "questions?" link points at our team
    // who can route correctly. Operators who want a fully-isolated
    // support address should reach out — that's a custom-domain conversation.
    supportEmail: BRAND_EMAIL,
    url: BRAND.url,
    isWhiteLabeled: true,
  };
}

// Convenience: load the org by id and resolve the brand. Used by
// outbound email senders where the caller only has an orgId in scope.
// Returns the default brand if the org is missing or the lookup fails —
// email delivery should never crash because a brand resolution failed.
export async function effectiveBrandForOrg(
  orgId: string | null | undefined,
): Promise<EffectiveBrand> {
  if (!orgId) return DEFAULT_BRAND;
  try {
    // Lazy import so the prisma client never lands in the cold-start
    // path of static surfaces that import this module.
    const { prisma } = await import("@/lib/db");
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        whiteLabel: true,
        whiteLabelBrandName: true,
        whiteLabelLogoUrl: true,
        whiteLabelPrimaryColor: true,
      },
    });
    return getEffectiveBrand(org);
  } catch {
    return DEFAULT_BRAND;
  }
}
