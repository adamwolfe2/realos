import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// marketableOrgClause — the org-scoped half of the marketable gate.
//
// Same root problem the 2026-08-01 forensic audit found in generate.ts
// (766 of 929 leads / 791 of 895 applications overclaimed), except that fix
// only covered the client report. Crons, insight digests, the dashboard
// velocity chart and the admin client panel still counted org-wide, so an
// AppFolio connection — which imports the operator's ENTIRE account — made
// them report buildings the operator never enabled in LeaseStack.
// SG Real Estate: 135 properties synced, 1 enabled.
//
// The property under test that actually matters is FAIL-CLOSED. If an org
// has no enabled properties, this must match NOTHING. Returning `{}` there
// would silently reopen the whole leak on every caller at once, and would
// do it on the orgs least able to notice (brand-new tenants).
// ---------------------------------------------------------------------------

// The mock MUST forward its arguments. It previously did not
// (`findMany: () => findMany()`), which made every test below inert against
// the single highest-value regression: rewriting the query in
// marketablePropertyIds to `where: {}` — dropping BOTH the org filter and
// the lifecycle filter, i.e. reopening the entire over-sync leak across
// every caller at once — left all six tests green. Caught by
// parallel-review 2026-08-04; see the WHERE-shape test below.
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { property: { findMany: (args: unknown) => findMany(args) } },
}));

const { marketableOrgClause, NO_MARKETABLE_PROPERTIES } = await import(
  "@/lib/tenancy/property-filter"
);

beforeEach(() => findMany.mockReset());

describe("marketablePropertyIds — the query the whole gate rests on", () => {
  // Without this, every other assertion in this file is satisfied by a
  // property-filter that selects the entire Property table. The clause
  // SHAPE being right is worthless if the id list feeding it is wrong.
  it("filters by BOTH orgId and lifecycle=ACTIVE", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    await marketableOrgClause("org_1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orgId: "org_1",
          lifecycle: { in: ["ACTIVE"] },
        }),
      }),
    );
  });

  it("does not leak across tenants — the orgId is the one passed in", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    await marketableOrgClause("org_other");
    const args = findMany.mock.calls[0]?.[0] as
      | { where?: { orgId?: string } }
      | undefined;
    expect(args?.where?.orgId).toBe("org_other");
  });
});

describe("marketableOrgClause", () => {
  it("FAILS CLOSED when the org has no enabled properties", async () => {
    findMany.mockResolvedValue([]);
    const clause = await marketableOrgClause("org_1");
    expect(clause).toEqual({ propertyId: NO_MARKETABLE_PROPERTIES });
    // The dangerous shapes: an empty object matches everything, and a
    // bare `{ in: [] }` under an OR with null would still leak org rows.
    expect(clause).not.toEqual({});
    expect(Object.keys(clause)).toHaveLength(1);
  });

  it("fails closed even when org-level rows were requested", async () => {
    findMany.mockResolvedValue([]);
    // includeOrgLevel must NOT turn "no enabled properties" into
    // "everything with a null property" — still match nothing.
    const clause = await marketableOrgClause("org_1", "propertyId", {
      includeOrgLevel: true,
    });
    expect(clause).toEqual({ propertyId: NO_MARKETABLE_PROPERTIES });
    expect(clause).not.toHaveProperty("OR");
  });

  it("scopes to exactly the enabled properties", async () => {
    findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    expect(await marketableOrgClause("org_1")).toEqual({
      propertyId: { in: ["p1", "p2"] },
    });
  });

  it("keeps unattributed rows only when explicitly asked", async () => {
    findMany.mockResolvedValue([{ id: "p1" }, { id: "p2" }]);
    const withOrgRows = await marketableOrgClause("org_1", "propertyId", {
      includeOrgLevel: true,
    });
    expect(withOrgRows).toEqual({
      OR: [{ propertyId: { in: ["p1", "p2"] } }, { propertyId: null }],
    });
    // Default must NOT include null-property rows — models like Application
    // and Tour require a propertyId, so an OR-null branch there is dead
    // weight that only widens the result set.
    const strict = await marketableOrgClause("org_1");
    expect(strict).not.toHaveProperty("OR");
  });

  it("honours a non-default FK column", async () => {
    findMany.mockResolvedValue([{ id: "p1" }]);
    expect(await marketableOrgClause("org_1", "propId")).toEqual({
      propId: "p1",
    });
  });

  it("never returns an empty object for any input", async () => {
    // An empty clause spread into a `where` is indistinguishable from no
    // filter at all — the exact bug this helper exists to prevent.
    for (const rows of [[], [{ id: "p1" }], [{ id: "p1" }, { id: "p2" }]]) {
      findMany.mockResolvedValue(rows);
      for (const opts of [{}, { includeOrgLevel: true }]) {
        const clause = await marketableOrgClause("org_1", "propertyId", opts);
        expect(Object.keys(clause).length).toBeGreaterThan(0);
      }
    }
  });
});
