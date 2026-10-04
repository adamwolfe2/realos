import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";

// M2 (F-082 follow-up): retrieving a PENDING purchase's old Checkout session
// must not swallow errors. resource_missing = "no session" (quiet); anything
// else is reported. Both fall through to creating a new session.

const captureWithContext = vi.fn();
const retrieve = vi.fn();
const customersCreate = vi.fn();
const prisma = {
  marketplaceLead: { findUnique: vi.fn() },
  marketplacePurchase: { findFirst: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  get prisma() {
    return prisma;
  },
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext }));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { retrieve } },
  }),
}));
vi.mock("@/lib/marketplace/auth", () => ({
  getBuyerSession: vi.fn().mockResolvedValue({
    id: "buyer_1",
    email: "b@x.co",
    fullName: "B",
    stripeCustomerId: null,
  }),
}));

const STOP = new Error("stop after fall-through");

async function post() {
  const { POST } = await import("@/app/api/marketplace/leads/[id]/checkout/route");
  return POST(new NextRequest("http://localhost/x", { method: "POST" }), {
    params: Promise.resolve({ id: "lead_1" }),
  });
}

describe("marketplace checkout: pending session retrieve failure", () => {
  beforeEach(() => {
    captureWithContext.mockClear();
    customersCreate.mockReset();
    customersCreate.mockRejectedValue(STOP);
    prisma.marketplaceLead.findUnique.mockResolvedValue({ id: "lead_1", status: "AVAILABLE" });
    prisma.marketplacePurchase.findFirst.mockImplementation(async (args: { where: { status: string } }) =>
      args.where.status === "PENDING" ? { id: "pur_1", stripeCheckoutSessionId: "cs_old" } : null,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("treats resource_missing as no session: no alert, falls through", async () => {
    retrieve.mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        type: "invalid_request_error",
        code: "resource_missing",
        message: "No such checkout.session",
      }),
    );
    await expect(post()).rejects.toBe(STOP);
    expect(captureWithContext).not.toHaveBeenCalled();
  });

  it("reports any other error, then falls through", async () => {
    const outage = new Error("Stripe unavailable");
    retrieve.mockRejectedValue(outage);
    await expect(post()).rejects.toBe(STOP);
    expect(captureWithContext).toHaveBeenCalledWith(
      outage,
      expect.objectContaining({ handler: "retrievePendingSession", purchaseId: "pur_1" }),
    );
  });
});
