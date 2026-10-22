// AppFolio sync left every lease ACTIVE forever (Telegraph Commons, 2026-10:
// 177 ACTIVE rows, 89 not on the rent roll, 80 past their end date).
// Root causes: (1) the status heuristic read `end_date`, but rent_roll sends
// `lease_to`; (2) leases that drop off the rent roll were never revisited.
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchAllPages, leaseStatusFor, mapLeasePayload } from "@/lib/integrations/appfolio";
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
  const residentUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
  return {
    db: { lease: { findMany, updateMany }, resident: { updateMany: residentUpdateMany } },
    findMany,
    updateMany,
    residentUpdateMany,
  };
}

describe("endLeasesAbsentFromRentRoll", () => {
  const base = { orgId: "org1", propertyIds: ["p1"], now: NOW };

  it("ends past-term ACTIVE/EXPIRING leases missing from a complete pull", async () => {
    const { db, findMany, updateMany, residentUpdateMany } = fakeDb([
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
    // endDate re-checked so a concurrent renewal is not ended.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b"] }, status: { in: ["ACTIVE", "EXPIRING"] }, endDate: { lt: NOW } },
      data: { status: "ENDED" },
    });
    // The ended lease stops being the resident's current lease.
    expect(residentUpdateMany).toHaveBeenCalledWith({
      where: { currentLeaseId: { in: ["b"] }, currentLease: { status: "ENDED" } },
      data: { currentLeaseId: null },
    });
  });

  it("does nothing when no property was seen in the pull", async () => {
    const { db, findMany, updateMany } = fakeDb([{ id: "b", externalId: "x" }]);
    expect(await endLeasesAbsentFromRentRoll(db, { ...base, propertyIds: [], seenExternalIds: new Set() })).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("fetchAllPages truncation signal", () => {
  function client(totalPages: number) {
    let served = 0;
    return {
      fetchReport: vi.fn(async () => {
        served += 1;
        return { results: [{ n: served }], nextPageUrl: served < totalPages ? `p${served + 1}` : null };
      }),
    };
  }

  it("a report exactly MAX_PAGES (50) long is complete, not truncated", async () => {
    const onTruncated = vi.fn();
    const rows = await fetchAllPages(client(50) as never, "rent_roll", { onTruncated });
    expect(rows).toHaveLength(50);
    expect(onTruncated).not.toHaveBeenCalled();
  });

  it("flags truncation when another page exists past MAX_PAGES", async () => {
    const onTruncated = vi.fn();
    await fetchAllPages(client(51) as never, "rent_roll", { onTruncated });
    expect(onTruncated).toHaveBeenCalledTimes(1);
  });
});

describe("lease end-sweep wiring", () => {
  const content = fs.readFileSync(path.resolve(__dirname, "../lib/integrations/appfolio-sync.ts"), "utf-8");

  it("runs the sweep in one transaction so a failed chunk rolls back", () => {
    expect(content).toMatch(/prisma\.\$transaction\(\s*\(tx\) =>\s*endLeasesAbsentFromRentRoll\(tx,/);
  });

  it("persists leasesEnded in lastSyncStats", () => {
    const persisted = content.slice(content.indexOf("const persistedStats"), content.indexOf("phaseFailures,\n  };"));
    expect(persisted).toContain("leasesEnded: stats.leasesEnded");
  });
});
