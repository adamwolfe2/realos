import "server-only";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Shared client-provisioning helpers.
//
// Pure(ish) building blocks reused by BOTH provisioning paths:
//   • convertIntakeToClient  (lib/actions/convert-intake.ts) — intake → client
//   • createClientDirect     (lib/actions/create-client.ts)  — admin create
//
// Extracted so slug derivation + module-flag mapping stay byte-identical
// across both paths. Behavior here must not drift — both callers depend on
// website + leadCapture being force-enabled and on the same slug collision
// strategy.
// ---------------------------------------------------------------------------

export const SLUG_MAX = 60;
const SLUG_COLLISION_MAX = 50;

export function deriveSlug(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
  return base || "tenant";
}

export async function pickUniqueSlug(companyName: string): Promise<string> {
  const base = deriveSlug(companyName);
  let candidate = base;
  let n = 2;
  while (n <= SLUG_COLLISION_MAX + 1) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    const suffix = `-${n}`;
    candidate = `${base.slice(0, SLUG_MAX - suffix.length)}${suffix}`;
    n += 1;
  }
  throw new Error("Could not generate a unique tenant slug");
}

export type ModuleFlags = {
  moduleWebsite: boolean;
  modulePixel: boolean;
  moduleChatbot: boolean;
  moduleGoogleAds: boolean;
  moduleMetaAds: boolean;
  moduleSEO: boolean;
  moduleEmail: boolean;
  moduleOutboundEmail: boolean;
  moduleReferrals: boolean;
  moduleCreativeStudio: boolean;
  moduleLeadCapture: boolean;
};

/**
 * Map a list of selected module keys (MODULE_CATALOG keys, e.g. "pixel",
 * "googleAds") onto the Organization.module* booleans.
 *
 * DECISION: website + leadCapture are Core features (every operator gets
 * them, bundled in the base retainer). We force them on server-side so a
 * prospect/operator who left them off still gets them provisioned. Both
 * snake_case and camelCase keys are accepted for cross-version safety.
 */
export function deriveModuleFlags(selectedModules: unknown): ModuleFlags {
  const selected = Array.isArray(selectedModules)
    ? selectedModules.filter((m): m is string => typeof m === "string")
    : [];
  const has = (key: string) => selected.includes(key);
  return {
    moduleWebsite: true,
    moduleLeadCapture: true,
    modulePixel: has("pixel"),
    moduleChatbot: has("chatbot"),
    moduleGoogleAds: has("google_ads") || has("googleAds"),
    moduleMetaAds: has("meta_ads") || has("metaAds"),
    moduleSEO: has("seo"),
    moduleEmail: has("email"),
    moduleOutboundEmail: has("outbound_email") || has("outboundEmail"),
    moduleReferrals: has("referrals"),
    moduleCreativeStudio: has("creative_studio") || has("creativeStudio"),
  };
}
