import { describe, it, expect, vi } from "vitest";

// Regression (multi-property): the QueryLandingDaily aggregator read SeoQuery
// org-wide for each property's day, so in an org with two ACTIVE properties
// A and B, A's fact table carried B's Search Console queries (and vice versa).

type Q = { propertyId: string | null; query: string; impressions: number; clicks: number; ctr: number; position: number };
const gscRows: Q[] = [
  { propertyId: "A", query: "alpha house rent", impressions: 50, clicks: 5, ctr: 0.1, position: 2 },
  { propertyId: "B", query: "beta house rent", impressions: 70, clicks: 7, ctr: 0.1, position: 3 },
];

// Minimal evaluator for the where shapes the aggregator uses.
function matches(row: Q, where: Record<string, unknown>): boolean {
  if ("propertyId" in where && where.propertyId !== row.propertyId) return false;
  if (Array.isArray(where.OR)) {
    return (where.OR as Record<string, unknown>[]).some((w) => matches(row, w));
  }
  return true;
}

const written: Array<{ propertyId: string; query: string }> = [];

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(async () => [
        { id: "A", orgId: "o1", name: "Alpha House", org: { name: "Org" } },
        { id: "B", orgId: "o1", name: "Beta House", org: { name: "Org" } },
      ]),
    },
    serpRanking: { findMany: vi.fn(async () => []) },
    seoQuery: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        gscRows.filter((r) => matches(r, where)),
      ),
    },
    queryLandingDaily: {
      upsert: vi.fn(async ({ create }: { create: { propertyId: string; query: string } }) => {
        written.push({ propertyId: create.propertyId, query: create.query });
        return create;
      }),
    },
  },
}));

const { runFactTableAggregation } = await import("@/lib/seo/aggregate-fact-table");

describe("fact-table aggregation in a two-property org", () => {
  it("writes each property's GSC queries only under that property", async () => {
    await runFactTableAggregation({ date: new Date("2026-11-01T00:00:00Z") });
    expect(written.filter((w) => w.propertyId === "A").map((w) => w.query)).toEqual([
      "alpha house rent",
    ]);
    expect(written.filter((w) => w.propertyId === "B").map((w) => w.query)).toEqual([
      "beta house rent",
    ]);
  });
});
