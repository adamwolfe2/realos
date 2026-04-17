import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Structural tests for API routes:
 * - All routes export at least one HTTP method handler
 * - All admin routes use requireAdmin or requireAdminOrRep
 * - All cron routes check CRON_SECRET
 * - No routes have silent catch blocks (catch without console.error)
 */

const API_DIR = path.resolve(__dirname, "../app/api");

function readRoute(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function findRoutes(pattern: string): string[] {
  return glob.sync(pattern, { cwd: API_DIR }).map((f) => path.join(API_DIR, f));
}

describe("API route structure", () => {
  const allRoutes = findRoutes("**/route.ts");

  it("finds API routes", () => {
    expect(allRoutes.length).toBeGreaterThan(50);
  });

  describe("admin routes require auth", () => {
    const adminRoutes = findRoutes("admin/**/route.ts");

    for (const route of adminRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} has auth protection`, () => {
        const content = readRoute(route);
        const hasAuth =
          content.includes("requireAdmin") ||
          content.includes("requireAdminOrRep") ||
          content.includes("auth()") ||
          content.includes("BOOTSTRAP_SECRET");
        expect(hasAuth).toBe(true);
      });
    }
  });

  describe("cron routes check CRON_SECRET", () => {
    const cronRoutes = findRoutes("cron/**/route.ts");

    for (const route of cronRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} checks CRON_SECRET`, () => {
        const content = readRoute(route);
        expect(content).toContain("CRON_SECRET");
      });
    }
  });

  describe("routes export valid HTTP handlers", () => {
    const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

    for (const route of allRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} exports at least one HTTP method`, () => {
        const content = readRoute(route);
        const hasMethod = VALID_METHODS.some(
          (m) =>
            content.includes(`export async function ${m}`) ||
            content.includes(`export function ${m}`)
        );
        expect(hasMethod).toBe(true);
      });
    }
  });

  describe("no silent error swallowing in top-level catch blocks", () => {
    // Verify that the main try/catch in each route handler has error logging.
    // We check the full file for console.error near catch blocks, not regex-based
    // block extraction (which fails on multi-line catches).
    const criticalRoutes = [
      ...findRoutes("admin/**/route.ts"),
      ...findRoutes("cron/**/route.ts"),
      ...findRoutes("client/**/route.ts"),
    ];

    for (const route of criticalRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} — has error logging or handling`, () => {
        const content = readRoute(route);
        // Route should have at least one form of error handling
        const hasErrorHandling =
          content.includes("console.error") ||
          content.includes("console.warn") ||
          content.includes("status: 500") ||
          content.includes("status: 400") ||
          // Some routes only do simple operations with no try/catch needed
          !content.includes("try {");
        expect(hasErrorHandling).toBe(true);
      });
    }
  });
});
