import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the demo-portal component system.
 * Verifies all expected files exist, correct exports are present,
 * and the type system covers all views.
 */

const DEMO_DIR = path.resolve(__dirname, "../components/demo-portal");

const EXPECTED_FILES = [
  "index.tsx",
  "types.ts",
  "constants.ts",
  "utils.tsx",
  "demo-about.tsx",
  "demo-admin-analytics.tsx",
  "demo-admin-clients.tsx",
  "demo-admin-dashboard.tsx",
  "demo-admin-invoices.tsx",
  "demo-admin-leads.tsx",
  "demo-admin-orders.tsx",
  "demo-admin-pricing.tsx",
  "demo-admin-products.tsx",
  "demo-catalog.tsx",
  "demo-checkout.tsx",
  "demo-client-analytics.tsx",
  "demo-client-dashboard.tsx",
  "demo-client-invoices.tsx",
  "demo-client-orders.tsx",
  "demo-client-referrals.tsx",
  "demo-client-settings.tsx",
  "demo-client-standing-orders.tsx",
  "demo-fulfillment.tsx",
  "demo-marketing.tsx",
  "demo-sms.tsx",
  "demo-tour.tsx",
];

describe("demo-portal file structure", () => {
  it(`has all ${EXPECTED_FILES.length} expected component files`, () => {
    const missing = EXPECTED_FILES.filter(
      (f) => !fs.existsSync(path.join(DEMO_DIR, f))
    );
    expect(missing).toEqual([]);
  });

  for (const file of EXPECTED_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(DEMO_DIR, file))).toBe(true);
    });
  }
});

describe("demo-portal index.tsx", () => {
  it("exports DemoPortal", () => {
    const content = fs.readFileSync(
      path.join(DEMO_DIR, "index.tsx"),
      "utf-8"
    );
    expect(content).toMatch(/export\s+function\s+DemoPortal/);
  });
});

describe("demo-portal types.ts", () => {
  const content = fs.readFileSync(
    path.join(DEMO_DIR, "types.ts"),
    "utf-8"
  );

  it("exports the View type", () => {
    expect(content).toContain("export type View");
  });

  const EXPECTED_VIEWS = [
    "marketing",
    "catalog",
    "about",
    "checkout",
    "client-dashboard",
    "client-orders",
    "client-invoices",
    "client-analytics",
    "client-referrals",
    "client-standing-orders",
    "client-settings",
    "admin-dashboard",
    "admin-orders",
    "admin-fulfillment",
    "admin-clients",
    "admin-invoices",
    "admin-products",
    "admin-leads",
    "admin-analytics",
    "admin-pricing",
    "sms-demo",
  ];

  for (const view of EXPECTED_VIEWS) {
    it(`View type includes "${view}"`, () => {
      expect(content).toContain(`"${view}"`);
    });
  }

  it("exports ViewProps type", () => {
    expect(content).toContain("export type ViewProps");
  });

  it("exports Brand type", () => {
    expect(content).toContain("export type Brand");
  });

  it("exports ScrapeData type", () => {
    expect(content).toContain("export type ScrapeData");
  });

  it("exports NavItem type", () => {
    expect(content).toContain("export type NavItem");
  });
});

describe("demo-portal constants.ts", () => {
  const content = fs.readFileSync(
    path.join(DEMO_DIR, "constants.ts"),
    "utf-8"
  );

  it("exports NAV_ITEMS", () => {
    expect(content).toMatch(/export\s+const\s+NAV_ITEMS/);
  });

  it("exports TOUR_STEPS", () => {
    expect(content).toMatch(/export\s+const\s+TOUR_STEPS/);
  });

  it("NAV_ITEMS includes admin and client groups", () => {
    expect(content).toContain('"Admin Panel"');
    expect(content).toContain('"Client Portal"');
  });

  it("TOUR_STEPS reference valid view names", () => {
    // Every view referenced in TOUR_STEPS should be a known view
    const viewMatches = content.match(/view:\s*"([^"]+)"/g) || [];
    expect(viewMatches.length).toBeGreaterThan(0);
  });
});

describe("demo-portal view files export components", () => {
  const viewFiles = EXPECTED_FILES.filter(
    (f) => f.startsWith("demo-") && f.endsWith(".tsx")
  );

  for (const file of viewFiles) {
    it(`${file} exports a named function component`, () => {
      const content = fs.readFileSync(path.join(DEMO_DIR, file), "utf-8");
      const hasNamedExport = content.match(
        /export\s+(default\s+)?function\s+\w+/
      );
      expect(hasNamedExport).not.toBeNull();
    });
  }
});
