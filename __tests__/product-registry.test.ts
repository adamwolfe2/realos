import { describe, expect, it } from "vitest";
import {
  PRODUCT_KEYS,
  PRODUCT_REGISTRY,
  getProductDefinition,
} from "@/lib/products/registry";

describe("canonical product registry", () => {
  it("contains the approved portfolio in stable order", () => {
    expect(PRODUCT_REGISTRY.map(({ key }) => key)).toEqual([
      "connected-data-foundation",
      "lead-to-lease-attribution",
      "ai-leasing-chatbot",
      "conversion-offers",
      "reputation-rescue",
      "search-opportunity-engine",
      "monday-action-brief",
      "website-build",
    ]);
    expect(PRODUCT_KEYS).toEqual(PRODUCT_REGISTRY.map(({ key }) => key));
  });

  it("classifies the platform spine, outcome products, and service correctly", () => {
    expect(getProductDefinition("connected-data-foundation")?.classification).toBe(
      "foundation",
    );
    expect(getProductDefinition("lead-to-lease-attribution")?.classification).toBe(
      "foundation",
    );
    expect(getProductDefinition("website-build")?.classification).toBe("service");

    const outcomes = PRODUCT_REGISTRY.filter(
      ({ classification }) => classification === "outcome_product",
    );
    expect(outcomes).toHaveLength(5);
  });

  it("keeps managed ads, creative services, and resident referrals out of the portfolio", () => {
    const serialized = JSON.stringify(PRODUCT_REGISTRY).toLowerCase();

    expect(serialized).not.toContain("managed ads");
    expect(serialized).not.toContain("creative studio");
    expect(serialized).not.toContain("resident referral engine");
  });

  it("requires activation proof, a primary KPI, and degraded behavior for every product", () => {
    for (const product of PRODUCT_REGISTRY) {
      expect(product.activationEvidence.length, product.key).toBeGreaterThan(0);
      expect(product.kpi.primary.trim(), product.key).not.toBe("");
      expect(product.degradedBehavior.trim(), product.key).not.toBe("");
    }
  });

  it("uses existing entitlement aliases without granting access itself", () => {
    expect(getProductDefinition("ai-leasing-chatbot")?.legacyModuleKeys).toEqual([
      "moduleChatbot",
      "moduleConversations",
    ]);
    expect(getProductDefinition("conversion-offers")?.legacyModuleKeys).toEqual([
      "modulePopups",
    ]);
    expect(getProductDefinition("website-build")?.legacyModuleKeys).toEqual([]);
  });

  it("marks existing product reality honestly", () => {
    expect(getProductDefinition("ai-leasing-chatbot")?.readiness).toBe("sellable");
    expect(getProductDefinition("conversion-offers")?.readiness).toBe("beta");
    expect(getProductDefinition("website-build")?.readiness).toBe("concierge");
  });

  it("is immutable at the registry and entry boundaries", () => {
    expect(Object.isFrozen(PRODUCT_REGISTRY)).toBe(true);
    for (const product of PRODUCT_REGISTRY) {
      expect(Object.isFrozen(product), product.key).toBe(true);
    }
  });

  it("returns undefined for an unknown key without guessing", () => {
    expect(getProductDefinition("not-a-product")).toBeUndefined();
  });
});
