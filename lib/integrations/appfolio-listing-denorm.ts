import { prisma } from "@/lib/db";

/**
 * Listing availability bookkeeping run at the end of the AppFolio
 * unit_directory phase.
 *
 * 1. `markUnseenListingsUnavailable` — unit_directory is a full snapshot, so
 *    a unit that dropped out of it (deleted, merged, re-keyed in AppFolio)
 *    is no longer marketed. Upserts alone never touch it, so it used to stay
 *    isAvailable=true forever and the chatbot kept quoting its old rent.
 *    Scoped to properties that returned at least one row this run, so a
 *    property-group filter or an AppFolio hiccup on one building can never
 *    blank another building's listings.
 *    ponytail: a building whose whole directory vanishes keeps its rows;
 *    handle that if AppFolio ever does it on purpose.
 *    Rows with a null backendListingId (operator-entered) are untouched:
 *    SQL `NOT IN` never matches NULL.
 *
 * 2. `refreshPropertyListingDenorm` — Property.availableCount / priceMin /
 *    priceMax were only written by the legacy embed sync, so every property
 *    on the REST sync read availableCount=0. Recomputed from Listing rows.
 */
export async function markUnseenListingsUnavailable(
  seenByProperty: ReadonlyMap<string, ReadonlySet<string>>,
): Promise<number> {
  let marked = 0;
  for (const [propertyId, seen] of seenByProperty) {
    if (seen.size === 0) continue;
    const res = await prisma.listing.updateMany({
      where: {
        propertyId,
        isAvailable: true,
        backendListingId: { notIn: [...seen] },
      },
      data: { isAvailable: false },
    });
    marked += res.count;
  }
  return marked;
}

export async function refreshPropertyListingDenorm(
  propertyIds: readonly string[],
): Promise<void> {
  const ids = [...new Set(propertyIds)];
  if (ids.length === 0) return;
  const [counts, prices] = await Promise.all([
    prisma.listing.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids }, isAvailable: true },
      _count: { _all: true },
    }),
    // Zero/blank rents are "contact for rate" placeholders, not a price.
    prisma.listing.groupBy({
      by: ["propertyId"],
      where: { propertyId: { in: ids }, isAvailable: true, priceCents: { gt: 0 } },
      _min: { priceCents: true },
      _max: { priceCents: true },
    }),
  ]);
  const countBy = new Map(counts.map((c) => [c.propertyId, c._count._all]));
  const priceBy = new Map(prices.map((p) => [p.propertyId, p]));
  for (const id of ids) {
    const price = priceBy.get(id);
    await prisma.property.update({
      where: { id },
      data: {
        availableCount: countBy.get(id) ?? 0,
        priceMin: price?._min.priceCents ?? null,
        priceMax: price?._max.priceCents ?? null,
      },
    });
  }
}
