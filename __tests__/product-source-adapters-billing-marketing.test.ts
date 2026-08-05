import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_CATALOG } from "@/lib/billing/features";
import { ADDONS, TIERS, WEBSITE_BUILDS } from "@/lib/billing/catalog";
import { STRIPE_PRICE_IDS } from "@/lib/billing/price-ids.generated";
import {
  ADS_ATTRIBUTION_HEADLINE,
  ADS_CREATIVE_REFRESH_CLAIM,
  MANAGED_ADS_DESCRIPTION,
} from "@/lib/copy/product-claims";
import { BILLING_FEATURE_RECORDS } from "@/lib/products/adapters/billing-features";
import {
  BILLING_ADDON_RECORDS,
  BILLING_CATALOG_RECORDS,
  BILLING_TIER_RECORDS,
  WEBSITE_BUILD_RECORDS,
} from "@/lib/products/adapters/billing-tiers";
import { ENTITLEMENT_RECORDS } from "@/lib/products/adapters/entitlements";
import { MARKETING_CLAIM_RECORDS } from "@/lib/products/adapters/marketing";
import { STRIPE_STATIC_RECORDS } from "@/lib/products/adapters/stripe-static";

const adapterSources = [
  "lib/products/adapters/billing-features.ts",
  "lib/products/adapters/billing-tiers.ts",
  "lib/products/adapters/entitlements.ts",
  "lib/products/adapters/marketing.ts",
  "lib/products/adapters/stripe-static.ts",
].map((file) =>
  fs.readFileSync(path.resolve(process.cwd(), file), "utf8"),
);

describe("billing feature source adapter", () => {
  it("normalizes the base and every current à-la-carte feature", () => {
    expect(BILLING_FEATURE_RECORDS).toHaveLength(FEATURE_CATALOG.length + 1);
    expect(BILLING_FEATURE_RECORDS.map(({ sourceId }) => sourceId)).toEqual([
      "base_platform",
      ...FEATURE_CATALOG.map(({ key }) => key),
    ]);
    expect(BILLING_FEATURE_RECORDS[0]).toMatchObject({
      source: "billing_features",
      sourceId: "base_platform",
      productKey: "connected-data-foundation",
      legacyModuleKeys: ["moduleWebsite", "moduleLeadCapture"],
      priceCents: 9900,
      stripeLookupKey: "ls_base_platform_monthly",
      stripePriceMapped: false,
    });
  });

  it("preserves supported mappings and legacy-only orphan features", () => {
    expect(
      BILLING_FEATURE_RECORDS.find(({ sourceId }) => sourceId === "moduleChatbot"),
    ).toMatchObject({
      productKey: "ai-leasing-chatbot",
      legacyModuleKeys: ["moduleChatbot"],
      priceCents: 14900,
      commercialState: "sellable",
      selfServe: true,
    });
    expect(
      BILLING_FEATURE_RECORDS.find(
        ({ sourceId }) => sourceId === "moduleCreativeStudio",
      ),
    ).toMatchObject({
      productKey: null,
      legacyModuleKeys: ["moduleCreativeStudio"],
      priceCents: 9900,
    });
  });
});

describe("tier, add-on, and website-build source adapters", () => {
  it("emits every flat and graduated tier price without approving a bundle", () => {
    expect(BILLING_TIER_RECORDS).toHaveLength(TIERS.length * 4);
    expect(BILLING_TIER_RECORDS[0]).toMatchObject({
      sourceId: "starter.monthly",
      recordKind: "tier",
      commercialState: "sellable",
      productKey: null,
      priceCents: 49900,
      billingCadence: "monthly",
      stripeLookupKey: "ls_foundation_monthly_v1",
      stripePriceMapped: true,
    });
    expect(
      BILLING_TIER_RECORDS.find(
        ({ sourceId }) => sourceId === "scale.graduated-annual",
      ),
    ).toMatchObject({
      // Catalog stores an annual plan's monthly-equivalent rate; Stripe setup
      // multiplies it by 12 for the actual annual price.
      priceCents: 1498800,
      billingCadence: "annual",
      stripeLookupKey: "ls_scale_graduated_annual_v1",
      stripePriceMapped: true,
    });
  });

  it("carries enabled tier modules into the normalized contract", () => {
    expect(
      BILLING_TIER_RECORDS.find(({ sourceId }) => sourceId === "growth.monthly")
        ?.legacyModuleKeys,
    ).toEqual(
      expect.arrayContaining([
        "moduleSEO",
        "moduleGoogleAds",
        "moduleMetaAds",
      ]),
    );
    expect(
      BILLING_TIER_RECORDS.find(({ sourceId }) => sourceId === "scale.monthly")
        ?.legacyModuleKeys,
    ).toContain("moduleReferrals");
  });

  it("normalizes all add-ons and both concierge website services", () => {
    expect(BILLING_ADDON_RECORDS).toHaveLength(ADDONS.length);
    expect(WEBSITE_BUILD_RECORDS).toHaveLength(WEBSITE_BUILDS.length);
    expect(BILLING_CATALOG_RECORDS).toHaveLength(
      TIERS.length * 4 + ADDONS.length + WEBSITE_BUILDS.length,
    );
    expect(
      BILLING_ADDON_RECORDS.find(
        ({ sourceId }) => sourceId === "ls_addon_reputation_pro",
      ),
    ).toMatchObject({
      productKey: "reputation-rescue",
      recordKind: "addon",
      priceCents: 9900,
      billingCadence: "monthly",
    });
    expect(WEBSITE_BUILD_RECORDS.map(({ sourceId, commercialState }) => ({
      sourceId,
      commercialState,
    }))).toEqual([
      { sourceId: "standard", commercialState: "concierge" },
      { sourceId: "premium", commercialState: "concierge" },
    ]);
  });
});

describe("entitlement relationship adapter", () => {
  it("makes base, selection, chatbot-companion, and tier grants explicit", () => {
    expect(
      ENTITLEMENT_RECORDS.find(
        ({ sourceId }) => sourceId === "selection.moduleConversations",
      ),
    ).toMatchObject({
      source: "billing_features",
      productKey: "ai-leasing-chatbot",
      legacyModuleKeys: ["moduleConversations"],
      commercialState: "included",
    });
    expect(
      ENTITLEMENT_RECORDS.find(
        ({ sourceId }) => sourceId === "growth.moduleCreativeStudio",
      ),
    ).toMatchObject({
      source: "billing_catalog",
      productKey: null,
      legacyModuleKeys: ["moduleCreativeStudio"],
    });
    expect(
      ENTITLEMENT_RECORDS.find(({ sourceId }) => sourceId === "custom"),
    ).toMatchObject({
      commercialState: "concierge",
      legacyModuleKeys: [],
      claim: "CUSTOM tier entitlements are managed manually.",
    });
  });
});

describe("static Stripe mapping adapter", () => {
  it("normalizes every generated lookup key without exposing price ids", () => {
    expect(STRIPE_STATIC_RECORDS).toHaveLength(
      Object.keys(STRIPE_PRICE_IDS).length,
    );
    expect(STRIPE_STATIC_RECORDS.map(({ sourceId }) => sourceId)).toEqual(
      Object.keys(STRIPE_PRICE_IDS).sort(),
    );
    expect(
      STRIPE_STATIC_RECORDS.find(
        ({ sourceId }) => sourceId === "ls_website_build_premium_v1",
      ),
    ).toMatchObject({
      source: "stripe_static",
      recordKind: "service",
      productKey: "website-build",
      stripePriceMapped: true,
      stripeLookupKey: "ls_website_build_premium_v1",
      claim: null,
    });
    expect(
      JSON.stringify(STRIPE_STATIC_RECORDS),
    ).not.toContain("price_1");
  });
});

describe("marketing and Terms claim adapter", () => {
  it("keeps software-only and no-managed-ads claims visible", () => {
    expect(
      MARKETING_CLAIM_RECORDS.find(
        ({ sourceId }) => sourceId === "terms.software-only",
      ),
    ).toMatchObject({
      source: "terms",
      commercialState: "active",
      evidencePath: "lib/copy/product-claims.ts",
      customerVisible: true,
    });
    expect(
      MARKETING_CLAIM_RECORDS.find(
        ({ sourceId }) => sourceId === "terms.no-managed-advertising",
      )?.claim,
    ).toContain("does not bill or manage ad spend");
  });

  it("keeps conflicting managed-ads, creative, and universal claims visible", () => {
    const byId = new Map(
      MARKETING_CLAIM_RECORDS.map((record) => [record.sourceId, record]),
    );

    expect(byId.get("features.ads.managed-end-to-end")?.claim).toContain(
      "managed end-to-end",
    );
    expect(byId.get("features.ads.managed-end-to-end")?.claim).toBe(
      MANAGED_ADS_DESCRIPTION,
    );
    expect(byId.get("features.ads.weekly-creative-refresh")?.claim).toContain(
      "weekly creative refresh",
    );
    expect(byId.get("features.ads.weekly-creative-refresh")?.claim).toBe(
      ADS_CREATIVE_REFRESH_CLAIM,
    );
    expect(byId.get("home.hero.universal-attribution")?.claim).toContain(
      "every ad dollar",
    );
    expect(byId.get("features.ads.universal-attribution")?.claim).toContain(
      "Every dollar mapped to a signed lease",
    );
    expect(byId.get("features.ads.universal-attribution")?.claim).toBe(
      ADS_ATTRIBUTION_HEADLINE,
    );
    expect(byId.get("home.faq.every-major-pms")?.claim).toContain(
      "Every major PMS",
    );
  });

  it("points every customer-facing claim to a local source containing it", () => {
    for (const record of MARKETING_CLAIM_RECORDS) {
      expect(record.claim).not.toBeNull();
      const source = fs.readFileSync(
        path.resolve(process.cwd(), record.evidencePath),
        "utf8",
      );
      expect(source).toContain(record.claim as string);
    }
  });

  it("keeps live marketing and Terms pages bound to shared claim constants", () => {
    const bindings = [
      ["app/(platform)/features/ads/page.tsx", "MANAGED_ADS_DESCRIPTION"],
      ["app/(platform)/features/page.tsx", "ADS_ATTRIBUTION_HEADLINE"],
      ["app/(platform)/features/page.tsx", "ADS_CREATIVE_REFRESH_CLAIM"],
      ["app/(platform)/terms/page.tsx", "TERMS_SOFTWARE_SERVICE_CLAIM"],
      ["app/(platform)/terms/page.tsx", "TERMS_AD_SPEND_BOUNDARY_CLAIM"],
    ] as const;

    for (const [sourcePath, constantName] of bindings) {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), sourcePath),
        "utf8",
      );
      expect(source).toContain(constantName);
    }
  });
});

describe("adapter safety boundary", () => {
  it("does not reach live or mutating infrastructure", () => {
    const joined = adapterSources.join("\n");
    expect(joined).not.toMatch(/@\/lib\/db|prisma|@\/lib\/stripe|feature-stripe/);
    expect(joined).not.toMatch(/\bfetch\s*\(|process\.env|server-only/);
    expect(joined).not.toMatch(/syncAllFeaturePricesToStripe|ensureCatalogSeeded/);
  });

  it("freezes every normalized collection", () => {
    for (const records of [
      BILLING_FEATURE_RECORDS,
      BILLING_CATALOG_RECORDS,
      ENTITLEMENT_RECORDS,
      STRIPE_STATIC_RECORDS,
      MARKETING_CLAIM_RECORDS,
    ]) {
      expect(Object.isFrozen(records)).toBe(true);
      expect(records.every(Object.isFrozen)).toBe(true);
    }
  });
});
