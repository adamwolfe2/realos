import "server-only";
import { prisma } from "@/lib/db";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import type { SeoIntegration, SeoProvider } from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-property integration lookups.
//
// SeoIntegration became a per-property model in
// migration 20260506_per_property_integrations. Existing rows from before
// that migration have `propertyId = NULL` and are interpreted as "applies
// to the whole org" so the prior single-GA4-per-org
// behavior keeps working for tenants that haven't yet wired up multi-
// property scoping.
//
// Every consumer should funnel through these helpers instead of hitting
// `prisma.seoIntegration.findUnique({ where: { orgId } })` directly.
// The helpers implement the two-step lookup that preserves backward
// compatibility:
//
//   1. Try the property-specific row (orgId, propertyId).
//   2. Fall back to the legacy org-wide row (orgId, NULL).
//
// If neither exists the helper returns `null` and the caller is expected
// to render its empty / "not connected" state.
// ---------------------------------------------------------------------------

type PropertyMini = { id: string; name: string };

export type SeoWithProperty = SeoIntegration & {
  property: PropertyMini | null;
};

/**
 * Find the SEO integration (GA4 or GSC) that applies to a given
 * property + provider combination. Falls back to the legacy org-wide row
 * (propertyId = NULL) when no property-specific row exists.
 */
export async function findSeoIntegrationForProperty(
  orgId: string,
  propertyId: string | null,
  provider: SeoProvider,
): Promise<SeoIntegration | null> {
  if (propertyId) {
    const specific = await prisma.seoIntegration.findUnique({
      where: {
        orgId_propertyId_provider: { orgId, propertyId, provider },
      },
    });
    if (specific) return specific;
  }
  return prisma.seoIntegration.findFirst({
    where: { orgId, propertyId: null, provider },
  });
}

/**
 * List every SEO integration row for an org. Optionally filter by
 * provider. Sorted with per-property rows first.
 */
export async function listSeoIntegrationsForOrg(
  orgId: string,
  provider?: SeoProvider,
): Promise<SeoWithProperty[]> {
  return prisma.seoIntegration.findMany({
    where: { orgId, ...(provider ? { provider } : {}) },
    include: { property: { select: { id: true, name: true } } },
    orderBy: [
      { provider: "asc" },
      { propertyId: "asc" },
      { createdAt: "asc" },
    ],
  });
}

// ---------------------------------------------------------------------------
// Coverage queries — used by the setup wizard / dashboard to display
// "GA4 connected: 3 of 5 properties" granularity.
// ---------------------------------------------------------------------------

export type IntegrationCoverageRow = {
  propertyId: string;
  propertyName: string;
  hasIntegration: boolean;
  // True when the integration coverage comes from a legacy org-wide
  // row, false when there's a property-specific row. Useful for UI
  // copy ("inherits from org-wide connection") or for data-quality nags.
  inheritsFromLegacy: boolean;
};

/**
 * Per-property coverage for SEO integrations of a given
 * provider. Useful for "GA4: 3 of 5 properties" and "GSC: 1 of 5
 * properties" tiles in the setup hub.
 */
export async function getSeoCoverage(
  orgId: string,
  provider: SeoProvider,
): Promise<IntegrationCoverageRow[]> {
  // 2026-06-04 N+1 audit: same marketable filter as the other property lists
  // so SEO coverage tiles ("GA4 connected on 3 of 5 properties") match
  // the property set every other surface uses.
  const [properties, integrations] = await Promise.all([
    prisma.property.findMany({
      where: marketablePropertyWhere(orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.seoIntegration.findMany({
      where: { orgId, provider, propertyIdentifier: { not: "" } },
      select: { propertyId: true },
    }),
  ]);
  const hasLegacy = integrations.some((i) => i.propertyId === null);
  const specific = new Set(
    integrations.filter((i) => i.propertyId !== null).map((i) => i.propertyId!),
  );
  return properties.map((p) => ({
    propertyId: p.id,
    propertyName: p.name,
    hasIntegration: specific.has(p.id) || hasLegacy,
    inheritsFromLegacy: !specific.has(p.id) && hasLegacy,
  }));
}

export async function summarizeSeoCoverage(
  orgId: string,
  provider: SeoProvider,
) {
  const rows = await getSeoCoverage(orgId, provider);
  return {
    total: rows.length,
    covered: rows.filter((r) => r.hasIntegration).length,
  };
}
