import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product truth audit CLI", () => {
  it("executes successfully in the repository module format", () => {
    const baselinePath =
      "docs/audits/2026-08-04-product-truth-baseline.json";
    const before = statSync(baselinePath, { bigint: true }).mtimeNs;
    const result = spawnSync(
      "./node_modules/.bin/tsx",
      ["tooling/audit-product-truth.ts", "--check"],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(statSync(baselinePath, { bigint: true }).mtimeNs).toBe(before);
  });

  it("does not import live data, billing, or environment clients", () => {
    const source = readFileSync("tooling/audit-product-truth.ts", "utf8");

    expect(source).not.toMatch(/@\/lib\/db|prisma|stripe|fetch\(|process\.env/i);
  });
});
