import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Regression test for ADMIN-OPS-D001 (caller wiring).
//
// __tests__/appfolio-sync-manual-force.test.ts proves the CRON side honors
// `?force=true`. That fix is inert unless the manual trigger actually sends
// it: the admin "Run sync now" button POSTs to
// /api/admin/data-sinks/[provider]/run, which fires the cron URL server-side.
// It originally built that URL with no query string, so the force bypass was
// unreachable and an operator clicking the button inside the cadence window
// still got a silent no-op reported as success.
//
// This is a structural test on purpose: the route's only observable behavior
// here is the URL it fetches, and exercising it for real would mean standing
// up Clerk auth, CRON_SECRET, and an HTTP listener to assert one query param.
// ponytail: source-level assertion, upgrade to an fetch-mock integration test
// if this route grows more logic worth exercising.
// ---------------------------------------------------------------------------

const REPO_ROOT = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("admin manual sync -> cron force wiring", () => {
  const runRoute = read("app/api/admin/data-sinks/[provider]/run/route.ts");

  it("builds the cron kickoff URL with force=true", () => {
    const target = runRoute.match(/const target = `([^`]+)`/);
    expect(target, "expected a `const target = \\`...\\`` cron URL").not.toBeNull();
    expect(target![1]).toContain("/api/cron/");
    expect(target![1]).toContain("force=true");
  });

  it("still fetches exactly that target, so the param cannot be dropped downstream", () => {
    expect(runRoute).toMatch(/fetch\(\s*target\s*,/);
  });

  it("appfolio-sync reads the force param and uses it to bypass the cadence skip", () => {
    const cron = read("app/api/cron/appfolio-sync/route.ts");
    expect(cron).toMatch(/searchParams\.get\(\s*["']force["']\s*\)\s*===\s*["']true["']/);
    // The cadence skip must be conditioned on !force, otherwise reading the
    // param is decorative and the manual trigger still no-ops.
    expect(cron).toMatch(/!force\s*&&/);
  });
});
