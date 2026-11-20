import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// buildWeeklyDigest scoped to a property-restricted recipient (2026-11).
// Org has ACTIVE properties A and B; the recipient is granted A only.
// Every number must come from A alone: no B rows, no org-level rows.
// ---------------------------------------------------------------------------

function autoMockPrisma() {
  const defaultFor = (method: string) => {
    switch (method) {
      case "count":
        return vi.fn(async () => 0);
      case "$queryRaw":
      case "$queryRawUnsafe":
        // Root-level prisma methods, not models — must be callable or a
        // Promise.all throws and every query after the raw call silently
        // never registers (the caller swallows it).
        return vi.fn(async () => [{ count: BigInt(0) }]);
      case "aggregate":
        return vi.fn(async () => ({ _sum: {}, _avg: {}, _count: { _all: 0 } }));
      case "groupBy":
        return vi.fn(async () => []);
      case "findMany":
        return vi.fn(async () => []);
      default:
        // findFirst / findUnique / anything else this file might add later.
        return vi.fn(async () => null);
    }
  };
  return new Proxy(
    {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
    {
      get(models, model: string) {
        // prisma.$queryRaw / $queryRawUnsafe are functions on the client
        // root, not models — return the fn directly instead of a model
        // proxy (which isn't callable).
        if (model.startsWith("$")) {
          if (!(model in models)) {
            models[model] = defaultFor(model) as unknown as Record<
              string,
              ReturnType<typeof vi.fn>
            >;
          }
          return models[model];
        }
        if (!(model in models)) {
          models[model] = new Proxy(
            {} as Record<string, ReturnType<typeof vi.fn>>,
            {
              get(methods, method: string) {
                if (!(method in methods)) methods[method] = defaultFor(method);
                return methods[method];
              },
            },
          );
        }
        return models[model];
      },
    },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = autoMockPrisma();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));
// The org-wide (no propertyIds) path is not exercised here: it calls
// marketableOrgClause twice inside one Promise.all, and the second of those
// concurrent dynamic imports of @/lib/db resolves the real client under
// vitest. That path is unchanged by this fix.


const { buildWeeklyDigest } = await import("@/lib/reports/weekly-digest");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.property.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
    args.where.id ? [{ id: "pA", name: "A House" }] : [{ id: "pA" }, { id: "pB" }],
  );
});

const PROPERTY_SCOPED = ["lead", "tour", "application", "insight", "seoScoreHistory", "seoActionRecommendation", "contentDraft"];

describe("buildWeeklyDigest({ propertyIds })", () => {
  it("restricted to A: every property-dimensioned query is exactly A, never org-level", async () => {
    await buildWeeklyDigest("org-1", { propertyIds: ["pA"] });
    for (const model of PROPERTY_SCOPED) {
      for (const method of ["count", "groupBy", "findMany"]) {
        for (const [args] of mockPrisma[model][method].mock.calls) {
          expect(args.where.propertyId, `${model}.${method}`).toBe("pA");
          expect(args.where.OR, `${model}.${method}`).toBeUndefined();
        }
      }
    }
    const [adArgs] = mockPrisma.adMetricDaily.aggregate.mock.calls[0];
    expect(adArgs.where.campaign).toEqual({ propertyId: "pA" });
    const [seoArgs] = mockPrisma.seoSnapshot.findMany.mock.calls[0];
    expect(seoArgs.where.propertyId).toBe("pA");
  });

  it("a grant outside the enabled set matches nothing (never falls back to org-wide)", async () => {
    await buildWeeklyDigest("org-1", { propertyIds: ["pGone"] });
    const [args] = mockPrisma.lead.count.mock.calls[0];
    expect(args.where.propertyId).toBe("__no_marketable_properties__");
  });

});
