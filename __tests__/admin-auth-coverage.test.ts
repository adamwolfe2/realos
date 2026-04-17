import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural test: every admin API route (excluding bootstrap) must import
 * requireAdmin or requireAdminOrRep from @/lib/auth.
 *
 * This catches routes that accidentally skip auth guards.
 */

const ADMIN_DIR = path.resolve(__dirname, "../app/api/admin");

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.name === "route.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

const EXCLUDED = ["bootstrap"];

describe("Admin route auth coverage", () => {
  const routeFiles = findRouteFiles(ADMIN_DIR);

  // Sanity check: we should have a meaningful number of admin routes
  it("discovers admin route files", () => {
    expect(routeFiles.length).toBeGreaterThan(10);
  });

  for (const routePath of routeFiles) {
    const relative = path.relative(ADMIN_DIR, routePath);

    // Skip excluded routes (e.g. bootstrap is the initial setup endpoint)
    const isExcluded = EXCLUDED.some((exc) => relative.includes(exc));
    if (isExcluded) continue;

    it(`/api/admin/${relative.replace("/route.ts", "")} imports requireAdmin or requireAdminOrRep`, () => {
      const content = fs.readFileSync(routePath, "utf-8");

      const hasAuthGuard =
        content.includes("requireAdmin") ||
        content.includes("requireAdminOrRep");

      expect(
        hasAuthGuard,
        `Missing auth guard in ${relative}. Every admin route must import requireAdmin or requireAdminOrRep from @/lib/auth.`
      ).toBe(true);
    });
  }
});
