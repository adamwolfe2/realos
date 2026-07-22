import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression: pipeline pages (applications, renewals, work orders, leads…)
// must NEVER default to the entire synced AppFolio portfolio. With no
// explicit property selection, marketableScopedPropertyClause() scopes the
// query to the org's marketable (lifecycle=ACTIVE / "enabled") property
// set. SG Real Estate bug (2026-07-21): 704 applications rendered when
// only 72 belonged to Telegraph Commons, the org's one enabled building —
// the other 632 came from 127 EXCLUDED + 7 IMPORTED properties.
// ---------------------------------------------------------------------------

const findMany = vi.fn<
  (args: { where: unknown; select: unknown }) => Promise<Array<{ id: string }>>
>();
vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findMany: (args: never) => findMany(args) },
  },
}));

import { marketableScopedPropertyClause } from "@/lib/tenancy/property-filter";

const unrestricted = { orgId: "org_1", allowedPropertyIds: null };

beforeEach(() => {
  findMany.mockReset();
});

describe("marketableScopedPropertyClause — default (no selection)", () => {
  it("scopes to the org's marketable property ids, not the whole portfolio", async () => {
    findMany.mockResolvedValue([{ id: "telegraph_commons" }]);
    const clause = await marketableScopedPropertyClause(unrestricted, null);
    expect(clause).toEqual({ propertyId: "telegraph_commons" });
  });

  it("uses an IN list for multiple enabled properties", async () => {
    findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const clause = await marketableScopedPropertyClause(unrestricted, null);
    expect(clause).toEqual({ propertyId: { in: ["p1", "p2"] } });
  });

  it("queries ONLY marketable lifecycles (ACTIVE)", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    await marketableScopedPropertyClause(unrestricted, null);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org_1",
          lifecycle: { in: ["ACTIVE"] },
        }),
      }),
    );
  });

  it("matches NOTHING (not everything) when the org has zero enabled properties", async () => {
    findMany.mockResolvedValue([]);
    const clause = await marketableScopedPropertyClause(unrestricted, null);
    expect(clause).toEqual({ propertyId: "__no_marketable_properties__" });
  });

  it("keeps org-level (null propertyId) rows visible when asked", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    const clause = await marketableScopedPropertyClause(
      unrestricted,
      null,
      "propertyId",
      { defaultIncludesOrgRows: true },
    );
    expect(clause).toEqual({
      OR: [{ propertyId: "p1" }, { propertyId: null }],
    });
  });
});

describe("marketableScopedPropertyClause — explicit selection unchanged", () => {
  it("honors an explicit selection without touching the DB", async () => {
    const clause = await marketableScopedPropertyClause(unrestricted, [
      "picked_1",
      "picked_2",
    ]);
    expect(clause).toEqual({ propertyId: { in: ["picked_1", "picked_2"] } });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("preserves the restricted-user deny sentinel", async () => {
    const restricted = { orgId: "org_1", allowedPropertyIds: ["allowed_1"] };
    const clause = await marketableScopedPropertyClause(restricted, [
      "forbidden_1",
    ]);
    expect(clause).toEqual({ propertyId: "__no_property_access__" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("restricted user with no selection gets their allowed set, not the marketable fetch", async () => {
    const restricted = { orgId: "org_1", allowedPropertyIds: ["a1", "a2"] };
    const clause = await marketableScopedPropertyClause(restricted, null);
    expect(clause).toEqual({ propertyId: { in: ["a1", "a2"] } });
    expect(findMany).not.toHaveBeenCalled();
  });
});
