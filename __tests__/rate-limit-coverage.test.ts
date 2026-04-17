import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Verifies that public-facing mutation endpoints have rate limiting.
 * Checks that routes without auth that accept POST have rate limit checks.
 */

const API_DIR = path.resolve(__dirname, "../app/api");

function readRoute(routePath: string): string {
  return fs.readFileSync(routePath, "utf-8");
}

// Public POST endpoints that MUST have rate limiting
const PUBLIC_MUTATION_ROUTES = [
  "intake/route.ts",
  "subscribe/route.ts",
  "onboarding/route.ts",
  "notify-me/route.ts",
  "drops/alert-signup/route.ts",
  "claim/route.ts",
  "scrape/route.ts",
  "enrich/route.ts",
];

describe("Rate limit coverage on public endpoints", () => {
  for (const route of PUBLIC_MUTATION_ROUTES) {
    it(`/api/${route.replace("/route.ts", "")} has rate limiting`, () => {
      const fullPath = path.join(API_DIR, route);
      expect(fs.existsSync(fullPath)).toBe(true);
      const content = readRoute(fullPath);

      const hasRateLimit =
        content.includes("checkRateLimit") ||
        content.includes("isRateLimited") ||
        content.includes("rateLimiter");

      expect(hasRateLimit).toBe(true);
    });
  }
});

// Webhook endpoints that should have signature verification instead of rate limits
const WEBHOOK_ROUTES = [
  "webhooks/stripe/route.ts",
  "webhooks/clerk/route.ts",
  "webhooks/blooio/route.ts",
  "intake/[id]/cal-booked/route.ts",
];

describe("Webhook endpoints have signature verification", () => {
  for (const route of WEBHOOK_ROUTES) {
    it(`/api/${route.replace("/route.ts", "")} verifies signatures`, () => {
      const fullPath = path.join(API_DIR, route);
      if (!fs.existsSync(fullPath)) return; // webhook may not exist in all deployments
      const content = readRoute(fullPath);

      const hasSignatureCheck =
        content.includes("signature") ||
        content.includes("Signature") ||
        content.includes("verify") ||
        content.includes("Verify") ||
        content.includes("svix") ||
        content.includes("constructEvent");

      expect(hasSignatureCheck).toBe(true);
    });
  }
});
