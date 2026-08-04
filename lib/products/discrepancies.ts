import type { NormalizedProductSourceRecord } from "@/lib/products/adapters";
import {
  PRICE_COMPARISON_POLICIES,
  UNSUPPORTED_CLAIM_POLICIES,
} from "@/lib/products/policies";
import type { ProductDefinition } from "@/lib/products/types";

export type ProductTruthSeverity = "critical" | "warning" | "info";
export type ProductTruthOwner =
  | "product"
  | "engineering"
  | "billing"
  | "marketing"
  | "legal";

export type ProductTruthFinding = Readonly<{
  id: string;
  code: string;
  severity: ProductTruthSeverity;
  owner: ProductTruthOwner;
  source: string;
  sourceId: string;
  productKey: string | null;
  reason: string;
  evidencePath: string;
}>;

type MutableFindings = ProductTruthFinding[];

const SEVERITY_ORDER: Readonly<Record<ProductTruthSeverity, number>> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function finding(
  code: string,
  severity: ProductTruthSeverity,
  owner: ProductTruthOwner,
  record: NormalizedProductSourceRecord,
  reason: string,
  idSuffix?: string,
): ProductTruthFinding {
  return Object.freeze({
    id: `${code}:${record.source}:${record.sourceId}${idSuffix ? `:${idSuffix}` : ""}`,
    code,
    severity,
    owner,
    source: record.source,
    sourceId: record.sourceId,
    productKey: record.productKey,
    reason,
    evidencePath: record.evidencePath,
  });
}

function addTierEntitlementFindings(
  records: readonly NormalizedProductSourceRecord[],
  registry: readonly ProductDefinition[],
  findings: MutableFindings,
): void {
  const productsByModule = new Map<string, ProductDefinition[]>();
  for (const product of registry) {
    for (const moduleKey of product.legacyModuleKeys) {
      const products = productsByModule.get(moduleKey) ?? [];
      productsByModule.set(moduleKey, [...products, product]);
    }
  }

  const tierGroups = new Map<string, NormalizedProductSourceRecord[]>();
  for (const record of records) {
    if (record.recordKind !== "tier" || !record.selfServe) continue;
    const family = record.sourceId.split(".")[0];
    const identity = `${record.source}:${family}`;
    const grouped = tierGroups.get(identity) ?? [];
    tierGroups.set(identity, [...grouped, record]);
  }

  for (const [, group] of [...tierGroups].sort(([a], [b]) => a.localeCompare(b))) {
    const sortedGroup = [...group].sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId),
    );
    const record = sortedGroup[0];
    const moduleKeys = [
      ...new Set(sortedGroup.flatMap((item) => item.legacyModuleKeys)),
    ].sort();
    const reportedProducts = new Set<string>();
    for (const moduleKey of moduleKeys) {
      const products = productsByModule.get(moduleKey) ?? [];
      if (products.length === 0) {
        findings.push(
          finding(
            "tier_unsupported_entitlement",
            "critical",
            "product",
            record,
            `The ${record.sourceId.split(".")[0]} tier family grants unsupported entitlement ${moduleKey} across billing variants.`,
            moduleKey,
          ),
        );
      }
      for (const product of products) {
        if (
          product.readiness === "sellable" ||
          reportedProducts.has(product.key)
        ) {
          continue;
        }
        findings.push(
          Object.freeze({
            ...finding(
              "tier_readiness_conflict",
              "critical",
              "product",
              record,
              `${product.name} is ${product.readiness} but the ${record.sourceId.split(".")[0]} tier family grants it across billing variants.`,
              product.key,
            ),
            productKey: product.key,
          }),
        );
        reportedProducts.add(product.key);
      }
    }
  }
}

function addIdentityFindings(
  records: readonly NormalizedProductSourceRecord[],
  productKeys: ReadonlySet<string>,
  findings: MutableFindings,
): void {
  const counts = new Map<string, number>();
  const reportedDuplicates = new Set<string>();
  for (const record of records) {
    const identity = `${record.source}:${record.sourceId}`;
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
    if (record.productKey && !productKeys.has(record.productKey)) {
      findings.push(
        finding(
          "unknown_product_key",
          "critical",
          "product",
          record,
          `Source maps to unknown canonical product ${record.productKey}.`,
        ),
      );
    }
  }
  for (const record of records) {
    const identity = `${record.source}:${record.sourceId}`;
    if ((counts.get(identity) ?? 0) > 1 && !reportedDuplicates.has(identity)) {
      findings.push(
        finding(
          "duplicate_source_identifier",
          "critical",
          "engineering",
          record,
          `Source identifier ${identity} appears more than once.`,
        ),
      );
      reportedDuplicates.add(identity);
    }
  }
}

function addCommercialFindings(
  records: readonly NormalizedProductSourceRecord[],
  products: ReadonlyMap<string, ProductDefinition>,
  findings: MutableFindings,
): void {
  for (const record of records) {
    const product = record.productKey ? products.get(record.productKey) : undefined;
    const openlySold = record.customerVisible && record.selfServe;
    if (!product && openlySold && record.recordKind !== "tier") {
      findings.push(
        finding(
          "unsupported_self_serve_product",
          "critical",
          "product",
          record,
          "Customer-visible self-serve product has no approved canonical contract.",
        ),
      );
    } else if (!product && record.customerVisible && record.recordKind !== "tier") {
      findings.push(
        finding(
          "orphan_product_source",
          "warning",
          "product",
          record,
          "Customer-visible source has no approved canonical product mapping.",
        ),
      );
    }
    if (product && product.readiness !== "sellable" && openlySold) {
      findings.push(
        finding(
          "readiness_conflict",
          "critical",
          "product",
          record,
          `${product.name} is ${product.readiness} but this source sells it self-serve.`,
        ),
      );
    }
  }
}

function addServiceFindings(
  records: readonly NormalizedProductSourceRecord[],
  products: ReadonlyMap<string, ProductDefinition>,
  findings: MutableFindings,
): void {
  for (const record of records) {
    const product = record.productKey ? products.get(record.productKey) : undefined;
    if (product?.classification !== "service") continue;
    if (record.legacyModuleKeys.length > 0) {
      findings.push(
        finding(
          "service_entitlement_conflict",
          "critical",
          "product",
          record,
          "Service product cannot grant software module entitlements.",
        ),
      );
    }
    if (record.selfServe) {
      findings.push(
        finding(
          "service_self_serve_conflict",
          "critical",
          "product",
          record,
          "Concierge service cannot be presented as self-serve software.",
        ),
      );
    }
  }
}

function addStripeFindings(
  records: readonly NormalizedProductSourceRecord[],
  findings: MutableFindings,
): void {
  for (const record of records) {
    if (
      record.source === "stripe_static" &&
      record.recordKind === "product" &&
      record.productKey === null
    ) {
      findings.push(
        finding(
          "unclassified_stripe_mapping",
          "warning",
          "billing",
          record,
          "Static Stripe lookup key has no canonical product classification.",
        ),
      );
    }
    const requiresPriceProof =
      record.customerVisible &&
      record.selfServe &&
      record.commercialState === "sellable" &&
      (record.priceCents ?? 0) > 0;
    if (!requiresPriceProof || record.stripePriceMapped) continue;
    const missingLookup = !record.stripeLookupKey;
    if (missingLookup) {
      findings.push(
        finding(
          "missing_stripe_mapping",
          "critical",
          "billing",
          record,
          "Sellable self-serve product has no Stripe lookup key.",
        ),
      );
      continue;
    }
    findings.push(
      finding(
        "stripe_live_verification_deferred",
        "info",
        "billing",
        record,
        `Lookup key ${record.stripeLookupKey} requires separate live Stripe reconciliation.`,
      ),
    );
  }
}

function addClaimFindings(
  records: readonly NormalizedProductSourceRecord[],
  findings: MutableFindings,
): void {
  for (const record of records) {
    const policy =
      UNSUPPORTED_CLAIM_POLICIES[`${record.source}:${record.sourceId}`];
    if (!policy) continue;
    findings.push(
      finding(
        "unsupported_claim",
        policy.severity,
        policy.owner,
        record,
        policy.reason,
      ),
    );
  }
}

function addEntitlementFindings(
  registry: readonly ProductDefinition[],
  records: readonly NormalizedProductSourceRecord[],
  findings: MutableFindings,
): void {
  for (const product of registry) {
    const mapped = records.filter((record) => record.productKey === product.key);
    const evidence = new Set(
      mapped
        .filter((record) => record.recordKind === "entitlement")
        .flatMap((record) => record.legacyModuleKeys),
    );
    const missing = product.legacyModuleKeys.filter((key) => !evidence.has(key));
    if (missing.length === 0) continue;
    findings.push(
      Object.freeze({
        id: `missing_entitlement_evidence:registry:${product.key}`,
        code: "missing_entitlement_evidence",
        severity: "critical",
        owner: "engineering",
        source: "registry",
        sourceId: product.key,
        productKey: product.key,
        reason: `No normalized entitlement evidence for: ${missing.join(", ")}.`,
        evidencePath: "lib/products/registry.ts",
      }),
    );
  }
}

function addPriceFindings(
  registry: readonly ProductDefinition[],
  records: readonly NormalizedProductSourceRecord[],
  findings: MutableFindings,
): void {
  for (const product of registry) {
    if (product.commercialPolicy !== "billable") continue;
    const comparisonGroups = PRICE_COMPARISON_POLICIES[product.key];
    if (!comparisonGroups) {
      findings.push(
        Object.freeze({
          id: `missing_price_comparison_policy:registry:${product.key}`,
          code: "missing_price_comparison_policy",
          severity: "warning",
          owner: "billing",
          source: "registry",
          sourceId: product.key,
          productKey: product.key,
          reason: `${product.name} has no approved price comparison policy.`,
          evidencePath: "lib/products/policies.ts",
        }),
      );
      continue;
    }
    const allComparableIdentities = new Set(comparisonGroups.flat());
    const unclassified = records.filter(
      (record) =>
        record.productKey === product.key &&
        record.customerVisible &&
        record.selfServe &&
        (record.priceCents ?? 0) > 0 &&
        !allComparableIdentities.has(`${record.source}:${record.sourceId}`),
    );
    for (const record of unclassified) {
      findings.push(
        finding(
          "unclassified_price_source",
          "warning",
          "billing",
          record,
          `${product.name} price ${record.priceCents} is outside every approved comparison group.`,
        ),
      );
    }
    comparisonGroups.forEach((group, index) => {
      const comparableIdentities = new Set(group);
      const priced = records.filter(
        (record) =>
          record.productKey === product.key &&
          comparableIdentities.has(`${record.source}:${record.sourceId}`) &&
          record.customerVisible &&
          record.selfServe &&
          (record.priceCents ?? 0) > 0,
      );
      const prices = [...new Set(priced.map((record) => record.priceCents))];
      if (prices.length < 2) return;
      findings.push(
        finding(
          "price_drift",
          "warning",
          "billing",
          priced[0],
          `${product.name} has multiple self-serve prices: ${prices.join(", ")}.`,
          `group-${index + 1}`,
        ),
      );
    });
  }
}

function compareFindings(a: ProductTruthFinding, b: ProductTruthFinding): number {
  return (
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    a.code.localeCompare(b.code) ||
    a.source.localeCompare(b.source) ||
    a.sourceId.localeCompare(b.sourceId) ||
    a.id.localeCompare(b.id)
  );
}

export function analyzeProductTruth(
  registry: readonly ProductDefinition[],
  records: readonly NormalizedProductSourceRecord[],
): readonly ProductTruthFinding[] {
  const findings: MutableFindings = [];
  const products = new Map(registry.map((product) => [product.key, product]));
  const productKeys = new Set(products.keys());

  addIdentityFindings(records, productKeys, findings);
  addCommercialFindings(records, products, findings);
  addTierEntitlementFindings(records, registry, findings);
  addServiceFindings(records, products, findings);
  addStripeFindings(records, findings);
  addClaimFindings(records, findings);
  addEntitlementFindings(registry, records, findings);
  addPriceFindings(registry, records, findings);

  return Object.freeze([...findings].sort(compareFindings));
}
