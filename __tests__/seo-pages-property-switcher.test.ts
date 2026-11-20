import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Structural guards (multi-property). The RSC pages pull in Clerk/next/prisma
// and are impractical to render in vitest (same tradeoff as
// report-draft-visibility.test.ts), so assert the scoping is wired in.

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

// Body of the first `prisma.<model>.findMany({ ... })` call in src.
function findManyWhere(src: string, model: string): string {
  const start = src.indexOf(`prisma.${model}.findMany(`);
  expect(start, `prisma.${model}.findMany not found`).toBeGreaterThan(-1);
  return src.slice(start, src.indexOf("select:", start));
}

describe("/portal/seo/aeo honours the property switcher and grants", () => {
  const src = read("app/portal/seo/aeo/page.tsx");

  it("parses the property filter from searchParams", () => {
    expect(src).toMatch(/parsePropertyFilter\(await searchParams, scope\.orgId\)/);
  });

  it("scopes citation checks and mention snapshots by property", () => {
    expect(findManyWhere(src, "aeoCitationCheck")).toContain("...propertyWhere");
    expect(findManyWhere(src, "aeoMentionSnapshot")).toContain("...propertyWhere");
    // Both aeoCitationCheck reads (rates + weekly trend) carry the fragment.
    const checks = src.split("prisma.aeoCitationCheck.findMany(").slice(1);
    expect(checks).toHaveLength(2);
    for (const c of checks) {
      expect(c.slice(0, c.indexOf("select:"))).toContain("...propertyWhere");
    }
  });

  it("limits the prompt-suggestion properties to the effective selection", () => {
    expect(src).toMatch(/effectiveIds \? \{ id: \{ in: effectiveIds \} \}/);
  });
});

describe("/portal/seo/agent falls back to the switcher selection", () => {
  const src = read("app/portal/seo/agent/page.tsx");
  it("reads the active property before defaulting to the first LIVE one", () => {
    const switcher = src.indexOf("p.id === switcherId");
    const firstLive = src.indexOf('p.launchStatus === "LIVE"');
    expect(switcher).toBeGreaterThan(-1);
    expect(switcher).toBeLessThan(firstLive);
  });
});

describe("deep links into SEO/AEO/reputation use the parsed ?property= key", () => {
  // /portal/reputation and /portal/seo/aeo read ?property= via
  // parsePropertyFilter; ?propertyId= was silently ignored and the page
  // fell back to whichever property the switcher cookie held.
  for (const file of [
    "lib/seo/agent.ts",
    "lib/intelligence/property-recommendations.ts",
  ]) {
    it(file, () => {
      expect(read(file)).not.toMatch(/\/portal\/(reputation|seo\/aeo)\?propertyId=/);
    });
  }
});
