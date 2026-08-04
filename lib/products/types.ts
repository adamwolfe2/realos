import type {
  AlwaysOnModuleKey,
  FeatureKey,
} from "@/lib/billing/features";

export type ProductClassification =
  | "foundation"
  | "outcome_product"
  | "service";

export type ProductReadiness =
  | "sellable"
  | "beta"
  | "concierge"
  | "blocked"
  | "internal";

export type ProductScope = "organization" | "property" | "mixed";

export type ProductCommercialPolicy = "included" | "billable" | "service";

export type ProductSource =
  | "billing_features"
  | "billing_catalog"
  | "stripe_static"
  | "marketplace"
  | "proposal_catalog"
  | "marketing"
  | "terms";

export type LegacyModuleKey =
  | FeatureKey
  | AlwaysOnModuleKey
  | "moduleConversations";

export type ProductSourceReference = Readonly<{
  source: ProductSource;
  id: string;
}>;

export type ProductKpi = Readonly<{
  primary: string;
  supporting: readonly string[];
}>;

export type ProductDefinition = Readonly<{
  key: string;
  name: string;
  promise: string;
  classification: ProductClassification;
  readiness: ProductReadiness;
  scope: ProductScope;
  commercialPolicy: ProductCommercialPolicy;
  legacyModuleKeys: readonly LegacyModuleKey[];
  setupRequirements: readonly string[];
  activationEvidence: readonly string[];
  kpi: ProductKpi;
  degradedBehavior: string;
  sourceReferences: readonly ProductSourceReference[];
}>;
