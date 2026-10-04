import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// F-082: every Stripe customer-creation path passes an idempotency key so
// concurrent requests converge on one customer. website-build and checkout
// share `cust_${org.id}` via ensureOrgStripeCustomer, whose params come from
// org data only so different callers can never send different params.

const customersCreate = vi.fn();
const prisma = {
  organization: { findUnique: vi.fn(), update: vi.fn() },
  marketplaceLead: { findUnique: vi.fn() },
  marketplacePurchase: { findFirst: vi.fn() },
  marketplaceBuyer: { update: vi.fn() },
};
const getScope = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return prisma;
  },
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({ customers: { create: customersCreate } }),
}));
vi.mock("@/lib/tenancy/scope", () => ({ getScope: () => getScope() }));
vi.mock("@/lib/marketplace/auth", () => ({
  getBuyerSession: vi.fn().mockResolvedValue({
    id: "buyer_1",
    email: "b@x.co",
    fullName: "B",
    stripeCustomerId: null,
  }),
}));

import {
  ensureOrgStripeCustomer,
  orgCustomerCreateParams,
} from "@/lib/billing/org-stripe-customer";

// Stop each route right after customer creation; only the call matters.
const STOP = new Error("stop after customers.create");
const unlinkedOrg = {
  id: "org_1",
  name: "Org",
  primaryContactEmail: null,
  stripeCustomerId: null,
};
const stripe = { customers: { create: customersCreate } } as unknown as Stripe;

function idempotencyError() {
  return new Stripe.errors.StripeIdempotencyError({
    type: "idempotency_error",
    message: "Keys for idempotent requests can only be used with the same parameters",
  });
}

describe("Stripe customer creation idempotency", () => {
  beforeEach(() => {
    customersCreate.mockReset();
    customersCreate.mockRejectedValue(STOP);
    prisma.organization.findUnique.mockReset();
    prisma.organization.update.mockReset();
  });

  it("website-build sends identical org-only params for two different callers (null contact email)", async () => {
    prisma.organization.findUnique.mockResolvedValue(unlinkedOrg);
    const { POST } = await import("@/app/api/billing/website-build/route");
    for (const email of ["owner@x.co", "staff@leasestack.co"]) {
      getScope.mockResolvedValue({ orgId: "org_1", email });
      await expect(
        POST(
          new NextRequest("http://localhost/api/billing/website-build", {
            method: "POST",
            body: JSON.stringify({ buildId: "standard" }),
          }),
        ),
      ).rejects.toBe(STOP);
    }
    expect(customersCreate).toHaveBeenCalledTimes(2);
    const [first, second] = customersCreate.mock.calls;
    expect(first).toEqual(second);
    expect(first).toEqual([orgCustomerCreateParams(unlinkedOrg), { idempotencyKey: "cust_org_1" }]);
    expect(first[0].email).toBeUndefined();
  });

  it("on idempotency_error, uses the customer another request already linked", async () => {
    customersCreate.mockRejectedValue(idempotencyError());
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: "cus_winner" });
    await expect(ensureOrgStripeCustomer(stripe, unlinkedOrg)).resolves.toBe("cus_winner");
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it("on idempotency_error with no linked customer, rethrows", async () => {
    const err = idempotencyError();
    customersCreate.mockRejectedValue(err);
    prisma.organization.findUnique.mockResolvedValue({ stripeCustomerId: null });
    await expect(ensureOrgStripeCustomer(stripe, unlinkedOrg)).rejects.toBe(err);
  });

  it("rethrows non-idempotency Stripe errors without re-reading the org", async () => {
    await expect(ensureOrgStripeCustomer(stripe, unlinkedOrg)).rejects.toBe(STOP);
    expect(prisma.organization.findUnique).not.toHaveBeenCalled();
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
