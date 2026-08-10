import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  featurePriceFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    featurePrice: { findMany: h.featurePriceFindMany },
  },
}));

import { modulesFromFeaturePriceIds } from "@/lib/billing/feature-stripe";

describe("feature price history", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps an old Stripe price through the feature's stable product id", async () => {
    h.featurePriceFindMany.mockResolvedValue([{ key: "moduleChatbot" }]);

    const modules = await modulesFromFeaturePriceIds([
      { priceId: "price_chat_v1", productId: "prod_chat" },
    ]);

    expect(h.featurePriceFindMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { stripePriceId: { in: ["price_chat_v1"] } },
          { stripeProductId: { in: ["prod_chat"] } },
        ],
      },
      select: { key: true },
    });
    expect(modules).toMatchObject({
      moduleWebsite: true,
      moduleLeadCapture: true,
      moduleChatbot: true,
      moduleSEO: false,
    });
  });
});
