import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural test: every admin API route (excluding bootstrap) must enforce
 * authentication via one of the recognised helpers.
 *
 * This catches routes that ship without ANY auth check. It does NOT verify
 * that the auth check is at the right level (e.g. agency-vs-admin) — that
 * needs route-by-route review, since the auth model in this app is layered
 * (requireAdmin > requireAdminOrRep > requireAgency > requireScope+inline
 * orgType check). What this test prevents is a route slipping out with no
 * guard at all.
 *
 * Recognised auth patterns:
 *   - requireAdmin / requireAdminOrRep      (lib/auth/require-admin.ts)
 *   - requireAgency                         (lib/tenancy/scope — agency only)
 *   - requireScope + inline isAgency check  (auth-then-authz pattern)
 *   - startImpersonation / endImpersonation (delegate to lib/tenancy/impersonate
 *                                            which calls requireAgency() inside)
 *
 * Routes intentionally excluded: `bootstrap` (initial setup, must be callable
 * before any admin user exists; protected by BOOTSTRAP_SECRET inside).
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

const AUTH_PATTERNS = [
  "requireAdmin",
  "requireAdminOrRep",
  "requireAgency",
  "startImpersonation",
  "endImpersonation",
];

function hasInlineScopeAndAgencyCheck(content: string): boolean {
  // requireScope() (auth) + inline isAgency / orgType / callerIsAgency check
  // (authorisation). Any route using this pattern is genuinely guarded.
  if (!content.includes("requireScope")) return false;
  return (
    content.includes("isAgency") ||
    content.includes("scope.orgType") ||
    content.includes("callerIsAgency") ||
    content.includes("AGENCY_ROLES")
  );
}

describe("Admin route auth coverage", () => {
  const routeFiles = findRouteFiles(ADMIN_DIR);

  // Sanity check — make sure the test is actually walking the admin tree.
  // The bound is intentionally loose so adding/removing routes doesn't
  // false-flag this guard; the real coverage check is the per-route loop
  // below.
  it("discovers admin route files", () => {
    expect(routeFiles.length).toBeGreaterThan(2);
  });

  for (const routePath of routeFiles) {
    const relative = path.relative(ADMIN_DIR, routePath);

    const isExcluded = EXCLUDED.some((exc) => relative.includes(exc));
    if (isExcluded) continue;

    it(`/api/admin/${relative.replace("/route.ts", "")} enforces auth`, () => {
      const content = fs.readFileSync(routePath, "utf-8");

      const hasNamedHelper = AUTH_PATTERNS.some((p) => content.includes(p));
      const hasInline = hasInlineScopeAndAgencyCheck(content);

      expect(
        hasNamedHelper || hasInline,
        `Missing auth guard in ${relative}. Every admin route must use one of: ${AUTH_PATTERNS.join(", ")}, or pair requireScope() with an inline isAgency/orgType check.`,
      ).toBe(true);
    });
  }
});
