import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Run with: ./node_modules/.bin/tsx tooling/audit-product-truth.ts

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

function createRenderedAudit(): Readonly<{
  markdown: string;
  json: string;
}> {
  const findings = analyzeProductTruth(
    PRODUCT_REGISTRY,
    ALL_PRODUCT_SOURCE_RECORDS,
  );
  const report = buildProductTruthReport({
    registry: PRODUCT_REGISTRY,
    records: ALL_PRODUCT_SOURCE_RECORDS,
    findings,
  });

  return Object.freeze({
    markdown: renderProductTruthMarkdown(report),
    json: renderProductTruthJson(report),
  });
}

async function runProductTruthAudit(): Promise<void> {
  const rendered = createRenderedAudit();
  if (process.argv.includes("--check")) {
    const [markdown, json] = await Promise.all([
      readFile(MARKDOWN_OUTPUT, "utf8"),
      readFile(JSON_OUTPUT, "utf8"),
    ]);
    if (markdown !== rendered.markdown || json !== rendered.json) {
      throw new Error("Committed product truth baseline is stale.");
    }
    return;
  }

  await mkdir(AUDIT_DIRECTORY, { recursive: true });
  await writeFile(JSON_OUTPUT, rendered.json, "utf8");
  await writeFile(MARKDOWN_OUTPUT, rendered.markdown, "utf8");
}

runProductTruthAudit().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown audit error";
  process.stderr.write(`Product truth audit failed: ${message}\n`);
  process.exitCode = 1;
});
