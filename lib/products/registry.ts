import type { ProductDefinition } from "@/lib/products/types";

const registryEntries: ProductDefinition[] = [
  {
    key: "connected-data-foundation",
    name: "Connected Data Foundation",
    promise:
      "Bring verified leasing, website, search, advertising, and lead signals into one property-aware system.",
    classification: "foundation",
    readiness: "sellable",
    scope: "mixed",
    commercialPolicy: "included",
    legacyModuleKeys: ["moduleWebsite", "moduleLeadCapture"],
    setupRequirements: [
      "Verified organization and property scope",
      "At least one connected source with a completed capability check",
    ],
    activationEvidence: [
      "A source produces fresh records mapped to the correct organization and property",
    ],
    kpi: {
      primary: "Verified data lanes producing fresh property-scoped records",
      supporting: ["Mapping coverage", "Sync freshness", "Rejected record rate"],
    },
    degradedBehavior:
      "Show unavailable, partial, and stale lanes explicitly without fabricating values.",
    sourceReferences: [
      { source: "billing_features", id: "base_platform" },
      { source: "marketplace", id: "lead-capture" },
    ],
  },
  {
    key: "lead-to-lease-attribution",
    name: "Lead-to-Lease Attribution",
    promise:
      "Join the strongest available evidence from first visit through signed lease and report coverage honestly.",
    classification: "foundation",
    readiness: "beta",
    scope: "mixed",
    commercialPolicy: "included",
    legacyModuleKeys: ["moduleAttribution"],
    setupRequirements: [
      "Verified lead source data",
      "A downstream application or lease signal when available",
    ],
    activationEvidence: [
      "At least one traceable journey or an explicit measured coverage result",
    ],
    kpi: {
      primary: "Percentage of qualified outcomes with defensible source evidence",
      supporting: ["Matched leads", "Matched applications", "Matched signed leases"],
    },
    degradedBehavior:
      "Label unmatched outcomes and coverage gaps instead of assigning a guessed source.",
    sourceReferences: [
      { source: "billing_features", id: "moduleAttribution" },
      { source: "marketing", id: "home.hero" },
    ],
  },
  {
    key: "ai-leasing-chatbot",
    name: "AI Leasing Chatbot",
    promise:
      "Answer property questions around the clock, qualify intent, capture contact information, and hand leads to the leasing team.",
    classification: "outcome_product",
    readiness: "sellable",
    scope: "property",
    commercialPolicy: "billable",
    legacyModuleKeys: ["moduleChatbot", "moduleConversations"],
    setupRequirements: [
      "Active property and verified domain",
      "Approved property knowledge and availability behavior",
      "Configured operator notification recipient",
    ],
    activationEvidence: [
      "A controlled conversation answers with correct property facts",
      "The conversation creates a property-scoped lead and delivers its notification",
    ],
    kpi: {
      primary: "Qualified leads captured",
      supporting: ["After-hours leads", "Lead capture rate", "Median response time"],
    },
    degradedBehavior:
      "When availability is unavailable or stale, capture a follow-up request without inventing units, pricing, or tour times.",
    sourceReferences: [
      { source: "billing_features", id: "moduleChatbot" },
      { source: "marketplace", id: "ai-chatbot" },
      { source: "marketing", id: "features.chatbot" },
    ],
  },
  {
    key: "conversion-offers",
    name: "Conversion Offers",
    promise:
      "Launch targeted property offers on any supported site and measure the incremental leads they create.",
    classification: "outcome_product",
    readiness: "beta",
    scope: "property",
    commercialPolicy: "billable",
    legacyModuleKeys: ["modulePopups"],
    setupRequirements: [
      "Verified domain and property mapping",
      "Published offer with a supported trigger and conversion action",
    ],
    activationEvidence: [
      "A test impression and conversion are recorded against the correct campaign and property",
      "A captured contact is created or associated without losing unattributed conversions",
    ],
    kpi: {
      primary: "Incremental attributed leads per offer",
      supporting: ["Impressions", "Conversion rate", "Unattributed conversions"],
    },
    degradedBehavior:
      "Keep conversions visible as unattributed when identity continuity fails and provide diagnostic context.",
    sourceReferences: [
      { source: "billing_features", id: "modulePopups" },
      { source: "marketplace", id: "embeddable-popups" },
      { source: "marketing", id: "features.popups" },
    ],
  },
  {
    key: "reputation-rescue",
    name: "Reputation Rescue",
    promise:
      "Prioritize supported reputation risks, help the operator respond, and track resolution.",
    classification: "outcome_product",
    readiness: "beta",
    scope: "property",
    commercialPolicy: "billable",
    legacyModuleKeys: ["moduleReputation"],
    setupRequirements: [
      "Verified property identity on at least one supported reputation source",
      "Successful baseline scan",
    ],
    activationEvidence: [
      "A real scan imports a supported mention and completes an action or resolution workflow",
    ],
    kpi: {
      primary: "Actionable reputation issues resolved",
      supporting: ["Median response time", "Unresolved backlog", "Source coverage"],
    },
    degradedBehavior:
      "State coverage by source and never imply direct reply support where the source does not allow it.",
    sourceReferences: [
      { source: "billing_features", id: "moduleReputation" },
      { source: "marketplace", id: "reputation" },
    ],
  },
  {
    key: "search-opportunity-engine",
    name: "Search Opportunity Engine",
    promise:
      "Turn verified search and AI-discovery gaps into property-specific actions and measure the result.",
    classification: "outcome_product",
    readiness: "beta",
    scope: "property",
    commercialPolicy: "billable",
    legacyModuleKeys: ["moduleSEO", "moduleMarketIntelligence"],
    setupRequirements: [
      "Verified search or analytics data for the property",
      "A completed baseline visibility scan",
    ],
    activationEvidence: [
      "Verified data produces a specific reviewable opportunity and records its baseline",
    ],
    kpi: {
      primary: "Qualified search opportunities acted on",
      supporting: ["Ranking movement", "Citation movement", "Organic leads"],
    },
    degradedBehavior:
      "Separate observed facts from inferred opportunities and never guarantee rankings or citations.",
    sourceReferences: [
      { source: "billing_features", id: "moduleSEO" },
      { source: "billing_features", id: "moduleMarketIntelligence" },
      { source: "marketplace", id: "seo-aeo" },
      { source: "marketing", id: "features.seo-aeo" },
    ],
  },
  {
    key: "monday-action-brief",
    name: "Monday Action Brief",
    promise:
      "Deliver a concise weekly summary of what changed and the evidence-backed actions to take next.",
    classification: "outcome_product",
    readiness: "beta",
    scope: "mixed",
    commercialPolicy: "billable",
    legacyModuleKeys: ["moduleInsights"],
    setupRequirements: [
      "Configured recipient",
      "At least one verified fresh data lane",
    ],
    activationEvidence: [
      "A scheduled brief is generated, delivered, opened, and links to valid action surfaces",
    ],
    kpi: {
      primary: "Recommended actions completed",
      supporting: ["Delivery rate", "Open rate", "Subsequent metric movement"],
    },
    degradedBehavior:
      "Name missing sources and provide setup actions without fabricating trends, causality, or dollar impact.",
    sourceReferences: [
      { source: "billing_features", id: "moduleInsights" },
      { source: "marketing", id: "features.weekly-report" },
    ],
  },
  {
    key: "website-build",
    name: "Website Build",
    promise:
      "Build a property website with LeaseStack's measurement and conversion products connected from launch.",
    classification: "service",
    readiness: "concierge",
    scope: "property",
    commercialPolicy: "service",
    legacyModuleKeys: [],
    setupRequirements: [
      "Approved scope, content, domain access, and implementation timeline",
    ],
    activationEvidence: [
      "The approved site is live on the verified domain with agreed LeaseStack products passing activation proof",
    ],
    kpi: {
      primary: "Website launched with verified measurement and lead capture",
      supporting: ["Time to launch", "Conversion rate", "Connected product coverage"],
    },
    degradedBehavior:
      "Surface customer or third-party dependencies explicitly and do not promise a launch date before inputs are verified.",
    sourceReferences: [
      { source: "billing_catalog", id: "website-build" },
      { source: "proposal_catalog", id: "addon-website-build" },
      { source: "marketing", id: "features.website-build" },
    ],
  },
];

export const PRODUCT_REGISTRY: readonly ProductDefinition[] = Object.freeze(
  registryEntries.map((product) => Object.freeze(product)),
);

export const PRODUCT_KEYS: readonly string[] = Object.freeze(
  PRODUCT_REGISTRY.map(({ key }) => key),
);

export function getProductDefinition(key: string): ProductDefinition | undefined {
  return PRODUCT_REGISTRY.find((product) => product.key === key);
}
