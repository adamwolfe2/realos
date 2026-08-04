import { MARKETING } from "@/lib/copy/marketing";
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

export const MARKETING_CLAIM_RECORDS = defineProductSourceRecords([
  claimRecord({
    source: "terms",
    sourceId: "terms.software-only",
    label: "Software-only service boundary",
    productKey: "connected-data-foundation",
    claim:
      "software-as-a-service platform that tracks leasing signals for property operators.",
    evidencePath: "app/(platform)/terms/page.tsx",
  }),
  claimRecord({
    source: "terms",
    sourceId: "terms.no-managed-advertising",
    label: "No managed advertising boundary",
    productKey: null,
    claim:
      "does not bill or manage ad spend. Advertising runs in your own ad platform accounts, on their terms; the platform only reads performance data you authorize.",
    evidencePath: "app/(platform)/terms/page.tsx",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "features.ads.managed-end-to-end",
    label: "Managed advertising claim",
    productKey: null,
    claim:
      "Geo-fenced campaigns, pixel-powered retargeting, creative studio, weekly performance reviews. Google, Meta, LinkedIn, and TikTok, managed end-to-end.",
    evidencePath: "app/(platform)/features/ads/page.tsx",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "features.ads.weekly-creative-refresh",
    label: "Managed creative claim",
    productKey: null,
    claim: "Geo-fenced campaigns per property with weekly creative refresh",
    evidencePath: "app/(platform)/features/page.tsx",
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
    claim: "Every dollar mapped to a signed lease, not an impression.",
    evidencePath: "app/(platform)/features/page.tsx",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "home.faq.every-major-pms",
    label: "Universal PMS support claim",
    productKey: "connected-data-foundation",
    claim: MARKETING.home.faq.items[0].a,
    evidencePath: "lib/copy/marketing.ts",
  }),
  claimRecord({
    source: "marketing",
    sourceId: "home.faq.ads-start-running",
    label: "Advertising launch claim",
    productKey: null,
    claim: MARKETING.home.faq.items[4].a,
    evidencePath: "lib/copy/marketing.ts",
  }),
]);
