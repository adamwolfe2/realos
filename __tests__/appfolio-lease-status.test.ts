// AppFolio sync left every lease ACTIVE forever (Telegraph Commons, 2026-10:
// 177 ACTIVE rows, 89 not on the rent roll, 80 past their end date).
// Root causes: (1) the status heuristic read `end_date`, but rent_roll sends
// `lease_to`; (2) leases that drop off the rent roll were never revisited.
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { leaseStatusFor, mapLeasePayload } from "@/lib/integrations/appfolio";
import {
  endLeasesAbsentFromRentRoll,
  rentRollIsComplete,
} from "@/lib/integrations/appfolio-lease-sweep";

const NOW = new Date("2026-10-21T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("leaseStatusFor", () => {
  it("uses the mapped dates", () => {
    expect(leaseStatusFor({ rawStatus: "Current", startDate: day(-200), endDate: day(200) }, NOW)).toBe("ACTIVE");
    expect(leaseStatusFor({ rawStatus: "Current", startDate: day(-200), endDate: day(30) }, NOW)).toBe("EXPIRING");
    expect(leaseStatusFor({ rawStatus: "Current", startDate: day(10), endDate: day(375) }, NOW)).toBe("PENDING");
  });

  it("keeps a row still on the rent roll past its end date ACTIVE (month-to-month holdover)", () => {
    expect(leaseStatusFor({ rawStatus: "Current", startDate: day(-400), endDate: day(-5) }, NOW)).toBe("ACTIVE");
  });

  it("maps AppFolio's real status strings", () => {
    expect(leaseStatusFor({ rawStatus: "Notice-Rented", startDate: day(-300), endDate: day(90) }, NOW)).toBe("EXPIRING");
    expect(leaseStatusFor({ rawStatus: "Notice-Unrented", startDate: null, endDate: null }, NOW)).toBe("EXPIRING");
    expect(leaseStatusFor({ rawStatus: "Evict", startDate: null, endDate: null }, NOW)).toBe("EVICTED");
    expect(leaseStatusFor({ rawStatus: "Moved Out", startDate: null, endDate: null }, NOW)).toBe("ENDED");
  });

  it("mapLeasePayload reads lease_to for the status, not end_date", () => {
    const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const m = mapLeasePayload({ occupancy_id: "o1", status: "Current", lease_from: "2025-08-01", lease_to: soon });
    expect(m?.endDate?.toISOString().slice(0, 10)).toBe(soon);
    expect(m?.status).toBe("EXPIRING");
  });
});

describe("rentRollIsComplete", () => {
  it("requires rows, every row mapped, and no truncation", () => {
    expect(rentRollIsComplete({ rowCount: 88, unmappedRows: 0, truncated: false })).toBe(true);
    expect(rentRollIsComplete({ rowCount: 0, unmappedRows: 0, truncated: false })).toBe(false);
    expect(rentRollIsComplete({ rowCount: 88, unmappedRows: 1, truncated: false })).toBe(false);
    expect(rentRollIsComplete({ rowCount: 88, unmappedRows: 0, truncated: true })).toBe(false);
  });
});

function fakeDb(candidates: Array<{ id: string; externalId: string | null }>) {
  const findMany = vi.fn().mockResolvedValue(candidates);
  const updateMany = vi.fn().mockImplementation(({ where }) => Promise.resolve({ count: where.id.in.length }));
  return { db: { lease: { findMany, updateMany } }, findMany, updateMany };
}

describe("endLeasesAbsentFromRentRoll", () => {
  const base = { orgId: "org1", propertyIds: ["p1"], now: NOW };

  it("ends past-term ACTIVE/EXPIRING leases missing from a complete pull", async () => {
    const { db, findMany, updateMany } = fakeDb([
      { id: "a", externalId: "on-roll" },
      { id: "b", externalId: "moved-out" },
      { id: "c", externalId: null },
    ]);
    const ended = await endLeasesAbsentFromRentRoll(db, { ...base, seenExternalIds: new Set(["on-roll"]) });
    expect(ended).toBe(1);
    const where = findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      orgId: "org1",
      externalSystem: "appfolio",
      propertyId: { in: ["p1"] },
      status: { in: ["ACTIVE", "EXPIRING"] },
      endDate: { lt: NOW },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b"] }, status: { in: ["ACTIVE", "EXPIRING"] } },
      data: { status: "ENDED" },
    });
  });

  it("does nothing when no property was seen in the pull", async () => {
    const { db, findMany, updateMany } = fakeDb([{ id: "b", externalId: "x" }]);
    expect(await endLeasesAbsentFromRentRoll(db, { ...base, propertyIds: [], seenExternalIds: new Set() })).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
