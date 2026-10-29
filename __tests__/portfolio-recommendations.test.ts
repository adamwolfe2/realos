import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), cacheKeys: [] as string[][] }));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown, key: string[]) => {
    m.cacheKeys.push(key);
    return fn;
  },
}));
vi.mock("@/lib/db", () => ({
  prisma: { property: { findMany: m.findMany, findUnique: m.findUnique, findFirst: m.findUnique } },
}));

const { getPortfolioRecommendations } = await import("@/lib/intelligence/property-recommendations");

describe("getPortfolioRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.cacheKeys.length = 0;
    m.findUnique.mockResolvedValue(null);
  });

  it("only looks at a restricted user's granted properties", async () => {
    m.findMany.mockResolvedValue([]);
    await getPortfolioRecommendations("o1", { propertyIds: ["p2", "p1"] });
    expect(m.findMany.mock.calls[0][0].where.id).toEqual({ in: ["p1", "p2"] });
    expect(m.cacheKeys[0]).toContain("p1,p2");
  });

  it("does not cache restricted and unrestricted results under one key", async () => {
    m.findMany.mockResolvedValue([]);
    await getPortfolioRecommendations("o1", { propertyIds: ["p1"] });
    await getPortfolioRecommendations("o1", {});
    expect(m.cacheKeys[0]).not.toEqual(m.cacheKeys[1]);
  });

  it("resolves at most 8 properties at once", async () => {
    m.findMany.mockResolvedValue(Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })));
    let inFlight = 0;
    let peak = 0;
    m.findUnique.mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
      return null;
    });
    await getPortfolioRecommendations("o1");
    expect(m.findUnique).toHaveBeenCalledTimes(30);
    expect(peak).toBeLessThanOrEqual(8);
  });
});
