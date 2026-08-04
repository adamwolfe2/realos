import type {
  LegacyModuleKey,
  ProductSource,
} from "@/lib/products/types";

export type ProductSourceRecordKind =
  | "product"
  | "tier"
  | "addon"
  | "service"
  | "claim"
  | "entitlement";

export type ProductCommercialState =
  | "sellable"
  | "included"
  | "withheld"
  | "coming"
  | "concierge"
  | "active"
  | "inactive"
  | "internal";

export type ProductBillingCadence = "monthly" | "annual" | "metered" | "one_time";

export type NormalizedProductSourceRecord = Readonly<{
  source: ProductSource;
  sourceId: string;
  label: string;
  recordKind: ProductSourceRecordKind;
  commercialState: ProductCommercialState;
  productKey: string | null;
  legacyModuleKeys: readonly LegacyModuleKey[];
  priceCents: number | null;
  billingCadence: ProductBillingCadence | null;
  stripeLookupKey: string | null;
  stripePriceMapped: boolean;
  customerVisible: boolean;
  selfServe: boolean;
  claim: string | null;
  evidencePath: string;
}>;

export function defineProductSourceRecords(
  records: readonly NormalizedProductSourceRecord[],
): readonly NormalizedProductSourceRecord[] {
  return Object.freeze(
    records.map((record) =>
      Object.freeze({
        ...record,
        legacyModuleKeys: Object.freeze([...record.legacyModuleKeys]),
      }),
    ),
  );
}
