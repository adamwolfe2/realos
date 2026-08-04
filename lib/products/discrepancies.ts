import type { NormalizedProductSourceRecord } from "@/lib/products/adapters";
import { UNSUPPORTED_CLAIM_POLICIES } from "@/lib/products/policies";
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
): ProductTruthFinding {
  return Object.freeze({
    id: `${code}:${record.source}:${record.sourceId}`,
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
    const requiresPriceProof =
      record.customerVisible &&
      record.selfServe &&
      record.commercialState === "sellable" &&
      (record.priceCents ?? 0) > 0;
    if (!requiresPriceProof || record.stripePriceMapped) continue;
    const missingLookup = !record.stripeLookupKey;
    findings.push(
      finding(
        missingLookup ? "missing_stripe_mapping" : "stripe_mapping_unverified",
        missingLookup ? "critical" : "warning",
        "billing",
        record,
        missingLookup
          ? "Sellable self-serve product has no Stripe lookup key."
          : "A lookup key is declared but its live DB-backed Price mapping is unverified.",
      ),
    );
  }
}

function addClaimFindings(
  records: readonly NormalizedProductSourceRecord[],
  findings: MutableFindings,
): void {
  for (const record of records) {
    const policy = UNSUPPORTED_CLAIM_POLICIES[record.sourceId];
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
    const priced = records.filter(
      (record) =>
        record.productKey === product.key &&
        record.customerVisible &&
        record.selfServe &&
        (record.priceCents ?? 0) > 0,
    );
    const prices = [...new Set(priced.map((record) => record.priceCents))];
    if (prices.length < 2) continue;
    const record = priced[0];
    findings.push(
      finding(
        "price_drift",
        "warning",
        "billing",
        record,
        `${product.name} has multiple self-serve prices: ${prices.join(", ")}.`,
      ),
    );
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
  addServiceFindings(records, products, findings);
  addStripeFindings(records, findings);
  addClaimFindings(records, findings);
  addEntitlementFindings(registry, records, findings);
  addPriceFindings(registry, records, findings);

  return Object.freeze([...findings].sort(compareFindings));
}
