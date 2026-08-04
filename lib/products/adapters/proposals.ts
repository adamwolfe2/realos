import { PROPOSAL_CATALOG } from "@/lib/proposals/catalog";
import {
  defineProductSourceRecords,
  type NormalizedProductSourceRecord,
  type ProductBillingCadence,
  type ProductSourceRecordKind,
} from "@/lib/products/adapters/types";
import type { LegacyModuleKey } from "@/lib/products/types";

const PRODUCT_KEY_BY_SLUG: Readonly<Record<string, string>> = Object.freeze({
  "addon-reputation-pro": "reputation-rescue",
  "addon-keyword-trends": "search-opportunity-engine",
  "addon-aeo-boost": "search-opportunity-engine",
  "addon-chatbot-pro": "ai-leasing-chatbot",
  "addon-insights-pro": "monday-action-brief",
  "addon-integrations-pro": "connected-data-foundation",
  "addon-website-build": "website-build",
  "setup-aeo-status-report": "search-opportunity-engine",
});

const LEGACY_MODULE_KEYS_BY_SLUG: Readonly<
  Record<string, readonly LegacyModuleKey[]>
> = Object.freeze({
  "addon-reputation-pro": ["moduleReputation"],
  "addon-keyword-trends": ["moduleSEO", "moduleMarketIntelligence"],
  "addon-aeo-boost": ["moduleSEO", "moduleMarketIntelligence"],
  "addon-audience-sync": ["moduleGoogleAds", "moduleMetaAds"],
  "addon-outbound-email-engine": ["moduleOutboundEmail"],
  "addon-chatbot-pro": ["moduleChatbot", "moduleConversations"],
  "addon-cursive-pixel-pro": ["modulePixel"],
  "addon-insights-pro": ["moduleInsights"],
  "setup-aeo-status-report": ["moduleSEO", "moduleMarketIntelligence"],
  "addon-email-overage": ["moduleEmail", "moduleOutboundEmail"],
});

const STRIPE_LOOKUP_KEY_BY_SLUG: Readonly<Record<string, string>> =
  Object.freeze({
    "tier-foundation": "ls_foundation_monthly_v1",
    "tier-growth": "ls_growth_monthly_v1",
    "tier-scale": "ls_scale_monthly_v1",
    "addon-reputation-pro": "ls_reputation_pro_monthly_v1",
    "addon-white-label": "ls_white_label_monthly_v1",
    "addon-pixel-overage": "ls_pixel_overage_per_visitor_v1",
    "addon-email-overage": "ls_email_overage_per_send_v1",
  });

const SERVICE_SLUGS = new Set([
  "addon-website-build",
  "setup-kickoff-workshop",
  "setup-aeo-status-report",
  "sprint-30-day-implementation",
  "addon-white-glove-coordination",
  "addon-commercial-retainer",
  "addon-portfolio-success",
]);

const METERED_SLUGS = new Set([
  "addon-pixel-overage",
  "addon-email-overage",
]);

type ProposalSourceItem = (typeof PROPOSAL_CATALOG)[number];

function proposalRecordKind(item: ProposalSourceItem): ProductSourceRecordKind {
  if (item.kind === "TIER") return "tier";
  return SERVICE_SLUGS.has(item.slug) ? "service" : "addon";
}

function proposalCadence(item: ProposalSourceItem): ProductBillingCadence {
  if (METERED_SLUGS.has(item.slug)) return "metered";
  if (item.cadence === "ANNUAL") return "annual";
  if (item.cadence === "MONTHLY") return "monthly";
  return "one_time";
}

function normalizeProposalItem(
  item: ProposalSourceItem,
): NormalizedProductSourceRecord {
  const stripePriceMapped = Boolean(
    item.stripePriceIdMonthly || item.stripePriceIdAnnual,
  );

  return {
    source: "proposal_catalog",
    sourceId: item.slug,
    label: item.label,
    recordKind: proposalRecordKind(item),
    commercialState: item.active ? "active" : "inactive",
    productKey: PRODUCT_KEY_BY_SLUG[item.slug] ?? null,
    legacyModuleKeys: LEGACY_MODULE_KEYS_BY_SLUG[item.slug] ?? [],
    priceCents: item.defaultPriceCents,
    billingCadence: proposalCadence(item),
    stripeLookupKey: STRIPE_LOOKUP_KEY_BY_SLUG[item.slug] ?? null,
    stripePriceMapped,
    customerVisible: item.active,
    selfServe: false,
    claim: item.description,
    evidencePath: "lib/proposals/catalog.ts",
  };
}

export const PROPOSAL_SOURCE_RECORDS = defineProductSourceRecords(
  PROPOSAL_CATALOG.map(normalizeProposalItem),
);
