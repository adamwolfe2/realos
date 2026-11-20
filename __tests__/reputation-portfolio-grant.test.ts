import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression (multi-property grant leak): /portal/reputation passes
// effectivePropertyIds(), which is [] when a property-restricted user selects
// a property outside their grant. The portfolio loaders treated [] as "no
// filter" and returned every property's mentions in the org.

const mentionFindMany = vi.fn(async () => []);

vi.mock("@/lib/db", () => ({
  prisma: {
    property: {
      findMany: vi.fn(async () => [{ id: "A" }, { id: "B" }]),
    },
    propertyMention: { findMany: mentionFindMany },
  },
}));

const { loadPortfolioReputationFeed } = await import("@/lib/reputation/portfolio");

beforeEach(() => mentionFindMany.mockClear());

describe("loadPortfolioReputationFeed property narrowing", () => {
  it("returns nothing for an empty (denied) selection", async () => {
    const rows = await loadPortfolioReputationFeed("o1", 50, { propertyIds: [] });
    expect(rows).toEqual([]);
    expect(mentionFindMany).not.toHaveBeenCalled();
  });

  it("narrows to the selected property", async () => {
    await loadPortfolioReputationFeed("o1", 50, { propertyIds: ["B"] });
    const where = (mentionFindMany.mock.calls[0] as unknown as [{ where: { propertyId: unknown } }])[0].where;
    expect(where.propertyId).toEqual({ in: ["B"] });
  });

  it("keeps every marketable property with no selection (null)", async () => {
    await loadPortfolioReputationFeed("o1", 50, { propertyIds: null });
    const where = (mentionFindMany.mock.calls[0] as unknown as [{ where: { propertyId: unknown } }])[0].where;
    expect(where.propertyId).toEqual({ in: ["A", "B"] });
  });
});
