import {
  ADDONS,
  TIERS,
  WEBSITE_BUILDS,
} from "@/lib/billing/catalog";
import { STRIPE_PRICE_IDS } from "@/lib/billing/price-ids.generated";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";

function isStaticallyMapped(lookupKey: string): boolean {
  return lookupKey in STRIPE_PRICE_IDS;
}

export const BILLING_TIER_RECORDS = defineProductSourceRecords(
  TIERS.flatMap((tier) => [
    {
      source: "billing_catalog" as const,
      sourceId: `${tier.id}.monthly`,
      label: `${tier.productName} — monthly`,
      recordKind: "tier" as const,
      commercialState: "sellable" as const,
      productKey: null,
      legacyModuleKeys: [],
      priceCents: tier.monthly.unitAmountCents,
      billingCadence: "monthly" as const,
      stripeLookupKey: tier.monthly.lookupKey,
      stripePriceMapped: isStaticallyMapped(tier.monthly.lookupKey),
      customerVisible: true,
      selfServe: true,
      claim: tier.productDescription,
      evidencePath: "lib/billing/catalog.ts",
    },
    {
      source: "billing_catalog" as const,
      sourceId: `${tier.id}.annual`,
      label: `${tier.productName} — annual`,
      recordKind: "tier" as const,
      commercialState: "sellable" as const,
      productKey: null,
      legacyModuleKeys: [],
      priceCents: tier.annual.unitAmountCents * 12,
      billingCadence: "annual" as const,
      stripeLookupKey: tier.annual.lookupKey,
      stripePriceMapped: isStaticallyMapped(tier.annual.lookupKey),
      customerVisible: true,
      selfServe: true,
      claim: tier.productDescription,
      evidencePath: "lib/billing/catalog.ts",
    },
    {
      source: "billing_catalog" as const,
      sourceId: `${tier.id}.graduated-monthly`,
      label: `${tier.productName} — graduated monthly`,
      recordKind: "tier" as const,
      commercialState: "sellable" as const,
      productKey: null,
      legacyModuleKeys: [],
      priceCents: tier.monthly.unitAmountCents,
      billingCadence: "monthly" as const,
      stripeLookupKey: tier.graduatedMonthly.lookupKey,
      stripePriceMapped: isStaticallyMapped(tier.graduatedMonthly.lookupKey),
      customerVisible: true,
      selfServe: true,
      claim: tier.productDescription,
      evidencePath: "lib/billing/catalog.ts",
    },
    {
      source: "billing_catalog" as const,
      sourceId: `${tier.id}.graduated-annual`,
      label: `${tier.productName} — graduated annual`,
      recordKind: "tier" as const,
      commercialState: "sellable" as const,
      productKey: null,
      legacyModuleKeys: [],
      priceCents: tier.annual.unitAmountCents * 12,
      billingCadence: "annual" as const,
      stripeLookupKey: tier.graduatedAnnual.lookupKey,
      stripePriceMapped: isStaticallyMapped(tier.graduatedAnnual.lookupKey),
      customerVisible: true,
      selfServe: true,
      claim: tier.productDescription,
      evidencePath: "lib/billing/catalog.ts",
    },
  ]),
);

export const BILLING_ADDON_RECORDS = defineProductSourceRecords(
  ADDONS.map((addon) => ({
    source: "billing_catalog" as const,
    sourceId: addon.productLookupKey,
    label: addon.productName,
    recordKind: "addon" as const,
    commercialState: "sellable" as const,
    productKey:
      addon.productLookupKey === "ls_addon_reputation_pro"
        ? "reputation-rescue"
        : null,
    legacyModuleKeys: [],
    priceCents: addon.unitAmountCents,
    billingCadence:
      addon.billingMode === "metered"
        ? ("metered" as const)
        : ("monthly" as const),
    stripeLookupKey: addon.priceLookupKey,
    stripePriceMapped: isStaticallyMapped(addon.priceLookupKey),
    customerVisible: true,
    selfServe: true,
    claim: addon.productDescription,
    evidencePath: "lib/billing/catalog.ts",
  })),
);

export const WEBSITE_BUILD_RECORDS = defineProductSourceRecords(
  WEBSITE_BUILDS.map((build) => ({
    source: "billing_catalog" as const,
    sourceId: build.id,
    label: build.productName,
    recordKind: "service" as const,
    commercialState: "concierge" as const,
    productKey: "website-build",
    legacyModuleKeys: [],
    priceCents: build.unitAmountCents,
    billingCadence: "one_time" as const,
    stripeLookupKey: build.priceLookupKey,
    stripePriceMapped: isStaticallyMapped(build.priceLookupKey),
    customerVisible: true,
    selfServe: false,
    claim: build.productDescription,
    evidencePath: "lib/billing/catalog.ts",
  })),
);

export const BILLING_CATALOG_RECORDS = defineProductSourceRecords([
  ...BILLING_TIER_RECORDS,
  ...BILLING_ADDON_RECORDS,
  ...WEBSITE_BUILD_RECORDS,
]);
