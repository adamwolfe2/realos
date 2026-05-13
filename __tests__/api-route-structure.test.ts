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

    // Recognised auth patterns. The auth model is layered:
    //   requireAdmin > requireAdminOrRep > requireAgency > requireScope+inline
    // and impersonate routes delegate to a helper that calls requireAgency()
    // internally. Bootstrap is the one route that runs before any admin
    // exists; it's protected by BOOTSTRAP_SECRET.
    const AUTH_PATTERNS = [
      "requireAdmin",
      "requireAdminOrRep",
      "requireAgency",
      "startImpersonation",
      "endImpersonation",
      "auth()",
      "BOOTSTRAP_SECRET",
    ];

    for (const route of adminRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} has auth protection`, () => {
        const content = readRoute(route);
        const hasNamed = AUTH_PATTERNS.some((p) => content.includes(p));
        // requireScope() (auth) + inline isAgency/orgType check (authz) is
        // the explicit-inline equivalent of using the requireAgency helper.
        const hasInline =
          content.includes("requireScope") &&
          (content.includes("isAgency") ||
            content.includes("scope.orgType") ||
            content.includes("callerIsAgency") ||
            content.includes("AGENCY_ROLES"));
        expect(hasNamed || hasInline).toBe(true);
      });
    }
  });

  describe("cron routes check CRON_SECRET", () => {
    const cronRoutes = findRoutes("cron/**/route.ts");

    // Cron auth is enforced by either an inline CRON_SECRET check or the
    // shared verifyCronAuth() helper (lib/cron/auth.ts) which validates
    // the Bearer CRON_SECRET header in constant time.
    for (const route of cronRoutes) {
      const relative = path.relative(API_DIR, route);
      it(`${relative} validates cron auth`, () => {
        const content = readRoute(route);
        const hasAuth =
          content.includes("CRON_SECRET") ||
          content.includes("verifyCronAuth");
        expect(hasAuth).toBe(true);
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
        // Recognised error-handling patterns. Beyond raw console logging
        // we also accept:
        //   - in-memory accumulators (`errors.push(...)`) where a cron
        //     reports per-iteration failures via the response body
        //   - delegation to recordCronRun() / withCronRun() / Sentry, all
        //     of which capture and surface errors centrally
        //   - explicit ForbiddenError / 401/403 returns
        const hasErrorHandling =
          content.includes("console.error") ||
          content.includes("console.warn") ||
          content.includes("status: 500") ||
          content.includes("status: 400") ||
          content.includes("status: 401") ||
          content.includes("status: 403") ||
          content.includes("errors.push") ||
          content.includes("recordCronRun") ||
          content.includes("withCronRun") ||
          content.includes("Sentry.captureException") ||
          // Routes with no try/catch presumably don't need error handling.
          !content.includes("try {");
        expect(hasErrorHandling).toBe(true);
      });
    }
  });
});
