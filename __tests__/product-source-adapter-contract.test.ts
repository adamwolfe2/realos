import { describe, expect, it } from "vitest";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";
import { ALL_PRODUCT_SOURCE_RECORDS } from "@/lib/products/adapters";

describe("product source adapter contract", () => {
  it("freezes normalized records without changing their values", () => {
    const records = defineProductSourceRecords([
      {
        source: "marketplace",
        sourceId: "ai-chatbot",
        label: "AI Leasing Chatbot",
        recordKind: "product",
        commercialState: "sellable",
        productKey: "ai-leasing-chatbot",
        legacyModuleKeys: ["moduleChatbot"],
        priceCents: 14900,
        billingCadence: "monthly",
        stripeLookupKey: "ls_addon_chatbot_v1",
        stripePriceMapped: false,
        customerVisible: true,
        selfServe: true,
        claim: "Captures qualified leasing leads around the clock.",
        evidencePath: "lib/marketplace/catalog.ts",
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      source: "marketplace",
      sourceId: "ai-chatbot",
      productKey: "ai-leasing-chatbot",
    });
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0].legacyModuleKeys)).toBe(true);
  });

  it("exposes one immutable collection with unique source identifiers", () => {
    const identities = ALL_PRODUCT_SOURCE_RECORDS.map(
      ({ source, sourceId }) => `${source}:${sourceId}`,
    );

    expect(ALL_PRODUCT_SOURCE_RECORDS.length).toBeGreaterThan(0);
    expect(new Set(identities).size).toBe(identities.length);
    expect(Object.isFrozen(ALL_PRODUCT_SOURCE_RECORDS)).toBe(true);
  });
});
