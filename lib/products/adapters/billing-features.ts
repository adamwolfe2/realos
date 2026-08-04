import {
  ALWAYS_ON_MODULE_KEYS,
  BASE_PLATFORM_CENTS,
  FEATURE_CATALOG,
  type FeatureKey,
} from "@/lib/billing/features";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";

const PRODUCT_KEY_BY_FEATURE: Readonly<Record<FeatureKey, string | null>> = {
  moduleChatbot: "ai-leasing-chatbot",
  modulePixel: null,
  moduleSEO: "search-opportunity-engine",
  moduleReputation: "reputation-rescue",
  moduleGoogleAds: null,
  moduleMetaAds: null,
  modulePopups: "conversion-offers",
  moduleCreativeStudio: null,
  moduleEmail: null,
  moduleOutboundEmail: null,
  moduleReferrals: null,
  moduleInsights: "monday-action-brief",
  moduleMarketIntelligence: "search-opportunity-engine",
  moduleAttribution: "lead-to-lease-attribution",
};

function featureLookupKey(key: string): string {
  return key === "base_platform"
    ? "ls_base_platform_monthly"
    : `ls_feat_${key}_monthly`;
}

export const BILLING_FEATURE_RECORDS = defineProductSourceRecords([
  {
    source: "billing_features",
    sourceId: "base_platform",
    label: "LeaseStack platform (base)",
    recordKind: "product",
    commercialState: "sellable",
    productKey: "connected-data-foundation",
    legacyModuleKeys: ALWAYS_ON_MODULE_KEYS,
    priceCents: BASE_PLATFORM_CENTS,
    billingCadence: "monthly",
    stripeLookupKey: featureLookupKey("base_platform"),
    stripePriceMapped: false,
    customerVisible: true,
    selfServe: true,
    claim: "Base platform fee per property per month.",
    evidencePath: "lib/billing/features.ts",
  },
  ...FEATURE_CATALOG.map((feature) => ({
    source: "billing_features" as const,
    sourceId: feature.key,
    label: feature.name,
    recordKind: "product" as const,
    commercialState: "sellable" as const,
    productKey: PRODUCT_KEY_BY_FEATURE[feature.key],
    legacyModuleKeys: [feature.key],
    priceCents: feature.monthlyCents,
    billingCadence: "monthly" as const,
    stripeLookupKey: featureLookupKey(feature.key),
    // These mappings live in database-backed feature-price rows, not in the
    // version-controlled static mapping. A static audit cannot claim success.
    stripePriceMapped: false,
    customerVisible: true,
    selfServe: true,
    claim: feature.copy,
    evidencePath: "lib/billing/features.ts",
  })),
]);
