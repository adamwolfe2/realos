import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Structural tests for all cron job routes and the standing orders processor.
 * Verifies CRON_SECRET auth, error handling, JSON responses, and
 * that the total count of cron-like routes matches expectations.
 */

const API_DIR = path.resolve(__dirname, "../app/api");

function readRoute(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

// All 10 cron routes
const CRON_ROUTES: { name: string; relativePath: string }[] = [
  { name: "abandoned-carts", relativePath: "cron/abandoned-carts/route.ts" },
  { name: "billing-reminders", relativePath: "cron/billing-reminders/route.ts" },
  { name: "intake-nurture", relativePath: "cron/intake-nurture/route.ts" },
  { name: "lapsed-clients", relativePath: "cron/lapsed-clients/route.ts" },
  { name: "low-stock-alerts", relativePath: "cron/low-stock-alerts/route.ts" },
  { name: "onboarding-drip", relativePath: "cron/onboarding-drip/route.ts" },
  { name: "partner-nurture", relativePath: "cron/partner-nurture/route.ts" },
  { name: "webhook-retry", relativePath: "cron/webhook-retry/route.ts" },
  { name: "weekly-digest", relativePath: "cron/weekly-digest/route.ts" },
  { name: "weekly-report", relativePath: "cron/weekly-report/route.ts" },
];

describe("Cron job routes", () => {
  describe("each cron route exists and exports GET", () => {
    for (const route of CRON_ROUTES) {
      const fullPath = path.join(API_DIR, route.relativePath);

      describe(`cron/${route.name}`, () => {
        it("file exists", () => {
          expect(fs.existsSync(fullPath)).toBe(true);
        });

        it("exports GET handler", () => {
          const content = readRoute(fullPath);
          expect(content).toMatch(
            /export\s+async\s+function\s+GET/
          );
        });

        it("validates CRON_SECRET", () => {
          const content = readRoute(fullPath);
          expect(content).toContain("CRON_SECRET");
        });

        it("returns 401 or 503 on auth failure", () => {
          const content = readRoute(fullPath);
          const has401 = content.includes("status: 401");
          const has503 = content.includes("status: 503");
          expect(has401 || has503).toBe(true);
        });

        it("has try/catch error handling", () => {
          const content = readRoute(fullPath);
          expect(content).toContain("try {");
          expect(content).toContain("catch");
        });

        it("returns JSON response", () => {
          const content = readRoute(fullPath);
          expect(content).toContain("NextResponse.json");
        });
      });
    }
  });

  describe("CRON_SECRET fail-secure pattern", () => {
    for (const route of CRON_ROUTES) {
      const fullPath = path.join(API_DIR, route.relativePath);

      it(`cron/${route.name} fails secure when CRON_SECRET is unset`, () => {
        const content = readRoute(fullPath);
        // Verify the fail-secure pattern: if !cronSecret, return error
        const hasFailSecure =
          content.includes("!cronSecret") || content.includes("!secret");
        expect(hasFailSecure).toBe(true);
      });
    }
  });

  describe("CRON_SECRET Bearer token pattern", () => {
    for (const route of CRON_ROUTES) {
      const fullPath = path.join(API_DIR, route.relativePath);

      it(`cron/${route.name} reads authorization header`, () => {
        const content = readRoute(fullPath);
        const readsAuth =
          content.includes('get("authorization")') ||
          content.includes("get('authorization')") ||
          content.includes('get("Authorization")') ||
          content.includes("get('Authorization')") ||
          content.includes("Authorization");
        expect(readsAuth).toBe(true);
      });
    }
  });
});

describe("Standing orders processor — app/api/standing-orders/process/route.ts", () => {
  const standingOrderPath = path.join(
    API_DIR,
    "standing-orders/process/route.ts"
  );

  it("file exists", () => {
    expect(fs.existsSync(standingOrderPath)).toBe(true);
  });

  it("exports GET handler", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toMatch(
      /export\s+async\s+function\s+GET/
    );
  });

  it("validates CRON_SECRET", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("CRON_SECRET");
  });

  it("returns 401 on invalid auth", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("status: 401");
  });

  it("returns 503 when CRON_SECRET is not configured", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("status: 503");
  });

  it("has try/catch error handling", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("try {");
    expect(content).toContain("catch");
  });

  it("returns JSON response with summary data", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("NextResponse.json");
    expect(content).toContain("processed");
    expect(content).toContain("created");
    expect(content).toContain("skipped");
  });

  it("uses optimistic locking to prevent duplicate processing", () => {
    const content = readRoute(standingOrderPath);
    // Atomically claims the standing order by advancing nextRunDate
    expect(content).toContain("standingOrder.updateMany");
    expect(content).toContain("claimed.count === 0");
  });

  it("filters out unavailable products", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("available");
    expect(content).toContain("currently unavailable");
  });

  it("captures errors to Sentry", () => {
    const content = readRoute(standingOrderPath);
    expect(content).toContain("captureWithContext");
  });
});

describe("Total cron-like route count", () => {
  it("has exactly 11 cron-like routes (10 cron + standing-orders)", () => {
    const cronRoutes = glob.sync("cron/**/route.ts", { cwd: API_DIR });
    const standingOrderRoute = fs.existsSync(
      path.join(API_DIR, "standing-orders/process/route.ts")
    )
      ? 1
      : 0;

    const total = cronRoutes.length + standingOrderRoute;
    expect(total).toBe(11);
  });

  it("all 10 cron routes are accounted for", () => {
    const cronRoutes = glob.sync("cron/**/route.ts", { cwd: API_DIR });
    expect(cronRoutes.length).toBe(10);
  });
});

describe("Cron route response summaries", () => {
  it("abandoned-carts returns processed/sent/skipped counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/abandoned-carts/route.ts")
    );
    expect(content).toContain("processed");
    expect(content).toContain("sent");
    expect(content).toContain("skipped");
  });

  it("billing-reminders returns processed/promoted/sent counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/billing-reminders/route.ts")
    );
    expect(content).toContain("processed");
    expect(content).toContain("promoted");
    expect(content).toContain("sent");
  });

  it("intake-nurture returns d3Sent/d7Sent/skipped counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/intake-nurture/route.ts")
    );
    expect(content).toContain("d3Sent");
    expect(content).toContain("d7Sent");
    expect(content).toContain("skipped");
  });

  it("lapsed-clients returns checked/emailed/skipped counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/lapsed-clients/route.ts")
    );
    expect(content).toContain("checked");
    expect(content).toContain("emailed");
    expect(content).toContain("skipped");
  });

  it("low-stock-alerts returns alerts count", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/low-stock-alerts/route.ts")
    );
    expect(content).toContain("alerts");
  });

  it("onboarding-drip returns day1Sent/day3Sent/day7Sent counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/onboarding-drip/route.ts")
    );
    expect(content).toContain("day1Sent");
    expect(content).toContain("day3Sent");
    expect(content).toContain("day7Sent");
  });

  it("partner-nurture returns day3Sent/day7Sent/skipped counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/partner-nurture/route.ts")
    );
    expect(content).toContain("day3Sent");
    expect(content).toContain("day7Sent");
    expect(content).toContain("skipped");
  });

  it("webhook-retry returns processed/succeeded/failed counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/webhook-retry/route.ts")
    );
    expect(content).toContain("processed");
    expect(content).toContain("succeeded");
    expect(content).toContain("failed");
  });

  it("weekly-digest returns checked/sent/skipped counts", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/weekly-digest/route.ts")
    );
    expect(content).toContain("checked");
    expect(content).toContain("sent");
    expect(content).toContain("skipped");
  });

  it("weekly-report returns stats object with revenue/orders/clients", () => {
    const content = readRoute(
      path.join(API_DIR, "cron/weekly-report/route.ts")
    );
    expect(content).toContain("revenueThisWeek");
    expect(content).toContain("ordersThisWeek");
    expect(content).toContain("newClientsCount");
  });
});
