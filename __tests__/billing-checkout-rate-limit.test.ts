// checkoutLimiter (10 / 10 min) was defined but never called by the checkout
// route — a missing control, not dead code (#185 review).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { createMockPrisma } from "./helpers/mock-prisma";

const mockPrisma = createMockPrisma();
// Per-key buckets, like the real sliding window.
const calls = new Map<string, number>();
const fakeLimiter = {
  limit: vi.fn(async (key: string) => {
    const n = (calls.get(key) ?? 0) + 1;
    calls.set(key, n);
    return { success: n <= 10, limit: 10, remaining: Math.max(0, 10 - n), reset: Date.now() + 600_000 };
  }),
};
let orgId = "org_1";

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/tenancy/scope", () => ({
  getScope: async () => ({ orgId, userId: "u1", email: "o@x.com", role: UserRole.CLIENT_OWNER, isAgency: false, isImpersonating: false }),
}));
vi.mock("@/lib/stripe/config", () => ({ isStripeConfigured: () => true, getStripeClient: () => ({}) }));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
const limiterRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-limit")>()),
  get checkoutLimiter() {
    return limiterRef.current;
  },
}));

const { POST } = await import("@/app/api/billing/checkout/route");

const req = () =>
  new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tierId: "starter", source: "trial_activation" }),
  });

describe("POST /api/billing/checkout rate limit", () => {
  beforeEach(() => {
    calls.clear();
    orgId = "org_1";
    limiterRef.current = fakeLimiter;
    vi.unstubAllEnvs();
  });

  it("returns 429 on the 11th attempt in the window, and errors propagate", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // No .catch: a route that throws must fail this test.
      statuses.push((await POST(req())).status);
    }
    for (const s of statuses.slice(0, 10)) {
      expect(s).not.toBe(429);
      expect(s).toBeLessThan(500);
    }
    expect(statuses[10]).toBe(429);
    expect(fakeLimiter.limit).toHaveBeenCalledWith("checkout:org_1");
  });

  it("keys per org: a second org gets a fresh bucket", async () => {
    for (let i = 0; i < 10; i++) await POST(req());
    orgId = "org_2";
    expect((await POST(req())).status).not.toBe(429);
    expect(fakeLimiter.limit).toHaveBeenLastCalledWith("checkout:org_2");
  });

  it("answers 503, not 429, when the limiter is unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    limiterRef.current = null;
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect((await res.json()).error).not.toMatch(/too many/i);
  });
});
