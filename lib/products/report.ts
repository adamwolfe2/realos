import type { NormalizedProductSourceRecord } from "@/lib/products/adapters";
import type {
  ProductTruthFinding,
  ProductTruthSeverity,
} from "@/lib/products/discrepancies";
import type { ProductDefinition } from "@/lib/products/types";

export type ProductTruthSummary = Readonly<
  Record<ProductTruthSeverity, number> & { total: number }
>;

export type ProductTruthReport = Readonly<{
  schemaVersion: 1;
  registryProductCount: number;
  sourceRecordCount: number;
  summary: ProductTruthSummary;
  findings: readonly ProductTruthFinding[];
}>;

type ProductTruthReportInput = Readonly<{
  registry: readonly ProductDefinition[];
  records: readonly NormalizedProductSourceRecord[];
  findings: readonly ProductTruthFinding[];
}>;

function countSeverity(
  findings: readonly ProductTruthFinding[],
  severity: ProductTruthSeverity,
): number {
  return findings.filter((finding) => finding.severity === severity).length;
}

export function buildProductTruthReport({
  registry,
  records,
  findings,
}: ProductTruthReportInput): ProductTruthReport {
  return Object.freeze({
    schemaVersion: 1,
    registryProductCount: registry.length,
    sourceRecordCount: records.length,
    summary: Object.freeze({
      critical: countSeverity(findings, "critical"),
      warning: countSeverity(findings, "warning"),
      info: countSeverity(findings, "info"),
      total: findings.length,
    }),
    findings: Object.freeze([...findings]),
  });
}

export function renderProductTruthJson(report: ProductTruthReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function renderFinding(finding: ProductTruthFinding): string[] {
  return [
    `### \`${finding.id}\``,
    "",
    `- Owner: ${finding.owner}`,
    `- Product: ${finding.productKey ?? "unmapped"}`,
    `- Source: ${finding.source} / ${finding.sourceId}`,
    `- Evidence: \`${finding.evidencePath}\``,
    `- Reason: ${finding.reason}`,
    "",
  ];
}

function renderSeveritySection(
  severity: ProductTruthSeverity,
  findings: readonly ProductTruthFinding[],
): string[] {
  const matching = findings.filter((finding) => finding.severity === severity);
  const title = severity[0].toUpperCase() + severity.slice(1);
  if (matching.length === 0) return [`## ${title}`, "", "None.", ""];
  return [
    `## ${title}`,
    "",
    ...matching.flatMap((finding) => renderFinding(finding)),
  ];
}

export function renderProductTruthMarkdown(report: ProductTruthReport): string {
  const status = report.summary.critical > 0 ? "BLOCKED" : "CLEAR";
  const lines = [
    "# LeaseStack Product Truth Baseline",
    "",
    "Generated deterministically from version-controlled product sources.",
    "No database, Stripe, environment, or external API access is used.",
    "",
    `Status: **${status}**`,
    "",
    "| Products | Source records | Critical | Warning | Info | Total |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${report.registryProductCount} | ${report.sourceRecordCount} | ${report.summary.critical} | ${report.summary.warning} | ${report.summary.info} | ${report.summary.total} |`,
    "",
    ...renderSeveritySection("critical", report.findings),
    ...renderSeveritySection("warning", report.findings),
    ...renderSeveritySection("info", report.findings),
  ];
  return `${lines.join("\n").trimEnd()}\n`;
}
