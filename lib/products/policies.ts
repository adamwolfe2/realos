export type ClaimPolicy = Readonly<{
  severity: "critical" | "warning";
  owner: "marketing" | "product" | "legal";
  reason: string;
}>;

export const UNSUPPORTED_CLAIM_POLICIES: Readonly<Record<string, ClaimPolicy>> =
  Object.freeze({
    "marketing:features.ads.managed-end-to-end": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack is software and does not operate advertising for customers.",
    },
    "marketing:features.ads.weekly-creative-refresh": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack does not sell an ongoing creative-production service.",
    },
    "marketing:home.hero.universal-attribution": {
      severity: "critical",
      owner: "marketing",
      reason: "Attribution must disclose measured coverage and cannot promise every outcome.",
    },
    "marketing:features.ads.universal-attribution": {
      severity: "critical",
      owner: "marketing",
      reason: "Paid-media attribution cannot guarantee every dollar maps to a signed lease.",
    },
    "marketing:home.faq.every-major-pms": {
      severity: "critical",
      owner: "marketing",
      reason: "PMS support is capability-specific and several listed connectors are not live.",
    },
    "marketing:home.faq.ads-start-running": {
      severity: "critical",
      owner: "marketing",
      reason: "LeaseStack does not launch or manage customer advertising.",
    },
  });

export const PRICE_COMPARISON_POLICIES: Readonly<
  Record<string, readonly (readonly string[])[]>
> = Object.freeze({
  "ai-leasing-chatbot": Object.freeze([
    Object.freeze([
      "billing_features:moduleChatbot",
      "marketplace:ai-chatbot",
    ]),
  ]),
  "conversion-offers": Object.freeze([
    Object.freeze([
      "billing_features:modulePopups",
      "marketplace:embeddable-popups",
    ]),
  ]),
  "reputation-rescue": Object.freeze([
    Object.freeze([
      "billing_features:moduleReputation",
      "billing_catalog:ls_addon_reputation_pro",
      "marketplace:reputation-pro",
    ]),
  ]),
  "search-opportunity-engine": Object.freeze([
    Object.freeze([
      "billing_features:moduleSEO",
      "marketplace:seo-aeo",
    ]),
    Object.freeze(["billing_features:moduleMarketIntelligence"]),
  ]),
  "monday-action-brief": Object.freeze([
    Object.freeze(["billing_features:moduleInsights"]),
  ]),
});
