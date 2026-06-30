import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P5 — webhook/cron hardening. Structural guards (route handlers are hard to
// unit-test without a full Next/Prisma harness; the existing suite uses this
// readFileSync pattern for route assertions).

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

describe("signals-daily cron uses constant-time auth", () => {
  const src = read("app/api/cron/signals-daily/route.ts");
  it("uses the shared verifyCronAuth helper", () => {
    expect(src).toContain('verifyCronAuth');
    expect(src).toMatch(/const authError = verifyCronAuth\(req\)/);
  });
  it("no longer does a raw Bearer string compare", () => {
    expect(src).not.toMatch(/authorization"\)\s*!==\s*`Bearer/);
  });
});

describe("marketplace stripe webhook has DoS guards", () => {
  const src = read("app/api/webhooks/stripe/marketplace/route.ts");
  it("rate-limits per IP before HMAC work", () => {
    expect(src).toMatch(/checkRateLimit\(webhookLimiter/);
    expect(src).toContain("rateLimited(");
  });
  it("caps the body size before parsing", () => {
    expect(src).toMatch(/Buffer\.byteLength\(rawBody[^)]*\)\s*>\s*3 \* 1024 \* 1024/);
    expect(src).toContain("Body too large");
  });
  it("still verifies the Stripe signature", () => {
    expect(src).toContain("parseWebhookEvent");
  });
});
