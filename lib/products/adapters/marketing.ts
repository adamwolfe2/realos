import { MARKETING } from "@/lib/copy/marketing";
import {
  ADS_ATTRIBUTION_HEADLINE,
  ADS_CREATIVE_REFRESH_CLAIM,
  MANAGED_ADS_DESCRIPTION,
  TERMS_AD_SPEND_BOUNDARY_CLAIM,
  TERMS_SOFTWARE_SERVICE_CLAIM,
} from "@/lib/copy/product-claims";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";

type ClaimInput = Readonly<{
  source: "marketing" | "terms";
  sourceId: string;
  label: string;
  productKey: string | null;
  claim: string;
  evidencePath: string;
}>;

function claimRecord(input: ClaimInput) {
  return {
    ...input,
    recordKind: "claim" as const,
    commercialState: "active" as const,
    legacyModuleKeys: [],
    priceCents: null,
    billingCadence: null,
    stripeLookupKey: null,
    stripePriceMapped: false,
    customerVisible: true,
    selfServe: false,
  };
}

function faqAnswer(question: string): string {
  const item = MARKETING.home.faq.items.find((candidate) => candidate.q === question);
  if (!item) throw new Error(`Missing marketing FAQ: ${question}`);
  return item.a;
}

export const MARKETING_CLAIM_RECORDS = defineProductSourceRecords([
  claimRecord({
    source: "terms",
    sourceId: "terms.software-only",
    label: "Software-only service boundary",
    productKey: "connected-data-foundation",
    claim: TERMS_SOFTWARE_SERVICE_CLAIM,
    evidencePath: "lib/copy/product-claims.ts",
  }),
  claimRecord({
    source: "terms",
    sourceId: "terms.no-managed-advertising",
    label: "No managed advertising boundary",
    productKey: null,
    claim: TERMS_AD_SPEND_BOUNDARY_CLAIM,
    evidencePath: "lib/copy/product-claims.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "features.ads.managed-end-to-end",
    label: "Managed advertising claim",
    productKey: null,
    claim: MANAGED_ADS_DESCRIPTION,
    evidencePath: "lib/copy/product-claims.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "features.ads.weekly-creative-refresh",
    label: "Managed creative claim",
    productKey: null,
    claim: ADS_CREATIVE_REFRESH_CLAIM,
    evidencePath: "lib/copy/product-claims.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "home.hero.universal-attribution",
    label: "Universal attribution claim",
    productKey: "lead-to-lease-attribution",
    claim: MARKETING.home.hero.subhead,
    evidencePath: "lib/copy/marketing.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "features.ads.universal-attribution",
    label: "Universal paid-media attribution claim",
    productKey: "lead-to-lease-attribution",
    claim: ADS_ATTRIBUTION_HEADLINE,
    evidencePath: "lib/copy/product-claims.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "home.faq.every-major-pms",
    label: "Universal PMS support claim",
    productKey: "connected-data-foundation",
    claim: faqAnswer("What property management systems do you support?"),
    evidencePath: "lib/copy/marketing.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "home.faq.ads-start-running",
    label: "Advertising launch claim",
    productKey: null,
    claim: faqAnswer("How long from intake to live?"),
    evidencePath: "lib/copy/marketing.ts",
  }),
]);
