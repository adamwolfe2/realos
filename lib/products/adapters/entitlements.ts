import {
  ALWAYS_ON_MODULE_KEYS,
  FEATURE_CATALOG,
  type FeatureKey,
} from "@/lib/billing/features";
import { TIERS } from "@/lib/billing/catalog";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";
import type { LegacyModuleKey } from "@/lib/products/types";

const PRODUCT_KEY_BY_MODULE: Readonly<
  Partial<Record<LegacyModuleKey, string>>
> = {
  moduleWebsite: "connected-data-foundation",
  moduleLeadCapture: "connected-data-foundation",
  moduleChatbot: "ai-leasing-chatbot",
  moduleConversations: "ai-leasing-chatbot",
  moduleSEO: "search-opportunity-engine",
  moduleMarketIntelligence: "search-opportunity-engine",
  moduleReputation: "reputation-rescue",
  modulePopups: "conversion-offers",
  moduleInsights: "monday-action-brief",
  moduleAttribution: "lead-to-lease-attribution",
};

function productKeyForModule(moduleKey: LegacyModuleKey): string | null {
  return PRODUCT_KEY_BY_MODULE[moduleKey] ?? null;
}

const baseEntitlements = ALWAYS_ON_MODULE_KEYS.map((moduleKey) => ({
  source: "billing_features" as const,
  sourceId: `base_platform.${moduleKey}`,
  label: `Base platform includes ${moduleKey}`,
  recordKind: "entitlement" as const,
  commercialState: "included" as const,
  productKey: productKeyForModule(moduleKey),
  legacyModuleKeys: [moduleKey],
  priceCents: null,
  billingCadence: null,
  stripeLookupKey: null,
  stripePriceMapped: false,
  customerVisible: false,
  selfServe: true,
  claim: `${moduleKey} is always enabled by the base platform.`,
  evidencePath: "lib/billing/features.ts",
}));

const selectionEntitlements = FEATURE_CATALOG.map((feature) => ({
  source: "billing_features" as const,
  sourceId: `selection.${feature.key}`,
  label: `${feature.name} selection entitlement`,
  recordKind: "entitlement" as const,
  commercialState: "included" as const,
  productKey: productKeyForModule(feature.key),
  legacyModuleKeys: [feature.key],
  priceCents: null,
  billingCadence: null,
  stripeLookupKey: null,
  stripePriceMapped: false,
  customerVisible: false,
  selfServe: true,
  claim: `Selecting ${feature.key} enables exactly that module.`,
  evidencePath: "lib/billing/features.ts",
}));

const chatbotCompanionEntitlement = {
  source: "billing_features" as const,
  sourceId: "selection.moduleConversations",
  label: "Chatbot conversation-reader companion",
  recordKind: "entitlement" as const,
  commercialState: "included" as const,
  productKey: "ai-leasing-chatbot",
  legacyModuleKeys: ["moduleConversations" as const],
  priceCents: null,
  billingCadence: null,
  stripeLookupKey: null,
  stripePriceMapped: false,
  customerVisible: false,
  selfServe: true,
  claim: "Selecting moduleChatbot also enables moduleConversations.",
  evidencePath: "lib/billing/features.ts",
};

const tierEntitlements = TIERS.flatMap((tier) =>
  Object.entries(tier.modules)
    .filter(([, enabled]) => enabled)
    .map(([rawModuleKey]) => {
      const moduleKey = rawModuleKey as FeatureKey | "moduleWebsite" | "moduleLeadCapture";
      return {
        source: "billing_catalog" as const,
        sourceId: `${tier.id}.${moduleKey}`,
        label: `${tier.productName} includes ${moduleKey}`,
        recordKind: "entitlement" as const,
        commercialState: "included" as const,
        productKey: productKeyForModule(moduleKey),
        legacyModuleKeys: [moduleKey],
        priceCents: null,
        billingCadence: null,
        stripeLookupKey: null,
        stripePriceMapped: false,
        customerVisible: false,
        selfServe: true,
        claim: `${tier.tier} grants ${moduleKey}.`,
        evidencePath: "lib/billing/catalog.ts",
      };
    }),
);

export const ENTITLEMENT_RECORDS = defineProductSourceRecords([
  ...baseEntitlements,
  ...selectionEntitlements,
  chatbotCompanionEntitlement,
  ...tierEntitlements,
  {
    source: "billing_catalog",
    sourceId: "custom",
    label: "Custom tier manual entitlements",
    recordKind: "entitlement",
    commercialState: "concierge",
    productKey: null,
    legacyModuleKeys: [],
    priceCents: null,
    billingCadence: null,
    stripeLookupKey: null,
    stripePriceMapped: false,
    customerVisible: false,
    selfServe: false,
    claim: "CUSTOM tier entitlements are managed manually.",
    evidencePath: "lib/billing/catalog.ts",
  },
]);
