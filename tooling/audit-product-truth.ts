import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { ALL_PRODUCT_SOURCE_RECORDS } from "../lib/products/adapters";
import { analyzeProductTruth } from "../lib/products/discrepancies";
import { PRODUCT_REGISTRY } from "../lib/products/registry";
import {
  buildProductTruthReport,
  renderProductTruthJson,
  renderProductTruthMarkdown,
} from "../lib/products/report";

const AUDIT_DIRECTORY = fileURLToPath(
  new URL("../docs/audits/", import.meta.url),
);
const MARKDOWN_OUTPUT = new URL(
  "../docs/audits/2026-08-04-product-truth-baseline.md",
  import.meta.url,
);
const JSON_OUTPUT = new URL(
  "../docs/audits/2026-08-04-product-truth-baseline.json",
  import.meta.url,
);

async function writeProductTruthAudit(): Promise<void> {
  const findings = analyzeProductTruth(
    PRODUCT_REGISTRY,
    ALL_PRODUCT_SOURCE_RECORDS,
  );
  const report = buildProductTruthReport({
    registry: PRODUCT_REGISTRY,
    records: ALL_PRODUCT_SOURCE_RECORDS,
    findings,
  });

  await mkdir(AUDIT_DIRECTORY, { recursive: true });
  await Promise.all([
    writeFile(MARKDOWN_OUTPUT, renderProductTruthMarkdown(report), "utf8"),
    writeFile(JSON_OUTPUT, renderProductTruthJson(report), "utf8"),
  ]);
}

writeProductTruthAudit().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown audit error";
  process.stderr.write(`Product truth audit failed: ${message}\n`);
  process.exitCode = 1;
});
