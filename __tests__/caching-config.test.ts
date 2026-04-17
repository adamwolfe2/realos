import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Verifies that dashboard routes use unstable_cache for expensive queries.
 */

const CACHED_ROUTES = [
  {
    path: "app/api/admin/analytics/route.ts",
    tag: "analytics",
    ttl: "300",
  },
  {
    path: "app/api/admin/clients/health-scores/route.ts",
    tag: "health-scores",
    ttl: "3600",
  },
  {
    path: "app/api/admin/ceo/cohorts/route.ts",
    tag: "cohorts",
    ttl: "86400",
  },
  {
    path: "app/api/admin/ceo/product-trends/route.ts",
    tag: "product-trends",
    ttl: "21600",
  },
];

describe("Dashboard query caching", () => {
  for (const route of CACHED_ROUTES) {
    describe(route.path, () => {
      const content = fs.readFileSync(
        path.resolve(__dirname, "..", route.path),
        "utf-8"
      );

      it("imports unstable_cache", () => {
        expect(content).toContain("unstable_cache");
      });

      it(`has cache tag "${route.tag}"`, () => {
        // Handle both single and double quotes in source
        const hasTag =
          content.includes(`"${route.tag}"`) ||
          content.includes(`'${route.tag}'`);
        expect(hasTag).toBe(true);
      });

      it(`has revalidate: ${route.ttl}`, () => {
        expect(content).toContain(`revalidate: ${route.ttl}`);
      });
    });
  }
});

describe("AI cost optimization", () => {
  it("Chat route uses prompt caching (cache_control)", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../app/api/admin/chat/route.ts"),
      "utf-8"
    );
    expect(content).toContain("cache_control");
    expect(content).toContain("ephemeral");
  });

  it("Chat route maxTokens is 2048 (not 4096)", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../app/api/admin/chat/route.ts"),
      "utf-8"
    );
    expect(content).toContain("max_tokens: 2048");
    expect(content).not.toContain("max_tokens: 4096");
  });

  it("Config gen routes use maxTokens 2048", () => {
    const genConfig = fs.readFileSync(
      path.resolve(
        __dirname,
        "../app/api/admin/intakes/[id]/generate-config/route.ts"
      ),
      "utf-8"
    );
    const generateConfig = fs.readFileSync(
      path.resolve(
        __dirname,
        "../lib/build/generate-config.ts"
      ),
      "utf-8"
    );
    expect(genConfig).toContain("max_tokens: 2048");
    expect(generateConfig).toContain("max_tokens: 2048");
  });

  it("Suggest reply uses gemini-2.0-flash", () => {
    const content = fs.readFileSync(
      path.resolve(
        __dirname,
        "../app/api/admin/messages/[id]/suggest-reply/route.ts"
      ),
      "utf-8"
    );
    expect(content).toContain("gemini-2.0-flash");
    expect(content).not.toContain("gemini-1.5-flash");
  });
});
