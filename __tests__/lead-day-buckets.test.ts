import { describe, it, expect, vi } from "vitest";

// F-124: daily lead sparkline buckets come from one grouped SQL query. The
// helper must place rows at the same index the old JS dayBucketIndex did
// (idx = W-1-daysAgo), drop out-of-window rows, and key by property.

const queryRaw = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw } }));

const { leadDayBucketsByProperty } = await import(
  "@/lib/dashboard/lead-day-buckets"
);

describe("leadDayBucketsByProperty", () => {
  it("builds W-length arrays per property from grouped rows", async () => {
    queryRaw.mockResolvedValueOnce([
      { propertyId: "a", idx: 27, n: BigInt(3) }, // today
      { propertyId: "a", idx: 0, n: BigInt(1) }, // 27 days ago
      { propertyId: "a", idx: -1, n: BigInt(9) }, // exactly 28d: dropped
      { propertyId: "b", idx: 20, n: BigInt(2) },
    ]);
    const out = await leadDayBucketsByProperty({
      orgId: "o",
      propertyIds: ["a", "b"],
      column: "createdAt",
      windowDays: 28,
    });
    expect(out.get("a")).toHaveLength(28);
    expect(out.get("a")![27]).toBe(3);
    expect(out.get("a")![0]).toBe(1);
    expect(out.get("a")!.reduce((x, y) => x + y, 0)).toBe(4);
    expect(out.get("b")![20]).toBe(2);
    expect(out.has("c")).toBe(false);
  });

  it("skips the query for no properties", async () => {
    queryRaw.mockClear();
    const out = await leadDayBucketsByProperty({
      orgId: "o", propertyIds: [], column: "createdAt", windowDays: 28,
    });
    expect(out.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
