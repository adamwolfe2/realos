import { prisma } from "@/lib/db";
import { rentByKind } from "@/lib/listings/kind";
import { captureWithContext } from "@/lib/sentry";

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
 *    on the REST sync read availableCount=0. Recomputed from Listing rows,
 *    homes only (rooms + whole units; parking/storage/commercial left out),
 *    and today's counts recorded in PropertyAvailabilityDaily so the
 *    portfolio's available-units card has a real trend line.
 */
/**
 * Whether this sync starts a listing's time on market (Listing.listedAt):
 * advertised now, and either relisted (was unavailable) or new on a
 * property we already track. A property's first pull has no history, so
 * "new" there only means "advertised before we looked": left NULL.
 */
export function startsListing(isAvailable: boolean, wasAvailable: boolean | undefined, propertyHasRows: boolean): boolean {
  if (!isAvailable || wasAvailable === true) return false;
  return wasAvailable === false || propertyHasRows;
}

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

/** Returns a warning when the daily availability row could not be written
 *  (the trend is a nice-to-have: it must never fail the listings phase). */
export async function refreshPropertyListingDenorm(
  propertyIds: readonly string[],
  now: Date = new Date(),
): Promise<string | null> {
  const ids = [...new Set(propertyIds)];
  if (ids.length === 0) return null;
  let trendError: string | null = null;
  const listings = await prisma.listing.findMany({
    where: { propertyId: { in: ids }, isAvailable: true },
    select: { propertyId: true, unitNumber: true, unitType: true, priceCents: true, raw: true },
  });
  const byProperty = new Map<string, typeof listings>();
  for (const l of listings) byProperty.set(l.propertyId, [...(byProperty.get(l.propertyId) ?? []), l]);
  // UTC calendar day: one availability row per property per day, last run wins.
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (const id of ids) {
    const k = rentByKind(byProperty.get(id) ?? []);
    const mins = [k.room.min, k.unit.min].filter((n): n is number => n !== null);
    const maxs = [k.room.max, k.unit.max].filter((n): n is number => n !== null);
    await prisma.property.update({
      where: { id },
      data: {
        availableCount: k.room.count + k.unit.count,
        priceMin: mins.length ? Math.min(...mins) : null,
        priceMax: maxs.length ? Math.max(...maxs) : null,
      },
    });
    const counts = { rooms: k.room.count, units: k.unit.count, other: k.other.count };
    try {
      await prisma.propertyAvailabilityDaily.upsert({
        where: { propertyId_date: { propertyId: id, date } },
        create: { propertyId: id, date, ...counts },
        update: counts,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[appfolio-listing-denorm] availability snapshot failed for ${id}`, err);
      captureWithContext(err, { handler: "refreshPropertyListingDenorm", propertyId: id });
      trendError = trendError ?? message;
    }
  }
  return trendError ? `listings-trend: daily availability not recorded (${trendError.slice(0, 160)})` : null;
}
