import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
  auditCreate: vi.fn(),
  getFeaturePriceRows: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: vi.fn().mockResolvedValue({ orgId: "agency_1" }),
  ForbiddenError: class ForbiddenError extends Error {},
  auditPayload: (_scope: unknown, payload: unknown) => payload,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    featurePrice: { findMany: h.findMany, upsert: h.upsert },
    auditEvent: { create: h.auditCreate },
    $transaction: h.transaction,
  },
}));
vi.mock("@/lib/billing/feature-prices", () => ({
  getFeaturePriceRows: h.getFeaturePriceRows,
  isValidFeaturePriceKey: () => true,
}));
vi.mock("@/lib/stripe/config", () => ({ isStripeConfigured: () => true }));
vi.mock("@/lib/billing/feature-stripe", () => ({
  syncAllFeaturePricesToStripe: vi.fn(),
}));

import { saveFeaturePrices } from "@/app/admin/pricing/actions";

describe("admin feature price save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getFeaturePriceRows.mockResolvedValue([
      {
        key: "moduleChatbot",
        label: "AI Leasing Chatbot",
        monthlyCents: 14900,
        active: true,
        isBase: false,
        synced: true,
      },
    ]);
    h.findMany.mockResolvedValue([
      { key: "moduleChatbot", monthlyCents: 14900 },
    ]);
    h.transaction.mockResolvedValue([]);
    h.auditCreate.mockResolvedValue({});
  });

  it("invalidates the Stripe price link when an amount changes", async () => {
    const form = new FormData();
    form.set("price_moduleChatbot", "159");
    form.set("active_moduleChatbot", "on");

    await expect(saveFeaturePrices(form)).resolves.toEqual({ ok: true });
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "moduleChatbot" },
        update: expect.objectContaining({
          monthlyCents: 15900,
          stripePriceId: null,
          stripeSyncedAt: null,
        }),
      }),
    );
  });
});
