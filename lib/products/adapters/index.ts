import { BILLING_FEATURE_RECORDS } from "@/lib/products/adapters/billing-features";
import { BILLING_CATALOG_RECORDS } from "@/lib/products/adapters/billing-tiers";
import { ENTITLEMENT_RECORDS } from "@/lib/products/adapters/entitlements";
import { MARKETING_CLAIM_RECORDS } from "@/lib/products/adapters/marketing";
import { MARKETPLACE_SOURCE_RECORDS } from "@/lib/products/adapters/marketplace";
import { PROPOSAL_SOURCE_RECORDS } from "@/lib/products/adapters/proposals";
import { STRIPE_STATIC_RECORDS } from "@/lib/products/adapters/stripe-static";
import { defineProductSourceRecords } from "@/lib/products/adapters/types";

export const ALL_PRODUCT_SOURCE_RECORDS = defineProductSourceRecords([
  ...BILLING_FEATURE_RECORDS,
  ...BILLING_CATALOG_RECORDS,
  ...ENTITLEMENT_RECORDS,
  ...MARKETPLACE_SOURCE_RECORDS,
  ...PROPOSAL_SOURCE_RECORDS,
  ...STRIPE_STATIC_RECORDS,
  ...MARKETING_CLAIM_RECORDS,
]);

export { BILLING_FEATURE_RECORDS } from "@/lib/products/adapters/billing-features";
export {
  BILLING_ADDON_RECORDS,
  BILLING_CATALOG_RECORDS,
  BILLING_TIER_RECORDS,
  WEBSITE_BUILD_RECORDS,
} from "@/lib/products/adapters/billing-tiers";

export { ENTITLEMENT_RECORDS } from "@/lib/products/adapters/entitlements";
export { MARKETING_CLAIM_RECORDS } from "@/lib/products/adapters/marketing";
export { MARKETPLACE_SOURCE_RECORDS } from "@/lib/products/adapters/marketplace";
export { PROPOSAL_SOURCE_RECORDS } from "@/lib/products/adapters/proposals";
export { STRIPE_STATIC_RECORDS } from "@/lib/products/adapters/stripe-static";
export { defineProductSourceRecords } from "@/lib/products/adapters/types";
export type {
  NormalizedProductSourceRecord,
  ProductBillingCadence,
  ProductCommercialState,
  ProductSourceRecordKind,
} from "@/lib/products/adapters/types";
