import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
const getScope = vi.fn();
const subscriptionsList = vi.fn();
const checkoutCreate = vi.fn();
const customerCreate = vi.fn();
const getFeatureStripePriceId = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));
vi.mock("@/lib/tenancy/scope", () => ({ getScope: () => getScope() }));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    customers: { create: customerCreate },
    subscriptions: { list: subscriptionsList },
    checkout: { sessions: { create: checkoutCreate } },
  }),
}));
vi.mock("@/lib/billing/feature-stripe", () => ({
  getFeatureStripePriceId: (key: string) => getFeatureStripePriceId(key),
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));

import { POST } from "@/app/api/billing/checkout/route";

const NOW = new Date("2026-08-04T12:00:00.000Z");
const TRIAL_END = new Date("2026-08-08T12:00:00.000Z");

const ownerScope = {
  orgId: "org_1",
  email: "owner@example.com",
  role: UserRole.CLIENT_OWNER,
  isAgency: false,
  isImpersonating: false,
};

const org = {
  id: "org_1",
  name: "Acme Apartments",
  primaryContactEmail: "owner@example.com",
  stripeCustomerId: "cus_1",
  trialEndsAt: TRIAL_END,
  subscriptionStatus: "TRIALING",
  chosenTier: "SCALE",
  subscriptionTier: "SCALE",
  moduleChatbot: true,
  modulePixel: false,
  moduleSEO: false,
  moduleReputation: false,
  moduleGoogleAds: false,
  moduleMetaAds: false,
  modulePopups: false,
  moduleCreativeStudio: false,
  moduleEmail: false,
  moduleOutboundEmail: false,
  moduleReferrals: false,
  moduleInsights: false,
  moduleMarketIntelligence: false,
  moduleAttribution: false,
};

function request(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function activationBody(overrides: Record<string, unknown> = {}) {
  return {
    tierId: "scale",
    cycle: "monthly",
    propertyCount: 1,
    selectedModuleKeys: ["moduleSEO"],
    source: "trial_activation",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockPrisma = createMockPrisma();
  getScope.mockResolvedValue(ownerScope);
  mockPrisma.organization.findUnique.mockResolvedValue(org);
  mockPrisma.property.count.mockResolvedValue(3);
  mockPrisma.featurePrice.findMany.mockResolvedValue([]);
  subscriptionsList.mockResolvedValue({ data: [] });
  getFeatureStripePriceId.mockImplementation(async (key: string) =>
    key === "base_platform" ? "price_base" : `price_${key}`,
  );
  checkoutCreate.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
});

describe("POST /api/billing/checkout", () => {
  it("denies client admins before any Stripe mutation", async () => {
    getScope.mockResolvedValue({ ...ownerScope, role: UserRole.CLIENT_ADMIN });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(403);
    expect(customerCreate).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("allows authorized LeaseStack staff while impersonating the client", async () => {
    getScope.mockResolvedValue({
      ...ownerScope,
      role: UserRole.AGENCY_OPERATOR,
      isAgency: true,
      isImpersonating: true,
    });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(200);
  });

  it("derives quantity, enabled features, and trial end from the organization", async () => {
    const response = await POST(
      request(
        activationBody({
          tierId: "starter",
          propertyCount: 1,
          selectedModuleKeys: ["moduleSEO", "moduleSEO"],
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(mockPrisma.property.count).toHaveBeenCalledWith({
      where: {
        orgId: "org_1",
        lifecycle: { in: ["IMPORTED", "ACTIVE"] },
      },
    });
    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: "price_base", quantity: 3 },
          { price: "price_moduleChatbot", quantity: 3 },
        ],
        subscription_data: expect.objectContaining({
          trial_end: Math.floor(TRIAL_END.getTime() / 1000),
          metadata: expect.objectContaining({ tier: "SCALE", tier_id: "scale" }),
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^co_org_1_[a-f0-9]{24}$/),
      }),
    );
  });

  it("charges immediately when the organization trial has expired", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ...org,
      trialEndsAt: new Date("2026-08-04T11:00:00.000Z"),
    });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(200);
    const params = checkoutCreate.mock.calls[0][0];
    expect(params.subscription_data).not.toHaveProperty("trial_end");
    expect(params.subscription_data).not.toHaveProperty("trial_period_days");
  });

  it("rejects unsupported generic checkout flows", async () => {
    const response = await POST(request(activationBody({ source: "pricing_page" })));
    expect(response.status).toBe(400);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("does not bill a feature that an admin deactivated", async () => {
    mockPrisma.featurePrice.findMany.mockResolvedValue([
      { key: "moduleChatbot", active: false, monthlyCents: 14900 },
    ]);
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(200);
    expect(checkoutCreate.mock.calls[0][0].line_items).toEqual([
      { price: "price_base", quantity: 3 },
    ]);
  });

  it("does not expose a Stripe error in the customer response", async () => {
    checkoutCreate.mockRejectedValue(new Error("secret processor detail"));
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Stripe Checkout is temporarily unavailable. Please try again.",
    });
  });

  it("fails closed when the authoritative active-feature catalog cannot load", async () => {
    mockPrisma.featurePrice.findMany.mockRejectedValue(
      new Error("catalog unavailable"),
    );
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(503);
    expect(customerCreate).not.toHaveBeenCalled();
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("rejects a workspace that is not awaiting trial activation", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      ...org,
      subscriptionStatus: null,
    });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(409);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });

  it("does not let an unrelated recurring proposal block platform activation", async () => {
    subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_proposal",
          status: "active",
          metadata: { kind: "proposal", proposalId: "proposal_1" },
        },
      ],
    });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(200);
    expect(checkoutCreate).toHaveBeenCalledOnce();
  });

  it("blocks a second classified platform subscription", async () => {
    subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_platform",
          status: "trialing",
          metadata: { intent: "trial_activation", org_id: "org_1" },
        },
      ],
    });
    const response = await POST(request(activationBody()));
    expect(response.status).toBe(409);
    expect(checkoutCreate).not.toHaveBeenCalled();
  });
});
