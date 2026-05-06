import "server-only";
import { prisma } from "@/lib/db";
import type {
  CursiveIntegration,
  SeoIntegration,
  SeoProvider,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Per-property integration lookups.
//
// CursiveIntegration and SeoIntegration both became per-property models in
// migration 20260506_per_property_integrations. Existing rows from before
// that migration have `propertyId = NULL` and are interpreted as "applies
// to the whole org" so the prior single-pixel-per-org / single-GA4-per-org
// behavior keeps working for tenants that haven't yet wired up multi-
// property scoping.
//
// Every consumer should funnel through these helpers instead of hitting
// `prisma.cursiveIntegration.findUnique({ where: { orgId } })` directly.
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

export type CursiveWithProperty = CursiveIntegration & {
  property: PropertyMini | null;
};

export type SeoWithProperty = SeoIntegration & {
  property: PropertyMini | null;
};

/**
 * Find the Cursive integration that applies to a given property. Tries
 * the property-specific row first, then the legacy org-wide row.
 *
 * Pass `propertyId = null` to fetch only the legacy org-wide row (useful
 * for the admin / settings UI when listing a single org-level connection).
 */
export async function findCursiveIntegrationForProperty(
  orgId: string,
  propertyId: string | null,
): Promise<CursiveIntegration | null> {
  if (propertyId) {
    const specific = await prisma.cursiveIntegration.findUnique({
      where: { orgId_propertyId: { orgId, propertyId } },
    });
    if (specific) return specific;
  }
  return prisma.cursiveIntegration.findFirst({
    where: { orgId, propertyId: null },
  });
}

/**
 * List every Cursive integration row for an org — both per-property
 * connections AND the legacy org-wide row (if any). Used by the
 * settings UI to render the full table of pixels.
 *
 * Property is included as a nested object so the UI can name each row
 * without an extra round-trip.
 */
export async function listCursiveIntegrationsForOrg(
  orgId: string,
): Promise<CursiveWithProperty[]> {
  const rows = await prisma.cursiveIntegration.findMany({
    where: { orgId },
    include: { property: { select: { id: true, name: true } } },
    // Property-specific rows first (sorted by name via secondary join);
    // legacy org-wide row (propertyId = NULL) renders last so the UI
    // shows specific connections at the top.
    orderBy: [{ propertyId: "asc" }, { createdAt: "asc" }],
  });
  return rows;
}

/**
 * Find the SEO integration (GA4 or GSC) that applies to a given
 * property + provider combination. Same NULL-fallback semantics as the
 * Cursive helper.
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
// "Pixel installed: 3 of 5 properties" granularity.
// ---------------------------------------------------------------------------

export type IntegrationCoverageRow = {
  propertyId: string;
  propertyName: string;
  hasIntegration: boolean;
  // True when the integration coverage comes from a legacy org-wide
  // row, false when there's a property-specific row. Useful for UI
  // copy ("inherits from org-wide pixel") or for data-quality nags.
  inheritsFromLegacy: boolean;
};

/**
 * Returns one row per property in the org with whether the property is
 * covered by a Cursive pixel — either a property-specific row or the
 * legacy org-wide row. Sorted by property name so the setup wizard
 * lists are predictable.
 */
export async function getCursiveCoverage(
  orgId: string,
): Promise<IntegrationCoverageRow[]> {
  const [properties, integrations] = await Promise.all([
    prisma.property.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.cursiveIntegration.findMany({
      where: { orgId, cursivePixelId: { not: null } },
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

/**
 * Same shape as getCursiveCoverage but for SEO integrations of a given
 * provider. Useful for "GA4: 3 of 5 properties" and "GSC: 1 of 5
 * properties" tiles in the setup hub.
 */
export async function getSeoCoverage(
  orgId: string,
  provider: SeoProvider,
): Promise<IntegrationCoverageRow[]> {
  const [properties, integrations] = await Promise.all([
    prisma.property.findMany({
      where: { orgId },
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

/**
 * "Quick summary" across an org: counts of total / covered properties
 * for an integration kind. Used by KPI tiles where you don't need the
 * row-by-row breakdown.
 */
export async function summarizeCursiveCoverage(orgId: string) {
  const rows = await getCursiveCoverage(orgId);
  return {
    total: rows.length,
    covered: rows.filter((r) => r.hasIntegration).length,
  };
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
