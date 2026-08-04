import { describe, expect, it } from "vitest";

import { ALL_PRODUCT_SOURCE_RECORDS } from "@/lib/products/adapters";
import { analyzeProductTruth } from "@/lib/products/discrepancies";
import { PRODUCT_REGISTRY } from "@/lib/products/registry";
import {
  buildProductTruthReport,
  renderProductTruthJson,
  renderProductTruthMarkdown,
} from "@/lib/products/report";

describe("product truth baseline report", () => {
  const findings = analyzeProductTruth(
    PRODUCT_REGISTRY,
    ALL_PRODUCT_SOURCE_RECORDS,
  );
  const report = buildProductTruthReport({
    registry: PRODUCT_REGISTRY,
    records: ALL_PRODUCT_SOURCE_RECORDS,
    findings,
  });

  it("summarizes the complete static inventory without a timestamp", () => {
    expect(report.schemaVersion).toBe(1);
    expect(report.registryProductCount).toBe(PRODUCT_REGISTRY.length);
    expect(report.sourceRecordCount).toBe(ALL_PRODUCT_SOURCE_RECORDS.length);
    expect(report.summary.total).toBe(findings.length);
    expect(report.summary.critical).toBeGreaterThan(0);
    expect(report.summary.warning).toBeGreaterThan(0);
    expect(report.summary.info).toBe(0);
    expect(report).not.toHaveProperty("generatedAt");
  });

  it("renders byte-stable JSON and Markdown with every critical finding", () => {
    const firstJson = renderProductTruthJson(report);
    const secondJson = renderProductTruthJson(report);
    const firstMarkdown = renderProductTruthMarkdown(report);
    const secondMarkdown = renderProductTruthMarkdown(report);

    expect(firstJson).toBe(secondJson);
    expect(firstMarkdown).toBe(secondMarkdown);
    expect(firstJson.endsWith("\n")).toBe(true);
    expect(firstMarkdown).toContain("# LeaseStack Product Truth Baseline");
    expect(firstMarkdown).toContain("Status: **BLOCKED**");

    for (const finding of findings.filter(
      ({ severity }) => severity === "critical",
    )) {
      expect(firstMarkdown).toContain(finding.id);
      expect(firstMarkdown).toContain(finding.evidencePath);
    }
  });
});
