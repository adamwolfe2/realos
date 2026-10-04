import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// F-082: every Stripe customer-creation path passes an idempotency key so
// concurrent requests converge on one customer. website-build must use the
// same `cust_${org.id}` key as /api/billing/checkout.

const customersCreate = vi.fn();
const prisma = {
  organization: { findUnique: vi.fn(), update: vi.fn() },
  marketplaceLead: { findUnique: vi.fn() },
  marketplacePurchase: { findFirst: vi.fn() },
  marketplaceBuyer: { update: vi.fn() },
};

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({ customers: { create: customersCreate } }),
}));
vi.mock("@/lib/tenancy/scope", () => ({
  getScope: vi.fn().mockResolvedValue({ orgId: "org_1", email: "u@x.co" }),
}));
vi.mock("@/lib/marketplace/auth", () => ({
  getBuyerSession: vi.fn().mockResolvedValue({
    id: "buyer_1",
    email: "b@x.co",
    fullName: "B",
    stripeCustomerId: null,
  }),
}));

// Stop each route right after customer creation; only the call matters.
const STOP = new Error("stop after customers.create");

describe("Stripe customer creation idempotency", () => {
  beforeEach(() => {
    customersCreate.mockReset();
    customersCreate.mockRejectedValue(STOP);
  });

  it("website-build uses the checkout route's cust_${org.id} key", async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      name: "Org",
      primaryContactEmail: "o@x.co",
      stripeCustomerId: null,
    });
    const { POST } = await import("@/app/api/billing/website-build/route");
    await expect(
      POST(
        new NextRequest("http://localhost/api/billing/website-build", {
          method: "POST",
          body: JSON.stringify({ buildId: "standard" }),
        }),
      ),
    ).rejects.toBe(STOP);
    expect(customersCreate).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "cust_org_1",
    });
  });

  it("marketplace lead checkout uses mpbuyer_cust_${buyer.id}", async () => {
    prisma.marketplaceLead.findUnique.mockResolvedValue({ id: "lead_1", status: "AVAILABLE" });
    prisma.marketplacePurchase.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/marketplace/leads/[id]/checkout/route");
    await expect(
      POST(new NextRequest("http://localhost/x", { method: "POST" }), {
        params: Promise.resolve({ id: "lead_1" }),
      }),
    ).rejects.toBe(STOP);
    expect(customersCreate).toHaveBeenCalledWith(expect.any(Object), {
      idempotencyKey: "mpbuyer_cust_buyer_1",
    });
  });
});
