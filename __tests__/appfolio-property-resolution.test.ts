import { describe, it, expect } from "vitest";
import { resolveAppfolioPropertyId } from "@/lib/integrations/appfolio-sync";

/**
 * Locks the multi-property safety invariant: the AppFolio sync must NEVER
 * guess which local Property a row belongs to when the org has more than one
 * property. Guessing would silently file an application / lease / resident /
 * work order under the wrong building, corrupting per-property nesting across
 * a portfolio. The single-property convenience fallback is the only case
 * where an unmatched row may resolve.
 */
describe("resolveAppfolioPropertyId", () => {
  const single = new Map<string, string>([["af-1", "local-1"]]);
  const multi = new Map<string, string>([
    ["af-1", "local-1"],
    ["af-2", "local-2"],
    ["af-3", "local-3"],
  ]);

  it("returns null when the map is empty (no properties synced yet)", () => {
    expect(resolveAppfolioPropertyId(new Map(), ["af-1"])).toBeNull();
    expect(resolveAppfolioPropertyId(new Map(), [])).toBeNull();
  });

  it("resolves a direct external-id match in a multi-property org", () => {
    expect(resolveAppfolioPropertyId(multi, ["af-2"])).toBe("local-2");
  });

  it("tries candidates in order and returns the first hit", () => {
    expect(resolveAppfolioPropertyId(multi, ["nope", "af-3"])).toBe("local-3");
  });

  it("NEVER guesses in a multi-property org when no id matches", () => {
    expect(resolveAppfolioPropertyId(multi, ["unknown"])).toBeNull();
    expect(resolveAppfolioPropertyId(multi, [])).toBeNull();
  });

  it("falls back to the only property in a single-property org", () => {
    // matching id
    expect(resolveAppfolioPropertyId(single, ["af-1"])).toBe("local-1");
    // non-matching id — safe to use the only property, nothing to mis-assign
    expect(resolveAppfolioPropertyId(single, ["whatever"])).toBe("local-1");
    // no id at all — same single-property convenience
    expect(resolveAppfolioPropertyId(single, [])).toBe("local-1");
  });
});
