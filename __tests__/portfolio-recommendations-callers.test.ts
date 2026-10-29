// Guard: propertyIds is optional, so tsc can't catch a caller that drops it.
// A portal caller without it shows a property-restricted agent action items
// for every property in the org (the redesign's move of /portal to
// /portal/performance dropped it once).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("getPortfolioRecommendations callers", () => {
  it("every portal call passes the scope's property grants", () => {
    const calls = files("app/portal").flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/getPortfolioRecommendations\(([\s\S]*?)\)/g)].map((m) => ({ f, args: m[1] })),
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => !c.args.includes("propertyIds: scope.allowedPropertyIds")).map((c) => c.f)).toEqual([]);
  });
});
