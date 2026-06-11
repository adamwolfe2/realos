import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MarketplaceLeadStatus,
  MarketplacePurchaseStatus,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Regression tests for the marketplace settlement money path
// (handleMarketplaceCheckoutCompleted). Locks in the atomic-claim + refund
// hardening (5 rounds of Codex review): exactly one concurrent paid webhook
// wins, losers are refunded + never delivered PII, duplicate-winner webhooks
// don't refund the winner, and a refund failure throws to force a Stripe retry.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(),
    create: vi.fn(async () => ({})),
  });
  return {
    db: {
      marketplacePurchase: model(),
      marketplaceLead: model(),
      marketplaceSeller: model(),
      marketplaceAuditEvent: model(),
      $transaction: vi.fn(),
    },
    refundsCreate: vi.fn(),
    paymentIntentsRetrieve: vi.fn(),
    sendLeadDeliveryEmail: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/stripe/config", () => ({
  getStripeClient: () => ({
    refunds: { create: h.refundsCreate },
    paymentIntents: { retrieve: h.paymentIntentsRetrieve },
  }),
}));
vi.mock("@/lib/marketplace/emails", () => ({
  sendLeadDeliveryEmail: h.sendLeadDeliveryEmail,
}));

import { handleMarketplaceCheckoutCompleted } from "@/lib/marketplace/webhook-handlers";

function makeSession(over: Record<string, unknown> = {}) {
  return {
    id: "cs_1",
    metadata: { marketplaceLeadId: "lead_1" },
    payment_intent: "pi_1",
    amount_total: 5000,
    ...over,
  } as never;
}

function makePurchase(over: Record<string, unknown> = {}) {
  return {
    id: "pur_1",
    leadId: "lead_1",
    buyerId: "buyer_1",
    status: MarketplacePurchaseStatus.PENDING,
    priceCents: 5000,
    origin: "DIRECT",
    sellerIdAtSale: null,
    sellerShareCents: null,
    lead: {
      id: "lead_1",
      sellerId: null,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: null,
      market: "Austin",
      propertyType: "apt",
      intentScore: 5,
      signal: "hot",
      budgetLabel: "$2k",
      timeline: "30d",
    },
    buyer: { email: "buyer@example.com", fullName: "Buyer" },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction: interactive form runs the callback with `db` as the tx;
  // array form resolves all operations (mirrors prisma's two signatures).
  h.db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return await (arg as (tx: typeof h.db) => Promise<unknown>)(h.db);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  h.refundsCreate.mockResolvedValue({ id: "re_1" });
  h.paymentIntentsRetrieve.mockResolvedValue({
    latest_charge: { receipt_url: "https://receipt" },
  });
  h.sendLeadDeliveryEmail.mockResolvedValue({ ok: true });
  h.db.marketplaceSeller.findUnique.mockResolvedValue(null);
  h.db.marketplacePurchase.update.mockResolvedValue({});
  h.db.marketplaceAuditEvent.create.mockResolvedValue({});
});

describe("marketplace settlement", () => {
  it("winner: claims the lead, marks the purchase PAID, delivers PII, no refund", async () => {
    h.db.marketplacePurchase.findUnique.mockResolvedValue(makePurchase());
    h.db.marketplaceLead.updateMany.mockResolvedValue({ count: 1 }); // claim wins

    const result = await handleMarketplaceCheckoutCompleted(makeSession());

    expect(result).toBe(true);
    // Lead atomically claimed SOLD with the strict status != SOLD predicate.
    expect(h.db.marketplaceLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "lead_1",
          status: { not: MarketplaceLeadStatus.SOLD },
        }),
        data: expect.objectContaining({
          status: MarketplaceLeadStatus.SOLD,
          soldToBuyerId: "buyer_1",
        }),
      }),
    );
    // Purchase marked PAID.
    expect(h.db.marketplacePurchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pur_1" },
        data: expect.objectContaining({
          status: MarketplacePurchaseStatus.PAID,
        }),
      }),
    );
    expect(h.sendLeadDeliveryEmail).toHaveBeenCalledTimes(1);
    expect(h.refundsCreate).not.toHaveBeenCalled();
  });

  it("loser: claim fails + purchase still pending → refund (idempotent) + REFUNDED, never delivers PII", async () => {
    h.db.marketplacePurchase.findUnique
      .mockResolvedValueOnce(makePurchase()) // top lookup
      .mockResolvedValueOnce({ status: MarketplacePurchaseStatus.PENDING }); // loser re-check
    h.db.marketplaceLead.updateMany.mockResolvedValue({ count: 0 }); // claim loses

    const result = await handleMarketplaceCheckoutCompleted(makeSession());

    expect(result).toBe(true);
    expect(h.refundsCreate).toHaveBeenCalledWith(
      { payment_intent: "pi_1" },
      expect.objectContaining({
        idempotencyKey: expect.stringContaining("mp_refund_"),
      }),
    );
    expect(h.sendLeadDeliveryEmail).not.toHaveBeenCalled();
  });

  it("duplicate winner webhook: claim fails but the purchase is already PAID → no refund, no PII", async () => {
    h.db.marketplacePurchase.findUnique
      .mockResolvedValueOnce(makePurchase())
      .mockResolvedValueOnce({ status: MarketplacePurchaseStatus.PAID }); // concurrent winner committed
    h.db.marketplaceLead.updateMany.mockResolvedValue({ count: 0 });

    const result = await handleMarketplaceCheckoutCompleted(makeSession());

    expect(result).toBe(true);
    expect(h.refundsCreate).not.toHaveBeenCalled();
    expect(h.sendLeadDeliveryEmail).not.toHaveBeenCalled();
  });

  it("idempotent: a purchase already PAID returns early without re-claiming or refunding", async () => {
    h.db.marketplacePurchase.findUnique.mockResolvedValue(
      makePurchase({ status: MarketplacePurchaseStatus.PAID }),
    );

    const result = await handleMarketplaceCheckoutCompleted(makeSession());

    expect(result).toBe(true);
    expect(h.db.marketplaceLead.updateMany).not.toHaveBeenCalled();
    expect(h.refundsCreate).not.toHaveBeenCalled();
    expect(h.sendLeadDeliveryEmail).not.toHaveBeenCalled();
  });

  it("refund failure THROWS (forces Stripe retry) and never marks REFUNDED", async () => {
    h.db.marketplacePurchase.findUnique
      .mockResolvedValueOnce(makePurchase())
      .mockResolvedValueOnce({ status: MarketplacePurchaseStatus.PENDING });
    h.db.marketplaceLead.updateMany.mockResolvedValue({ count: 0 });
    h.refundsCreate.mockRejectedValue(new Error("stripe unavailable"));

    await expect(
      handleMarketplaceCheckoutCompleted(makeSession()),
    ).rejects.toThrow();

    // The REFUNDED-write transaction (array form) must not have run.
    expect(h.db.$transaction).not.toHaveBeenCalledWith(expect.any(Array));
  });
});
