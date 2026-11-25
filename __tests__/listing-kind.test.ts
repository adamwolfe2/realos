import { describe, expect, it } from "vitest";
import { listingKind, rentByKind } from "@/lib/listings/kind";

// Real SG unit names and titles (AppFolio unit_directory, 2026-11-25).
const t = (unitNumber: string, title = "", extra: Record<string, string> = {}) => ({ unitNumber, raw: { marketing_title: title, ...extra } });

describe("listingKind", () => {
  it.each([
    t("410 - B", "1 Bed in a Female Triple Occupancy Unit"),
    t("302 - C2"),
    t("307B", "Aquatic @ U – Exclusive Shared Studio"),
    t("511 Room 1 Bed A"),
    t("Spring Double 2027"),
    t("Pre lease Single 2027 - 2028"),
    t("Telegraph Commons - Triple - Spring"),
    t("302", "Lease Takeover – Bed Available in 3B"),
    t("00", "The Magic of Aquatic @ U! Shared Furnished studio units!"),
    { unitNumber: "401A", unitType: "2B Private Bedroom" },
  ])("room: $unitNumber", (l) => expect(listingKind(l)).toBe("room"));

  it.each([
    t("PRELEASE 2-bed, 1-bath"),
    t("Spring 5bed/2bath 2027"),
    t("Pre lease 1Bed"),
    t("1 Bedroom [Premium]"),
    t("Single Occupancy Pre-lease", "PRIVATE Furnished Studio for the 2027 - 2028 School Year!"),
    t("Aquatic @ U Pre-Lease", "Shared and Private furnished studio units!"),
    t("101", "HUGE 5 Bedroom 2 Bath Furnished Flat"),
    t("206", "3Bdr/2Bath! Rooftop deck! Bike Room!"),
    t("203 - Furnished"),
  ])("unit: $unitNumber", (l) => expect(listingKind(l)).toBe("unit"));

  it("parking, storage and commercial are not homes", () => {
    expect(listingKind(t("Parking 12"))).toBe("other");
    expect(listingKind(t("D", "1044 C St., Suite D", { billed_as: "Plus: Commercial" }))).toBe("other");
    // A room title that mentions storage is still a room.
    expect(listingKind(t("201 Room 3 Bed A", "Rent by The Bed! Free storage until August!"))).toBe("room");
  });

  it("ranges rent per kind and ignores placeholder prices", () => {
    const r = rentByKind([
      { ...t("Spring Double 2027"), priceCents: 74_800 },
      { ...t("Spring Single 2027"), priceCents: 149_500 },
      { ...t("Spring 5bed/2bath 2027"), priceCents: 999_500 },
      { ...t("Telegraph Commons - Double - Spring"), priceCents: null },
      { ...t("Parking 3"), priceCents: 15_000 },
    ]);
    expect(r.room).toEqual({ count: 3, min: 74_800, max: 149_500 });
    expect(r.unit).toEqual({ count: 1, min: 999_500, max: 999_500 });
    expect(r.other.count).toBe(1);
  });
});
