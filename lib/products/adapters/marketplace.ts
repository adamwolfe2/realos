import { MARKETPLACE_ENTRIES } from "@/lib/marketplace/catalog";
import {
  defineProductSourceRecords,
  type NormalizedProductSourceRecord,
  type ProductCommercialState,
} from "@/lib/products/adapters/types";
import type { LegacyModuleKey } from "@/lib/products/types";

const PRODUCT_KEY_BY_SLUG: Readonly<Record<string, string>> = Object.freeze({
  "lead-capture": "connected-data-foundation",
  "ai-chatbot": "ai-leasing-chatbot",
  "embeddable-popups": "conversion-offers",
  "seo-aeo": "search-opportunity-engine",
  reputation: "reputation-rescue",
  "reputation-pro": "reputation-rescue",
});

const LEGACY_MODULE_KEY_BY_SLUG: Readonly<
  Partial<Record<string, LegacyModuleKey>>
> = Object.freeze({
  "visitor-pixel": "modulePixel",
  "lead-capture": "moduleLeadCapture",
  "ai-chatbot": "moduleChatbot",
  "embeddable-popups": "modulePopups",
  "seo-aeo": "moduleSEO",
  "marketing-site": "moduleWebsite",
  referrals: "moduleReferrals",
  "email-nurture": "moduleEmail",
  "outbound-email": "moduleOutboundEmail",
});

function marketplaceState(
  kind: (typeof MARKETPLACE_ENTRIES)[number]["kind"],
  ready: boolean | undefined,
): ProductCommercialState {
  if (ready === false) return "withheld";
  if (kind === "included") return "included";
  if (kind === "coming") return "coming";
  if (kind === "concierge") return "concierge";
  return "sellable";
}

function normalizeMarketplaceEntry(
  entry: (typeof MARKETPLACE_ENTRIES)[number],
): NormalizedProductSourceRecord {
  const legacyModuleKey = LEGACY_MODULE_KEY_BY_SLUG[entry.slug];
  const canSelfServe = entry.kind === "toggle" || entry.kind === "addon";

  return {
    source: "marketplace",
    sourceId: entry.slug,
    label: entry.name,
    recordKind: "product",
    commercialState: marketplaceState(entry.kind, entry.ready),
    productKey: PRODUCT_KEY_BY_SLUG[entry.slug] ?? null,
    legacyModuleKeys: legacyModuleKey ? [legacyModuleKey] : [],
    priceCents: entry.monthlyPriceCents,
    billingCadence: "monthly",
    stripeLookupKey: entry.stripeLookupKey ?? null,
    // This source declares lookup keys but contains no resolved Stripe Price
    // IDs. The separate static-Stripe adapter is responsible for proving a
    // lookup key is actually mapped.
    stripePriceMapped: false,
    customerVisible: entry.hidden !== true && entry.ready !== false,
    selfServe:
      canSelfServe && entry.hidden !== true && entry.ready !== false,
    claim: entry.tagline,
    evidencePath: "lib/marketplace/catalog.ts",
  };
}

export const MARKETPLACE_SOURCE_RECORDS = defineProductSourceRecords(
  MARKETPLACE_ENTRIES.map(normalizeMarketplaceEntry),
);
