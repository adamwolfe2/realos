import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

// A partial refund must not flip the purchase to REFUNDED or claw back the
// seller's whole share; only a full refund does.
const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  sellerUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    marketplacePurchase: { updateMany: m.updateMany },
    marketplaceSeller: { update: m.sellerUpdate },
    marketplaceAuditEvent: { create: m.auditCreate },
  };
  return {
    prisma: {
      marketplacePurchase: { findUnique: m.findUnique },
      marketplaceAuditEvent: { create: m.auditCreate },
      $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    },
  };
});

const { handleMarketplaceChargeRefunded } = await import("@/lib/marketplace/webhook-handlers");

const purchase = {
  id: "p1",
  leadId: "l1",
  buyerId: "b1",
  status: "PAID",
  priceCents: 5000,
  sellerIdAtSale: "s1",
  sellerShareCents: 3000,
};

function charge(amountRefunded: number): Stripe.Charge {
  return {
    id: "ch_1",
    payment_intent: "pi_1",
    amount: 5000,
    amount_refunded: amountRefunded,
    refunded: amountRefunded >= 5000,
    refunds: { data: [{ reason: "requested_by_customer" }] },
  } as unknown as Stripe.Charge;
}

describe("marketplace charge.refunded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findUnique.mockResolvedValue(purchase);
    m.updateMany.mockResolvedValue({ count: 1 });
  });

  it("full refund flips status and reverses seller share", async () => {
    await handleMarketplaceChargeRefunded(charge(5000));
    expect(m.updateMany).toHaveBeenCalledTimes(1);
    expect(m.sellerUpdate).toHaveBeenCalledTimes(1);
  });

  it("partial refund leaves the purchase and seller credit alone", async () => {
    const handled = await handleMarketplaceChargeRefunded(charge(500));
    expect(handled).toBe(true);
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.sellerUpdate).not.toHaveBeenCalled();
    expect(m.auditCreate).toHaveBeenCalledTimes(1);
    expect(m.auditCreate.mock.calls[0][0].data.action).toBe("LEAD_PARTIALLY_REFUNDED");
  });
});
