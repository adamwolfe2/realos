import {
  ADDONS,
  TIERS,
  WEBSITE_BUILDS,
} from "@/lib/billing/catalog";
import { STRIPE_PRICE_IDS } from "@/lib/billing/price-ids.generated";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";
import type {
  ProductBillingCadence,
  ProductSourceRecordKind,
} from "@/lib/products/adapters/types";

type MappingMetadata = Readonly<{
  label: string;
  recordKind: ProductSourceRecordKind;
  productKey: string | null;
  cadence: ProductBillingCadence;
  customerVisible: boolean;
  selfServe: boolean;
}>;

function metadataForLookupKey(lookupKey: string): MappingMetadata {
  for (const tier of TIERS) {
    const tierPrices = [
      [tier.monthly.lookupKey, "monthly"],
      [tier.annual.lookupKey, "annual"],
      [tier.graduatedMonthly.lookupKey, "monthly"],
      [tier.graduatedAnnual.lookupKey, "annual"],
    ] as const;
    const match = tierPrices.find(([key]) => key === lookupKey);
    if (match) {
      return {
        label: `${tier.productName} — ${lookupKey}`,
        recordKind: "tier",
        productKey: null,
        cadence: match[1],
        customerVisible: true,
        selfServe: true,
      };
    }
  }

  const addon = ADDONS.find(({ priceLookupKey }) => priceLookupKey === lookupKey);
  if (addon) {
    return {
      label: addon.productName,
      recordKind: "addon",
      productKey:
        addon.productLookupKey === "ls_addon_reputation_pro"
          ? "reputation-rescue"
          : null,
      cadence: addon.billingMode === "metered" ? "metered" : "monthly",
      customerVisible: true,
      selfServe: true,
    };
  }

  const build = WEBSITE_BUILDS.find(
    ({ priceLookupKey }) => priceLookupKey === lookupKey,
  );
  if (build) {
    return {
      label: build.productName,
      recordKind: "service",
      productKey: "website-build",
      cadence: "one_time",
      customerVisible: true,
      selfServe: false,
    };
  }

  return {
    label: lookupKey,
    recordKind: "product",
    productKey: null,
    cadence: "monthly",
    customerVisible: false,
    selfServe: false,
  };
}

export const STRIPE_STATIC_RECORDS = defineProductSourceRecords(
  Object.keys(STRIPE_PRICE_IDS)
    .sort()
    .map((lookupKey) => {
      const metadata = metadataForLookupKey(lookupKey);
      return {
        source: "stripe_static" as const,
        sourceId: lookupKey,
        label: metadata.label,
        recordKind: metadata.recordKind,
        commercialState: "active" as const,
        productKey: metadata.productKey,
        legacyModuleKeys: [],
        // The generated mapping proves identity only. Price truth remains in
        // the billing catalogs, so this adapter deliberately does not merge it.
        priceCents: null,
        billingCadence: metadata.cadence,
        stripeLookupKey: lookupKey,
        stripePriceMapped: true,
        customerVisible: metadata.customerVisible,
        selfServe: metadata.selfServe,
        claim: null,
        evidencePath: "lib/billing/price-ids.generated.ts",
      };
    }),
);
