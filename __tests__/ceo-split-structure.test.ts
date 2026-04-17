import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the CEO dashboard split.
 * Verifies all extracted component files exist, page.tsx imports them,
 * kpi-cards.tsx contains KPI-related content, files are under 300 lines,
 * and server components don't have 'use client'.
 */

const CEO_DIR = path.resolve(__dirname, "../app/admin/ceo");

const EXPECTED_FILES = [
  "page.tsx",
  "kpi-cards.tsx",
  "top-clients-table.tsx",
  "churn-risk-table.tsx",
  "product-velocity-table.tsx",
];

describe("CEO dashboard split — file existence", () => {
  for (const file of EXPECTED_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(CEO_DIR, file))).toBe(true);
    });
  }
});

describe("CEO page.tsx imports all extracted components", () => {
  const pageContent = fs.readFileSync(path.join(CEO_DIR, "page.tsx"), "utf-8");

  const IMPORTS = [
    "KpiCards",
    "TopClientsTable",
    "ChurnRiskTable",
    "ProductVelocityTable",
  ];

  for (const name of IMPORTS) {
    it(`imports ${name}`, () => {
      expect(pageContent).toContain(name);
    });
  }

  it("renders all extracted components in JSX", () => {
    expect(pageContent).toContain("<KpiCards");
    expect(pageContent).toContain("<TopClientsTable");
    expect(pageContent).toContain("<ChurnRiskTable");
    expect(pageContent).toContain("<ProductVelocityTable");
  });
});

describe("kpi-cards.tsx contains KPI-related content", () => {
  const kpiContent = fs.readFileSync(
    path.join(CEO_DIR, "kpi-cards.tsx"),
    "utf-8"
  );

  it("exports KpiCards", () => {
    expect(kpiContent).toContain("export function KpiCards");
  });

  it("contains revenue-related content", () => {
    expect(kpiContent).toMatch(/revenue/i);
  });

  it("contains KPI card structure", () => {
    expect(kpiContent).toContain("Card");
  });
});

describe("extracted CEO component files are under 300 lines", () => {
  const EXTRACTED_FILES = [
    "kpi-cards.tsx",
    "top-clients-table.tsx",
    "churn-risk-table.tsx",
    "product-velocity-table.tsx",
  ];

  for (const file of EXTRACTED_FILES) {
    it(`${file} is under 300 lines`, () => {
      const content = fs.readFileSync(path.join(CEO_DIR, file), "utf-8");
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThan(300);
    });
  }
});

describe("CEO server components do not have 'use client'", () => {
  it("page.tsx does not have 'use client'", () => {
    const content = fs.readFileSync(path.join(CEO_DIR, "page.tsx"), "utf-8");
    expect(content).not.toMatch(/^['"]use client['"]/m);
  });
});
