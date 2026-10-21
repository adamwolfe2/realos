// checkoutLimiter (10 / 10 min) was defined but never called by the checkout
// route — a missing control, not dead code (#185 review).
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { createMockPrisma } from "./helpers/mock-prisma";

const mockPrisma = createMockPrisma();
let calls = 0;
const fakeLimiter = {
  limit: vi.fn(async () => {
    calls += 1;
    return { success: calls <= 10, limit: 10, remaining: Math.max(0, 10 - calls), reset: Date.now() + 600_000 };
  }),
};

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/tenancy/scope", () => ({
  getScope: async () => ({ orgId: "org_1", userId: "u1", email: "o@x.com", role: UserRole.CLIENT_OWNER, isAgency: false, isImpersonating: false }),
}));
vi.mock("@/lib/stripe/config", () => ({ isStripeConfigured: () => true, getStripeClient: () => ({}) }));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@/lib/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/lib/rate-limit")>()),
  checkoutLimiter: fakeLimiter,
}));

const { POST } = await import("@/app/api/billing/checkout/route");

const req = () =>
  new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tierId: "starter", source: "trial_activation" }),
  });

describe("POST /api/billing/checkout rate limit", () => {
  it("returns 429 on the 11th attempt in the window, keyed per org", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await POST(req()).catch(() => null);
      statuses.push(res?.status ?? 0);
    }
    expect(statuses.slice(0, 10)).not.toContain(429);
    expect(statuses[10]).toBe(429);
    expect(fakeLimiter.limit).toHaveBeenCalledWith("checkout:org_1");
  });
});
