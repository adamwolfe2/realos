import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the client analytics page split.
 * Verifies all 9 files exist, page.tsx imports extracted components,
 * analytics-types.ts exports interfaces, chart components contain
 * appropriate recharts elements, and all component files are 'use client'.
 */

const ANALYTICS_DIR = path.resolve(
  __dirname,
  "../app/client-portal/analytics"
);

const EXPECTED_FILES = [
  "page.tsx",
  "analytics-types.ts",
  "analytics-kpi-cards.tsx",
  "pricing-tier-card.tsx",
  "spending-chart.tsx",
  "category-breakdown.tsx",
  "order-frequency-chart.tsx",
  "order-activity-heatmap.tsx",
  "top-products.tsx",
];

describe("analytics split — file existence", () => {
  it(`has all ${EXPECTED_FILES.length} expected files`, () => {
    const missing = EXPECTED_FILES.filter(
      (f) => !fs.existsSync(path.join(ANALYTICS_DIR, f))
    );
    expect(missing).toEqual([]);
  });

  for (const file of EXPECTED_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(ANALYTICS_DIR, file))).toBe(true);
    });
  }
});

describe("analytics page.tsx imports all extracted components", () => {
  const pageContent = fs.readFileSync(
    path.join(ANALYTICS_DIR, "page.tsx"),
    "utf-8"
  );

  const IMPORTS = [
    "AnalyticsKpiCards",
    "PricingTierCard",
    "SpendingChart",
    "CategoryBreakdown",
    "OrderFrequencyChart",
    "OrderActivityHeatmap",
    "TopProducts",
  ];

  for (const name of IMPORTS) {
    it(`imports ${name}`, () => {
      expect(pageContent).toContain(name);
    });
  }

  it("imports from analytics-types", () => {
    expect(pageContent).toContain("analytics-types");
  });
});

describe("analytics-types.ts exports interfaces", () => {
  const typesContent = fs.readFileSync(
    path.join(ANALYTICS_DIR, "analytics-types.ts"),
    "utf-8"
  );

  it("exports AnalyticsData interface", () => {
    expect(typesContent).toContain("export interface AnalyticsData");
  });

  it("exports PricingTierData interface", () => {
    expect(typesContent).toContain("export interface PricingTierData");
  });
});

describe("chart components contain appropriate recharts elements", () => {
  it("spending-chart.tsx uses AreaChart / Area", () => {
    const content = fs.readFileSync(
      path.join(ANALYTICS_DIR, "spending-chart.tsx"),
      "utf-8"
    );
    expect(content).toContain("Area");
    expect(content).toContain("ResponsiveContainer");
  });

  it("category-breakdown.tsx uses PieChart / Pie", () => {
    const content = fs.readFileSync(
      path.join(ANALYTICS_DIR, "category-breakdown.tsx"),
      "utf-8"
    );
    expect(content).toContain("PieChart");
    expect(content).toContain("Pie");
  });

  it("order-frequency-chart.tsx uses LineChart / Line", () => {
    const content = fs.readFileSync(
      path.join(ANALYTICS_DIR, "order-frequency-chart.tsx"),
      "utf-8"
    );
    expect(content).toContain("LineChart");
    expect(content).toContain("Line");
  });

  it("top-products.tsx uses BarChart / Bar", () => {
    const content = fs.readFileSync(
      path.join(ANALYTICS_DIR, "top-products.tsx"),
      "utf-8"
    );
    expect(content).toContain("BarChart");
    expect(content).toContain("Bar");
  });
});

describe("analytics component files are 'use client'", () => {
  const CLIENT_FILES = [
    "analytics-kpi-cards.tsx",
    "pricing-tier-card.tsx",
    "spending-chart.tsx",
    "category-breakdown.tsx",
    "order-frequency-chart.tsx",
    "order-activity-heatmap.tsx",
    "top-products.tsx",
  ];

  for (const file of CLIENT_FILES) {
    it(`${file} has 'use client' directive`, () => {
      const content = fs.readFileSync(
        path.join(ANALYTICS_DIR, file),
        "utf-8"
      );
      expect(content).toMatch(/^['"]use client['"]/m);
    });
  }
});
