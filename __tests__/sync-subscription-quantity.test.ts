import { describe, it, expect, vi, beforeEach } from "vitest";
import { TIERS } from "@/lib/billing/catalog";

// ---------------------------------------------------------------------------
// Coverage gap: lib/billing/sync-subscription-quantity.ts had zero test
// coverage. It updates the Stripe subscription item quantity (with
// proration) whenever an org's property count changes — a regression here
// either mis-bills a tenant (wrong seat count) or silently stops billing
// for added properties. Covers every skip branch, the happy-path update +
// audit write, and the fail-closed (never-throw) error path.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    organization: { findUnique: vi.fn() },
    property: { count: vi.fn() },
    featurePrice: { findMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  stripeConfigured: true,
  subscriptionsList: vi.fn(),
  subscriptionsUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/sentry", () => ({ captureWithContext: vi.fn() }));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => h.stripeConfigured,
  getStripeClient: () => ({
    subscriptions: {
      list: h.subscriptionsList,
      update: h.subscriptionsUpdate,
    },
  }),
}));

import { syncSubscriptionQuantity } from "@/lib/billing/sync-subscription-quantity";

const ACTIVE_ORG = {
  id: "org_1",
  stripeCustomerId: "cus_1",
  subscriptionStatus: "ACTIVE",
  subscriptionTier: "FOUNDATION",
};

const tierLookupKey = TIERS[0].graduatedMonthly.lookupKey;

function stripeSub(overrides: Partial<{ status: string; quantity: number; lookupKey: string | null; metadata: Record<string, string> }> = {}) {
  return {
    id: "sub_1",
    status: overrides.status ?? "active",
    metadata: overrides.metadata ?? {
      intent: "trial_activation",
      org_id: "org_1",
    },
    items: {
      data: [
        {
          id: "si_1",
          quantity: overrides.quantity ?? 1,
          price: { lookup_key: overrides.lookupKey ?? tierLookupKey },
        },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.stripeConfigured = true;
  h.db.organization.findUnique.mockResolvedValue(ACTIVE_ORG);
  h.db.property.count.mockResolvedValue(3);
  h.db.featurePrice.findMany.mockResolvedValue([]);
  h.subscriptionsList.mockResolvedValue({ data: [stripeSub({ quantity: 1 })] });
});

describe("syncSubscriptionQuantity", () => {
  it("no-ops when Stripe isn't configured", async () => {
    h.stripeConfigured = false;
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual({ ok: true, skipped: "stripe_not_configured" });
    expect(h.db.organization.findUnique).not.toHaveBeenCalled();
  });

  it("fails when the org doesn't exist", async () => {
    h.db.organization.findUnique.mockResolvedValue(null);
    const result = await syncSubscriptionQuantity("org_missing");
    expect(result).toEqual({ ok: false, error: "Org not found" });
  });

  it("no-ops when the org has no Stripe customer yet", async () => {
    h.db.organization.findUnique.mockResolvedValue({ ...ACTIVE_ORG, stripeCustomerId: null });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual({ ok: true, skipped: "no_stripe_customer" });
  });

  it("updates a scheduled trial subscription before its first invoice", async () => {
    h.db.organization.findUnique.mockResolvedValue({ ...ACTIVE_ORG, subscriptionStatus: "TRIALING" });
    h.subscriptionsList.mockResolvedValue({
      data: [stripeSub({ status: "trialing", quantity: 1 })],
    });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual(
      expect.objectContaining({ ok: true, changedTo: 3, changedItemCount: 1 }),
    );
    expect(h.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({ items: [{ id: "si_1", quantity: 3 }] }),
    );
  });

  it("no-ops when the org has zero active/imported properties", async () => {
    h.db.property.count.mockResolvedValue(0);
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual({ ok: true, skipped: "no_properties" });
  });

  it("no-ops when there's no active/past_due subscription on Stripe", async () => {
    h.subscriptionsList.mockResolvedValue({ data: [stripeSub({ status: "canceled" })] });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual({ ok: true, skipped: "no_active_subscription" });
  });

  it("no-ops when no subscription item matches a known tier lookup key", async () => {
    h.subscriptionsList.mockResolvedValue({
      data: [stripeSub({ lookupKey: "some_unrelated_addon" })],
    });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual({ ok: true, skipped: "no_tier_item_on_subscription" });
  });

  it("no-ops when the Stripe quantity already matches the property count", async () => {
    h.db.property.count.mockResolvedValue(1);
    h.subscriptionsList.mockResolvedValue({ data: [stripeSub({ quantity: 1 })] });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual(
      expect.objectContaining({ ok: true, skipped: "quantity_already_matches" }),
    );
    expect(h.subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("updates the Stripe subscription item quantity with proration and writes an audit row", async () => {
    h.db.property.count.mockResolvedValue(5);
    h.subscriptionsList.mockResolvedValue({ data: [stripeSub({ quantity: 2 })] });
    h.subscriptionsUpdate.mockResolvedValue({});

    const result = await syncSubscriptionQuantity("org_1");

    expect(result).toEqual({
      ok: true,
      changedFrom: 2,
      changedTo: 5,
      changedItemCount: 1,
    });
    expect(h.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_1",
      expect.objectContaining({
        items: [{ id: "si_1", quantity: 5 }],
        proration_behavior: "create_prorations",
      }),
    );
    expect(h.db.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org_1", entityType: "Subscription" }),
      }),
    );
  });

  it("updates every stale per-property item on an a-la-carte subscription", async () => {
    h.db.property.count.mockResolvedValue(4);
    h.db.featurePrice.findMany.mockResolvedValue([
      { stripePriceId: "price_base" },
      { stripePriceId: "price_chatbot" },
      { stripePriceId: "price_seo" },
    ]);
    h.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_feature",
          status: "active",
          metadata: { intent: "trial_activation", org_id: "org_1" },
          items: {
            data: [
              { id: "si_base", quantity: 1, price: { id: "price_base", lookup_key: null, recurring: { usage_type: "licensed" } } },
              { id: "si_chat", quantity: 1, price: { id: "price_chatbot", lookup_key: null, recurring: { usage_type: "licensed" } } },
              { id: "si_seo", quantity: 4, price: { id: "price_seo", lookup_key: null, recurring: { usage_type: "licensed" } } },
              { id: "si_fixed", quantity: 1, price: { id: "price_white_label", lookup_key: "ls_white_label_monthly_v1", recurring: { usage_type: "licensed" } } },
              { id: "si_metered", quantity: null, price: { id: "price_metered", lookup_key: "metered", recurring: { usage_type: "metered" } } },
            ],
          },
        },
      ],
    });
    h.subscriptionsUpdate.mockResolvedValue({});

    const result = await syncSubscriptionQuantity("org_1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, changedTo: 4, changedItemCount: 2 }),
    );
    expect(h.subscriptionsUpdate).toHaveBeenCalledWith("sub_feature", {
      items: [
        { id: "si_base", quantity: 4 },
        { id: "si_chat", quantity: 4 },
      ],
      proration_behavior: "create_prorations",
    });
  });

  it("recognizes historical feature prices by their stable Stripe product", async () => {
    h.db.property.count.mockResolvedValue(4);
    h.db.featurePrice.findMany.mockResolvedValue([
      { stripePriceId: "price_chat_v2", stripeProductId: "prod_chat" },
    ]);
    h.subscriptionsList.mockResolvedValue({
      data: [
        {
          id: "sub_historical",
          status: "active",
          metadata: { intent: "trial_activation", org_id: "org_1" },
          items: {
            data: [
              {
                id: "si_chat_v1",
                quantity: 1,
                price: {
                  id: "price_chat_v1",
                  product: "prod_chat",
                  lookup_key: null,
                  recurring: { usage_type: "licensed" },
                },
              },
            ],
          },
        },
      ],
    });
    const result = await syncSubscriptionQuantity("org_1");
    expect(result).toEqual(
      expect.objectContaining({ ok: true, changedTo: 4, changedItemCount: 1 }),
    );
  });

  it("skips a proposal subscription and updates the platform subscription", async () => {
    h.db.property.count.mockResolvedValue(3);
    h.subscriptionsList.mockResolvedValue({
      data: [
        stripeSub({
          status: "active",
          quantity: 1,
          metadata: { kind: "proposal", proposalId: "proposal_1" },
        }),
        {
          ...stripeSub({ status: "active", quantity: 1 }),
          id: "sub_platform",
        },
      ],
    });

    const result = await syncSubscriptionQuantity("org_1");

    expect(result).toEqual(
      expect.objectContaining({ ok: true, changedTo: 3, changedItemCount: 1 }),
    );
    expect(h.subscriptionsUpdate).toHaveBeenCalledWith(
      "sub_platform",
      expect.any(Object),
    );
  });

  it("never throws — a Stripe API error returns ok:false instead", async () => {
    h.subscriptionsList.mockRejectedValue(new Error("stripe unreachable"));
    const result = await syncSubscriptionQuantity("org_1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("stripe unreachable");
  });
});
