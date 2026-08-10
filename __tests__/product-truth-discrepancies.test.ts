import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  dbAccess: vi.fn((property: PropertyKey) => {
    throw new Error(`Unexpected Prisma access: ${String(property)}`);
  }),
}));

vi.mock("@/lib/db", () => ({
  prisma: new Proxy({}, { get: (_target, property) => h.dbAccess(property) }),
}));

import { ALL_PRODUCT_SOURCE_RECORDS } from "@/lib/products/adapters";
import type { NormalizedProductSourceRecord } from "@/lib/products/adapters";
import { PRODUCT_REGISTRY } from "@/lib/products/registry";
import {
  analyzeProductTruth,
  type ProductTruthFinding,
} from "@/lib/products/discrepancies";

function record(
  patch: Partial<NormalizedProductSourceRecord>,
): NormalizedProductSourceRecord {
  return {
    source: "marketplace",
    sourceId: "test-product",
    label: "Test product",
    recordKind: "product",
    commercialState: "sellable",
    productKey: "ai-leasing-chatbot",
    legacyModuleKeys: ["moduleChatbot"],
    priceCents: 14900,
    billingCadence: "monthly",
    stripeLookupKey: "ls_test",
    stripePriceMapped: true,
    customerVisible: true,
    selfServe: true,
    claim: "Test claim",
    evidencePath: "test.ts",
    ...patch,
  };
}

function findingIds(findings: readonly ProductTruthFinding[]): string[] {
  return findings.map(({ id }) => id);
}

describe("product truth discrepancy engine", () => {
  it("detects duplicate source identities and unknown product keys", () => {
    const duplicate = record({ sourceId: "duplicate" });
    const findings = analyzeProductTruth(PRODUCT_REGISTRY, [
      duplicate,
      { ...duplicate },
      { ...duplicate },
      record({ sourceId: "unknown", productKey: "unknown-product" }),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_source_identifier",
          severity: "critical",
        }),
        expect.objectContaining({
          code: "unknown_product_key",
          severity: "critical",
          sourceId: "unknown",
        }),
      ]),
    );
    expect(
      findings.filter(({ code }) => code === "duplicate_source_identifier"),
    ).toHaveLength(1);
  });

  it("rejects unsupported self-serve products and unsafe service mappings", () => {
    const findings = analyzeProductTruth(PRODUCT_REGISTRY, [
      record({ sourceId: "orphan", productKey: null }),
      record({
        sourceId: "service",
        productKey: "website-build",
        legacyModuleKeys: ["moduleWebsite"],
        selfServe: true,
      }),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unsupported_self_serve_product",
          severity: "critical",
          sourceId: "orphan",
        }),
        expect.objectContaining({
          code: "service_entitlement_conflict",
          severity: "critical",
          sourceId: "service",
        }),
        expect.objectContaining({
          code: "service_self_serve_conflict",
          severity: "critical",
          sourceId: "service",
        }),
      ]),
    );
  });

  it("flags beta products sold self-serve and unverifiable Stripe mappings", () => {
    const findings = analyzeProductTruth(PRODUCT_REGISTRY, [
      record({
        sourceId: "beta-sale",
        productKey: "conversion-offers",
        stripePriceMapped: false,
      }),
      record({
        sourceId: "beta-sale-2",
        productKey: "conversion-offers",
        stripePriceMapped: false,
      }),
      record({
        source: "stripe_static",
        sourceId: "unknown-static-price",
        productKey: null,
        customerVisible: false,
        selfServe: false,
      }),
      record({
        sourceId: "missing-lookup",
        stripeLookupKey: null,
        stripePriceMapped: false,
      }),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "readiness_conflict",
          severity: "critical",
        }),
        expect.objectContaining({
          code: "missing_stripe_mapping",
          sourceId: "missing-lookup",
          severity: "critical",
        }),
        expect.objectContaining({
          code: "stripe_live_verification_deferred",
          severity: "info",
        }),
        expect.objectContaining({
          code: "unclassified_stripe_mapping",
          sourceId: "unknown-static-price",
          severity: "warning",
        }),
      ]),
    );
    expect(
      findings.filter(
        ({ code }) => code === "stripe_live_verification_deferred",
      ),
    ).toHaveLength(2);
  });

  it("rejects beta and unsupported entitlements bundled into self-serve tiers", () => {
    const findings = analyzeProductTruth(PRODUCT_REGISTRY, [
      record({
        source: "billing_catalog",
        sourceId: "growth.monthly",
        recordKind: "tier",
        productKey: null,
        legacyModuleKeys: ["modulePopups", "moduleReferrals"],
      }),
      record({
        source: "billing_catalog",
        sourceId: "growth.annual",
        recordKind: "tier",
        productKey: null,
        legacyModuleKeys: ["modulePopups", "moduleReferrals"],
      }),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "tier_readiness_conflict",
          productKey: "conversion-offers",
        }),
        expect.objectContaining({
          code: "tier_unsupported_entitlement",
          reason: expect.stringContaining("moduleReferrals"),
        }),
      ]),
    );
    expect(
      findings.filter(({ code }) => code === "tier_readiness_conflict"),
    ).toHaveLength(1);
    expect(
      findings.filter(({ code }) => code === "tier_unsupported_entitlement"),
    ).toHaveLength(1);
  });

  it("surfaces the known software-boundary and universal-claim conflicts", () => {
    const findings = analyzeProductTruth(
      PRODUCT_REGISTRY,
      ALL_PRODUCT_SOURCE_RECORDS,
    );
    const ids = findingIds(findings);

    expect(ids).toContain(
      "unsupported_claim:marketing:features.ads.managed-end-to-end",
    );
    expect(ids).toContain(
      "unsupported_claim:marketing:features.ads.weekly-creative-refresh",
    );
    expect(ids).toContain(
      "unsupported_claim:marketing:home.faq.every-major-pms",
    );
    expect(ids).toContain(
      "unsupported_claim:marketing:home.hero.universal-attribution",
    );
    expect(
      findings.filter(({ code }) => code === "unsupported_claim"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "critical",
          owner: "marketing",
        }),
      ]),
    );
    expect(h.dbAccess).not.toHaveBeenCalled();
  });

  it("reports missing registry entitlements and self-serve price drift", () => {
    const reputation = PRODUCT_REGISTRY.find(
      ({ key }) => key === "reputation-rescue",
    );
    expect(reputation).toBeDefined();

    const findings = analyzeProductTruth([reputation!], [
      record({
        source: "billing_features",
        sourceId: "moduleReputation",
        productKey: "reputation-rescue",
        legacyModuleKeys: [],
        priceCents: 7900,
      }),
      record({
        source: "billing_catalog",
        sourceId: "ls_addon_reputation_pro",
        productKey: "reputation-rescue",
        priceCents: 9900,
      }),
      record({
        sourceId: "unrelated-price",
        productKey: "reputation-rescue",
        priceCents: 12000,
      }),
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_entitlement_evidence" }),
        expect.objectContaining({
          code: "price_drift",
          severity: "warning",
          reason: expect.stringContaining("7900, 9900"),
        }),
        expect.objectContaining({
          code: "unclassified_price_source",
          sourceId: "unrelated-price",
          reason: expect.stringContaining("12000"),
        }),
      ]),
    );
    expect(
      findings.find(({ code }) => code === "price_drift")?.reason,
    ).not.toContain("12000");
  });

  it("sorts findings deterministically by severity, code, source, and id", () => {
    const first = analyzeProductTruth(PRODUCT_REGISTRY, [
      record({ sourceId: "z", productKey: null }),
      record({ sourceId: "a", productKey: null }),
    ]);
    const second = analyzeProductTruth(PRODUCT_REGISTRY, [
      record({ sourceId: "a", productKey: null }),
      record({ sourceId: "z", productKey: null }),
    ]);

    expect(first).toEqual(second);
    expect(first.map(({ severity }) => severity)).toEqual(
      [...first.map(({ severity }) => severity)].sort(
        (a, b) =>
          ({ critical: 0, warning: 1, info: 2 })[a] -
          ({ critical: 0, warning: 1, info: 2 })[b],
      ),
    );
  });
});
