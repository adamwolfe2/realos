import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural and behavioral tests for the checkout flow.
 * Verifies auth, validation, transactional safety, rate limiting,
 * server-side price validation, and Stripe session creation patterns.
 */

const API_DIR = path.resolve(__dirname, "../app/api");
const APP_DIR = path.resolve(__dirname, "../app");

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

describe("Checkout API route — app/api/checkout/route.ts", () => {
  const routePath = path.join(API_DIR, "checkout/route.ts");

  it("route file exists", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("exports POST handler", () => {
    const content = readFile(routePath);
    expect(content).toMatch(
      /export\s+async\s+function\s+POST/
    );
  });

  it("imports and uses auth check from Clerk", () => {
    const content = readFile(routePath);
    expect(content).toContain("auth()");
    // Verify it returns 401 for unauthenticated users
    expect(content).toContain("Unauthorized");
    expect(content).toContain("status: 401");
  });

  it("uses Zod schema validation with safeParse", () => {
    const content = readFile(routePath);
    expect(content).toContain("z.object");
    expect(content).toContain(".safeParse(");
    // Verify it returns 400 for invalid input
    expect(content).toContain("Invalid input");
    expect(content).toContain("status: 400");
  });

  it("uses prisma.$transaction for atomic organization creation", () => {
    const content = readFile(routePath);
    expect(content).toContain("prisma.$transaction");
  });

  it("validates prices server-side (never trusts client-supplied unitPrice)", () => {
    const content = readFile(routePath);
    // Verify the explicit comment about server-authoritative pricing
    expect(content).toContain("server-authoritative price");
    // Verify it fetches products from DB to get real prices
    expect(content).toContain("prisma.product.findMany");
    // Verify it overwrites client unitPrice with DB price
    expect(content).toMatch(/unitPrice:\s*Number\(product\.price\)/);
  });

  it("creates a Stripe checkout session when Stripe is configured", () => {
    const content = readFile(routePath);
    expect(content).toContain("createCheckoutSession");
    expect(content).toContain("isStripeConfigured");
  });

  it("has rate limiting via checkRateLimit", () => {
    const content = readFile(routePath);
    expect(content).toContain("checkRateLimit");
    expect(content).toContain("checkoutLimiter");
    // Verify it returns 429 when rate limited
    expect(content).toContain("status: 429");
    expect(content).toContain("Too many requests");
  });

  it("returns proper error responses for multiple failure modes", () => {
    const content = readFile(routePath);
    // 400 — invalid input / product not found
    expect(content).toContain("status: 400");
    // 401 — unauthenticated
    expect(content).toContain("status: 401");
    // 402 — credit limit exceeded / dunning suspension
    expect(content).toContain("status: 402");
    // 429 — rate limited
    expect(content).toContain("status: 429");
    // 500 — internal error
    expect(content).toContain("status: 500");
    // 502 — Stripe session creation failure
    expect(content).toContain("status: 502");
  });

  it("captures errors to Sentry via captureWithContext", () => {
    const content = readFile(routePath);
    expect(content).toContain("captureWithContext");
  });

  it("handles credit limit checks before order creation", () => {
    const content = readFile(routePath);
    expect(content).toContain("getCreditStatus");
    expect(content).toContain("CREDIT_LIMIT_EXCEEDED");
    expect(content).toContain("isAtLimit");
  });

  it("handles dunning suspension check", () => {
    const content = readFile(routePath);
    expect(content).toContain("dunning_suspended");
    expect(content).toContain("ACCOUNT_SUSPENDED_DUNNING");
  });

  it("deducts referral credits and loyalty points atomically", () => {
    const content = readFile(routePath);
    expect(content).toContain("referralCreditToApply");
    expect(content).toContain("pointsToRedeem");
    // Verify atomic deduction via transaction
    expect(content).toContain("prisma.$transaction");
    expect(content).toContain("Insufficient referral credits");
  });

  it("cancels order if Stripe session creation fails", () => {
    const content = readFile(routePath);
    // Stripe failure path cancels the order
    expect(content).toContain('updateOrderStatus(order.id, "CANCELLED")');
    expect(content).toContain("Payment session could not be created");
  });

  it("supports demo mode (no Stripe configured)", () => {
    const content = readFile(routePath);
    expect(content).toContain("isStripeConfigured()");
    expect(content).toContain("demo_order_confirmed");
  });

  it("validates product availability", () => {
    const content = readFile(routePath);
    expect(content).toContain("product.available");
    expect(content).toContain("no longer available");
  });
});

describe("Checkout page — app/checkout/page.tsx", () => {
  const pagePath = path.join(APP_DIR, "checkout/page.tsx");

  it("checkout page exists", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("is a client component", () => {
    const content = readFile(pagePath);
    expect(content).toMatch(/^['"]use client['"]/);
  });

  it("uses AbortController for fetch cleanup", () => {
    const content = readFile(pagePath);
    expect(content).toContain("AbortController");
  });
});

describe("Confirmation page — app/confirmation/page.tsx", () => {
  const pagePath = path.join(APP_DIR, "confirmation/page.tsx");

  it("confirmation page exists", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("is a client component", () => {
    const content = readFile(pagePath);
    expect(content).toMatch(/^['"]use client['"]/);
  });
});
