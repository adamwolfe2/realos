import { describe, it, expect } from "vitest";
import { mergeEntities } from "@/lib/aeo/merge-entities";

describe("lib/aeo/merge-entities — mergeEntities", () => {
  it("a name classified as both self AND competitor collapses to one self row", () => {
    const merged = mergeEntities(
      [
        { name: "Telegraph Commons", kind: "self", count: 12 },
        { name: "Telegraph Commons", kind: "competitor", count: 3 },
      ],
      [{ name: "Telegraph Commons", count: 5 }],
    );
    expect(merged).toEqual([
      { name: "Telegraph Commons", kind: "self", count: 12 },
    ]);
  });

  it("a competitor in both sources takes the max, not the sum", () => {
    const merged = mergeEntities(
      [{ name: "Rival Lofts", kind: "competitor", count: 9 }],
      [{ name: "Rival Lofts", count: 9 }],
    );
    expect(merged).toEqual([
      { name: "Rival Lofts", kind: "competitor", count: 9 },
    ]);
  });

  it("unequal counts across sources pin MAX (not min/keep-first/sum)", () => {
    const merged = mergeEntities(
      [{ name: "Rival Lofts", kind: "competitor", count: 9 }],
      [{ name: "rival lofts", count: 4 }],
    );
    // 9 kills min(4), sum(13); the display casing follows the
    // higher-count source (topEntities here).
    expect(merged).toEqual([
      { name: "Rival Lofts", kind: "competitor", count: 9 },
    ]);

    const rollupWins = mergeEntities(
      [{ name: "rival lofts", kind: "competitor", count: 2 }],
      [{ name: "Rival Lofts", count: 7 }],
    );
    // Rollup has the higher count → its count AND its casing win.
    expect(rollupWins).toEqual([
      { name: "Rival Lofts", kind: "competitor", count: 7 },
    ]);
  });

  it("drops kind=other rows entirely", () => {
    const merged = mergeEntities(
      [{ name: "Downtown District", kind: "other", count: 20 }],
      [],
    );
    expect(merged).toEqual([]);
  });

  it("a rollup-only competitor (never in topEntities) still appears", () => {
    const merged = mergeEntities([], [{ name: "Skyline Apartments", count: 4 }]);
    expect(merged).toEqual([
      { name: "Skyline Apartments", kind: "competitor", count: 4 },
    ]);
  });

  it("caps at 15 and sorts by count desc, name asc tiebreak", () => {
    const topEntities = Array.from({ length: 20 }, (_, i) => ({
      name: `Competitor ${String(i).padStart(2, "0")}`,
      kind: "competitor" as const,
      count: 1,
    }));
    const merged = mergeEntities(topEntities, []);
    expect(merged).toHaveLength(15);
    expect(merged[0].name).toBe("Competitor 00");
    expect(merged[14].name).toBe("Competitor 14");
    for (let i = 1; i < merged.length; i++) {
      expect(
        merged[i - 1].count > merged[i].count ||
          (merged[i - 1].count === merged[i].count &&
            merged[i - 1].name.localeCompare(merged[i].name) <= 0),
      ).toBe(true);
    }
  });
});
