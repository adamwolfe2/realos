import { describe, expect, it } from "vitest";

import baseline from "@/docs/audits/2026-08-04-product-truth-baseline.json";
import { ALL_PRODUCT_SOURCE_RECORDS } from "@/lib/products/adapters";
import { analyzeProductTruth } from "@/lib/products/discrepancies";
import {
  PRICE_COMPARISON_POLICIES,
  UNSUPPORTED_CLAIM_POLICIES,
} from "@/lib/products/policies";
import { PRODUCT_REGISTRY } from "@/lib/products/registry";

describe("product truth regression gates", () => {
  it("keeps every canonical source reference resolvable", () => {
    const sourceIds = new Set(
      ALL_PRODUCT_SOURCE_RECORDS.map(
        (record) => `${record.source}:${record.sourceId}`,
      ),
    );
    const unresolved = PRODUCT_REGISTRY.flatMap((product) =>
      product.sourceReferences
        .filter(({ source, id }) => !sourceIds.has(`${source}:${id}`))
        .map(({ source, id }) => `${product.key}:${source}:${id}`),
    );

    expect(unresolved).toEqual([]);
  });

  it("requires every sellable billable product to have a mapped billing path", () => {
    const unsafe = PRODUCT_REGISTRY.filter(
      (product) =>
        product.readiness === "sellable" &&
        product.commercialPolicy === "billable",
    ).filter(
      (product) =>
        !ALL_PRODUCT_SOURCE_RECORDS.some(
          (record) =>
            record.productKey === product.key &&
            record.commercialState === "sellable" &&
            record.stripeLookupKey !== null,
        ),
    );

    expect(unsafe).toEqual([]);
    const billableKeys = PRODUCT_REGISTRY.filter(
      ({ commercialPolicy }) => commercialPolicy === "billable",
    ).map(({ key }) => key);
    expect(Object.keys(PRICE_COMPARISON_POLICIES)).toEqual(
      expect.arrayContaining(billableKeys),
    );
  });

  it("pins known drift and requires policy for every unsupported claim", () => {
    const findings = analyzeProductTruth(
      PRODUCT_REGISTRY,
      ALL_PRODUCT_SOURCE_RECORDS,
    );
    const unsupportedClaims = findings.filter(
      ({ code }) => code === "unsupported_claim",
    );

    expect(findings.map(({ id }) => id)).toEqual(
      baseline.findings.map(({ id }) => id),
    );
    expect(
      unsupportedClaims
        .map(({ source, sourceId }) => `${source}:${sourceId}`)
        .sort(),
    ).toEqual(Object.keys(UNSUPPORTED_CLAIM_POLICIES).sort());
  });
});
