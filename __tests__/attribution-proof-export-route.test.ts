import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = readFileSync(
  resolve(process.cwd(), "app/api/tenant/attribution/export/route.ts"),
  "utf8",
);

describe("attribution proof CSV export", () => {
  it("reuses proof filters and the scoped proof query", () => {
    expect(route).toContain("parseAttributionDateRange");
    expect(route).toContain("parseAttributionSource");
    expect(route).toContain("effectivePropertyIds");
    expect(route).toContain("getAttributionProof");
  });

  it("gates the module, records the export, and uses CSV safety helpers", () => {
    expect(route).toContain("moduleAttribution");
    expect(route).toContain("AuditAction.EXPORT");
    expect(route).toContain("buildCsv(header, rows)");
    expect(route).toContain("csvFileResponse");
  });
});
