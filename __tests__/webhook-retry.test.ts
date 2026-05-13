import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural + schema tests for the webhook retry cron system.
 *
 * The retry system was rebuilt around the WebhookEvent model (older
 * iterations called it WebhookLog). The cron uses verifyCronAuth() for
 * auth, MAX_ATTEMPTS as the cap, and a BACKOFF_SECS lookup table for the
 * delay schedule (preferred over Math.pow because the curve is bespoke
 * — first retry is 1 minute, then minutes-tens-hours).
 */

const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/cron/webhook-retry/route.ts",
);
const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

describe("webhook retry cron route", () => {
  it("route file exists at app/api/cron/webhook-retry/route.ts", () => {
    expect(fs.existsSync(ROUTE_PATH)).toBe(true);
  });

  it("exports a GET handler", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    const hasGet =
      content.includes("export async function GET") ||
      content.includes("export function GET");
    expect(hasGet).toBe(true);
  });

  it("authenticates the cron request", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    // Either inline CRON_SECRET check or the shared helper.
    const hasAuth =
      content.includes("CRON_SECRET") || content.includes("verifyCronAuth");
    expect(hasAuth).toBe(true);
  });

  it("caps retry attempts via MAX_ATTEMPTS", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(content).toContain("MAX_ATTEMPTS");
  });

  it("uses a backoff schedule between retries", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    // Either a lookup table (BACKOFF_SECS) or exponential math.
    const hasBackoff =
      content.includes("BACKOFF_SECS") ||
      content.includes("Math.pow") ||
      /\d+\s*\*\*\s*nextAttempts/.test(content);
    expect(hasBackoff).toBe(true);
  });

  it("sets nextRetryAt forward when retrying, null when abandoning", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(content).toContain("nextRetryAt");
    expect(content).toContain("isFinal");
  });
});

describe("WebhookEvent schema has retry fields", () => {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  const modelMatch = schema.match(/model WebhookEvent\s*\{[\s\S]*?\n\}/);

  it("WebhookEvent model exists", () => {
    expect(modelMatch).not.toBeNull();
  });

  it("attempts field exists with default 0", () => {
    expect(modelMatch![0]).toMatch(/attempts\s+Int\s+@default\(0\)/);
  });

  it("nextRetryAt is an optional DateTime", () => {
    expect(modelMatch![0]).toMatch(/nextRetryAt\s+DateTime\?/);
  });

  it("has a composite index on (status, nextRetryAt) for the cron query", () => {
    expect(modelMatch![0]).toContain("status, nextRetryAt");
  });
});
