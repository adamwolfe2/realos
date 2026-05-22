import "server-only";
import { prisma } from "@/lib/db";
import type { ReportSnapshot } from "@/lib/reports/generate";
import type { ComponentProps } from "react";
import type { ReportView } from "@/components/portal/reports/report-view";

// ---------------------------------------------------------------------------
// loadPropertyHero — resolves the building image + stats shown above the
// shared report. Norman feedback (May 22): "We need that beautiful looking
// image of the property that we're referencing in the report up at the top."
// — applies to BOTH property-scoped reports AND portfolio reports.
//
// Resolution order:
//   1. snapshot.scope.propertyId  → use that property
//   2. snapshot.properties[].id   → use the property with the most leads
//   3. fallback: any LIVE property in the org with a hero image
//   4. final fallback: any LIVE property in the org (image-less hero)
//
// Returns null only when the org has zero properties at all — in which case
// ReportView gracefully falls through to the text-only header strip.
// ---------------------------------------------------------------------------

type PropertyHero = NonNullable<
  ComponentProps<typeof ReportView>["propertyHero"]
>;

export async function loadPropertyHero(
  snapshot: ReportSnapshot,
  orgId: string,
): Promise<PropertyHero | null> {
  // 1. Scoped report — use the property explicitly attached to the snapshot.
  const scopedId = snapshot.scope?.propertyId ?? null;
  if (scopedId) {
    const hero = await fetchHero(scopedId);
    if (hero) return hero;
  }

  // 2. Portfolio report — pick the flagship from snapshot.properties (the
  //    rollup the report already shows in "By property"). Prefer the
  //    property with the highest lead count this period, falling back to
  //    occupancy when no leads are present anywhere.
  const ranked = [...(snapshot.properties ?? [])]
    .filter((p) => p.id)
    .sort((a, b) => {
      const leadDiff = (b.leads ?? 0) - (a.leads ?? 0);
      if (leadDiff !== 0) return leadDiff;
      return (b.occupancyPct ?? 0) - (a.occupancyPct ?? 0);
    });
  for (const p of ranked) {
    const hero = await fetchHero(p.id);
    if (hero) return hero;
  }

  // 3 + 4. Fall through to org-level property lookup so even brand-new
  //        snapshots with no per-property rollup still show a building.
  //        Prefer ACTIVE + LIVE first (the same filter the portal
  //        dashboards use), with images winning ties.
  const liveWithImage = await prisma.property
    .findFirst({
      where: {
        orgId,
        lifecycle: "ACTIVE",
        launchStatus: "LIVE",
        heroImageUrl: { not: null },
      },
      orderBy: [{ updatedAt: "desc" }],
      select: SELECT,
    })
    .catch(() => null);
  if (liveWithImage) return toHero(liveWithImage);

  const anyLive = await prisma.property
    .findFirst({
      where: {
        orgId,
        lifecycle: "ACTIVE",
        launchStatus: "LIVE",
      },
      orderBy: [{ updatedAt: "desc" }],
      select: SELECT,
    })
    .catch(() => null);
  if (anyLive) return toHero(anyLive);

  const anyActive = await prisma.property
    .findFirst({
      where: { orgId, lifecycle: "ACTIVE" },
      orderBy: [{ updatedAt: "desc" }],
      select: SELECT,
    })
    .catch(() => null);
  if (anyActive) return toHero(anyActive);

  return null;
}

const SELECT = {
  id: true,
  name: true,
  city: true,
  state: true,
  residentialSubtype: true,
  commercialSubtype: true,
  propertyType: true,
  heroImageUrl: true,
  heroImageOffsetX: true,
  heroImageOffsetY: true,
  heroImageScale: true,
  googleAggRating: true,
} as const;

async function fetchHero(propertyId: string): Promise<PropertyHero | null> {
  const property = await prisma.property
    .findUnique({
      where: { id: propertyId },
      select: SELECT,
    })
    .catch(() => null);
  if (!property) return null;
  return toHero(property);
}

// Narrow row type — exactly the columns we SELECT above. Avoids pulling
// in the full Prisma Property type (51 unrelated columns) which would
// make this helper sensitive to schema churn unrelated to the hero.
type PropertyRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  residentialSubtype: string | null;
  commercialSubtype: string | null;
  propertyType: string | null;
  heroImageUrl: string | null;
  heroImageOffsetX: number | null;
  heroImageOffsetY: number | null;
  heroImageScale: number | null;
  googleAggRating: number | null;
};

function toHero(property: PropertyRow): PropertyHero {
  const subtypeRaw =
    property.residentialSubtype ??
    property.commercialSubtype ??
    property.propertyType;
  const subtype = subtypeRaw
    ? String(subtypeRaw)
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : null;
  const location = [property.city, property.state].filter(Boolean).join(", ");
  return {
    propertyId: property.id,
    propertyName: property.name,
    subtitle: [location, subtype].filter(Boolean).join(" · ") || null,
    heroImageUrl: property.heroImageUrl ?? null,
    imageOffsetX: property.heroImageOffsetX ?? 0,
    imageOffsetY: property.heroImageOffsetY ?? 0,
    imageScale: property.heroImageScale ?? 1,
    googleAggRating: property.googleAggRating ?? null,
  };
}
