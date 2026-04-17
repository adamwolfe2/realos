import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural and schema tests for the webhook retry cron system.
 * Verifies the route exists, exports a GET handler, and that the
 * Prisma schema includes the retry-related fields on WebhookLog.
 */

const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/cron/webhook-retry/route.ts"
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

  it("checks CRON_SECRET for authorization", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(content).toContain("CRON_SECRET");
  });

  it("references MAX_RETRIES to cap retry attempts", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(content).toContain("MAX_RETRIES");
  });

  it("uses exponential backoff for retry scheduling", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    // Math.pow(2, ...) is the exponential backoff pattern
    expect(content).toContain("Math.pow");
  });

  it("handles inactive endpoints by clearing nextRetryAt", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    expect(content).toContain("isActive");
    expect(content).toContain("nextRetryAt: null");
  });
});

describe("WebhookLog schema has retry fields", () => {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");

  it("retryCount field exists on WebhookLog model", () => {
    // Find the WebhookLog model block and check for retryCount
    const modelMatch = schema.match(
      /model WebhookLog\s*\{[\s\S]*?\n\}/
    );
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toContain("retryCount");
  });

  it("nextRetryAt field exists on WebhookLog model", () => {
    const modelMatch = schema.match(
      /model WebhookLog\s*\{[\s\S]*?\n\}/
    );
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toContain("nextRetryAt");
  });

  it("retryCount defaults to 0", () => {
    const modelMatch = schema.match(
      /model WebhookLog\s*\{[\s\S]*?\n\}/
    );
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toMatch(/retryCount\s+Int\s+@default\(0\)/);
  });

  it("nextRetryAt is an optional DateTime", () => {
    const modelMatch = schema.match(
      /model WebhookLog\s*\{[\s\S]*?\n\}/
    );
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toMatch(/nextRetryAt\s+DateTime\?/);
  });

  it("has a composite index on retry fields for cron queries", () => {
    const modelMatch = schema.match(
      /model WebhookLog\s*\{[\s\S]*?\n\}/
    );
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toContain("success, nextRetryAt, retryCount");
  });
});
