import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * SG health review 2026-11-24: the Stranda chatbot quoted unit 205 at $2,421
 * from a Listing row AppFolio no longer markets, and every SG property read
 * Property.availableCount=0. Three causes, three guards:
 *  1. isAvailable came from rent_ready (true for most occupied units) instead
 *     of whether AppFolio posts the unit for rent.
 *  2. Units that left unit_directory were never flipped to unavailable.
 *  3. availableCount was only written by the legacy embed sync.
 */

const db = vi.hoisted(() => ({
  updateMany: vi.fn(),
  groupBy: vi.fn(),
  propertyUpdate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    listing: { updateMany: db.updateMany, groupBy: db.groupBy },
    property: { update: db.propertyUpdate },
  },
}));

import { mapListingPayload } from "@/lib/integrations/appfolio";
import {
  markUnseenListingsUnavailable,
  refreshPropertyListingDenorm,
} from "@/lib/integrations/appfolio-listing-denorm";

describe("mapListingPayload isAvailable", () => {
  const base = { unit_id: 1, unit_name: "205", bedrooms: 1, market_rent: "2421.00" };

  it("rent-ready but not posted is NOT available (Stranda unit 205)", () => {
    const m = mapListingPayload({
      ...base,
      rent_ready: "Yes",
      rentable: "Yes",
      posted_to_website: "No",
      posted_to_internet: "No",
    });
    expect(m?.isAvailable).toBe(false);
  });

  it("posted to the AppFolio listings site is available even when not rent-ready", () => {
    expect(
      mapListingPayload({ ...base, rent_ready: "No", posted_to_website: "Yes", posted_to_internet: "No" })
        ?.isAvailable,
    ).toBe(true);
    expect(
      mapListingPayload({ ...base, rent_ready: "No", posted_to_website: "No", posted_to_internet: "Yes" })
        ?.isAvailable,
    ).toBe(true);
  });

  it("prices from the advertised (public) rent, falling back to market rent", () => {
    // Stranda 206: market $4,500, listed publicly at $3,995.
    expect(
      mapListingPayload({ ...base, market_rent: "4500.00", advertised_rent: "3995.00" })?.priceCents,
    ).toBe(399500);
    expect(
      mapListingPayload({ ...base, market_rent: "1495.00", advertised_rent: "0.00" })?.priceCents,
    ).toBe(149500);
    expect(
      mapListingPayload({ ...base, market_rent: "0.00", advertised_rent: "0.00" })?.priceCents,
    ).toBeNull();
  });

  it("payloads without posted_* fields keep the rent_ready fallback", () => {
    expect(mapListingPayload({ ...base, rent_ready: "No" })?.isAvailable).toBe(false);
    expect(mapListingPayload({ ...base, rent_ready: "Yes" })?.isAvailable).toBe(true);
  });
});

describe("markUnseenListingsUnavailable", () => {
  beforeEach(() => db.updateMany.mockReset());

  it("flips only listings of properties seen this pull, excluding the seen ids", async () => {
    db.updateMany.mockResolvedValue({ count: 2 });
    const n = await markUnseenListingsUnavailable(
      new Map([
        ["p1", new Set(["u1", "u2"])],
        ["p2", new Set<string>()],
      ]),
    );
    expect(n).toBe(2);
    expect(db.updateMany).toHaveBeenCalledTimes(1);
    expect(db.updateMany).toHaveBeenCalledWith({
      where: { propertyId: "p1", isAvailable: true, backendListingId: { notIn: ["u1", "u2"] } },
      data: { isAvailable: false },
    });
  });
});

describe("refreshPropertyListingDenorm", () => {
  beforeEach(() => {
    db.groupBy.mockReset();
    db.propertyUpdate.mockReset();
  });

  it("writes availableCount and price range from available listings, zero for none", async () => {
    db.groupBy
      .mockResolvedValueOnce([{ propertyId: "p1", _count: { _all: 4 } }])
      .mockResolvedValueOnce([
        { propertyId: "p1", _min: { priceCents: 269500 }, _max: { priceCents: 399500 } },
      ]);
    await refreshPropertyListingDenorm(["p1", "p2", "p1"]);
    expect(db.propertyUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { availableCount: 4, priceMin: 269500, priceMax: 399500 },
    });
    expect(db.propertyUpdate).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: { availableCount: 0, priceMin: null, priceMax: null },
    });
    expect(db.propertyUpdate).toHaveBeenCalledTimes(2);
  });
});
