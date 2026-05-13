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

// Public POST endpoints that MUST have rate limiting. The original
// e-commerce-fork list (intake, notify-me, drops/*, claim, scrape) was
// pruned when the product pivoted to LeaseStack — those routes don't
// exist in the codebase. As we add new public mutation endpoints we add
// them here so the structural test catches missing rate limits at PR
// time rather than in production logs.
const PUBLIC_MUTATION_ROUTES: string[] = [
  "subscribe/route.ts",
  "onboarding/route.ts",
  "enrich/route.ts",
];

describe("Rate limit coverage on public endpoints", () => {
  for (const route of PUBLIC_MUTATION_ROUTES) {
    it(`/api/${route.replace("/route.ts", "")} has rate limiting`, () => {
      const fullPath = path.join(API_DIR, route);
      // Soft-skip — the route may have been removed since the entry was
      // added. Re-add the rate-limit check the moment the route exists
      // again.
      if (!fs.existsSync(fullPath)) return;
      const content = readRoute(fullPath);

      const hasRateLimit =
        content.includes("checkRateLimit") ||
        content.includes("isRateLimited") ||
        content.includes("rateLimiter") ||
        content.includes("Ratelimit");

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
