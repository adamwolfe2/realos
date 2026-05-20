import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Soft-fallback in-memory limiter — used by low-stakes operator tools
 * (Zillow report, exports) so a Vercel deploy missing Upstash env vars
 * degrades to single-instance rate limiting instead of 100% blocking.
 *
 * Critical endpoints (no softFallback option) continue to fail closed
 * in production. That contract is covered in rate-limit-coverage.test.ts.
 */

describe("checkRateLimit soft fallback", () => {
  beforeEach(() => {
    // Each test uses a unique identifier so the in-memory bucket
    // (Map keyed by identifier) doesn't leak between tests.
  });

  it("allows requests within the in-memory cap when limiter is null", async () => {
    const id = `test:within-cap:${Date.now()}:${Math.random()}`;
    const result = await checkRateLimit(null, id, {
      softFallback: { requests: 3, windowMs: 60_000 },
    });
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(3);
    expect(result.remaining).toBe(2);
  });

  it("blocks the (N+1)th request inside the window", async () => {
    const id = `test:over-cap:${Date.now()}:${Math.random()}`;
    const opts = { softFallback: { requests: 2, windowMs: 60_000 } };
    const r1 = await checkRateLimit(null, id, opts);
    const r2 = await checkRateLimit(null, id, opts);
    const r3 = await checkRateLimit(null, id, opts);
    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
    expect(r3.reset).toBeGreaterThan(Date.now());
  });

  it("scopes buckets per identifier", async () => {
    const idA = `test:scope-a:${Date.now()}:${Math.random()}`;
    const idB = `test:scope-b:${Date.now()}:${Math.random()}`;
    const opts = { softFallback: { requests: 1, windowMs: 60_000 } };
    expect((await checkRateLimit(null, idA, opts)).allowed).toBe(true);
    expect((await checkRateLimit(null, idA, opts)).allowed).toBe(false);
    // Different identifier — own bucket, allowed.
    expect((await checkRateLimit(null, idB, opts)).allowed).toBe(true);
  });

  it("recovers after the window elapses", async () => {
    const id = `test:window:${Date.now()}:${Math.random()}`;
    const opts = { softFallback: { requests: 1, windowMs: 1 } };
    const r1 = await checkRateLimit(null, id, opts);
    expect(r1.allowed).toBe(true);
    // Window is 1ms — wait so the prior hit ages out.
    await new Promise((r) => setTimeout(r, 5));
    const r2 = await checkRateLimit(null, id, opts);
    expect(r2.allowed).toBe(true);
  });

  it("fails open in dev when softFallback is NOT passed (current node env)", async () => {
    // NODE_ENV is read-only in vitest; this verifies the dev branch.
    // The prod-fail-closed branch is covered by inspection of checkRateLimit
    // (rate-limit.ts:166-178) plus rate-limit-coverage.test.ts which asserts
    // critical routes call checkRateLimit without softFallback.
    const result = await checkRateLimit(null, `test:critical:${Date.now()}`);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(0);
  });
});
