import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the intake wizard component system
 * (components/intake/) after it was split from a monolithic file.
 * Verifies all step files, types, and constants exist and export correctly.
 */

const INTAKE_DIR = path.resolve(__dirname, "../components/intake");

const EXPECTED_FILES = [
  "types.ts",
  "constants.ts",
  "option-button.tsx",
  "step-company.tsx",
];

describe("intake wizard file structure", () => {
  it("components/intake/ directory exists", () => {
    expect(fs.existsSync(INTAKE_DIR)).toBe(true);
  });

  for (const file of EXPECTED_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(INTAKE_DIR, file))).toBe(true);
    });
  }
});

describe("intake wizard types.ts", () => {
  const content = fs.readFileSync(
    path.join(INTAKE_DIR, "types.ts"),
    "utf-8"
  );

  it("exports Step1Data type", () => {
    expect(content).toContain("export type Step1Data");
  });

  it("exports Step2Data type", () => {
    expect(content).toContain("export type Step2Data");
  });

  it("exports Step3Data type", () => {
    expect(content).toContain("export type Step3Data");
  });

  it("Step1Data includes essential fields", () => {
    expect(content).toContain("companyName");
    expect(content).toContain("website");
    expect(content).toContain("contactEmail");
    expect(content).toContain("contactPhone");
  });

  it("Step2Data includes distribution fields", () => {
    expect(content).toContain("industry");
    expect(content).toContain("skuCount");
    expect(content).toContain("activeClients");
  });

  it("Step3Data includes customization fields", () => {
    expect(content).toContain("features");
    expect(content).toContain("primaryColor");
  });
});

describe("intake wizard constants.ts", () => {
  const content = fs.readFileSync(
    path.join(INTAKE_DIR, "constants.ts"),
    "utf-8"
  );

  const EXPECTED_EXPORTS = [
    "FEATURE_VALUES",
    "formatValue",
    "ROLES",
    "REVENUES",
    "INDUSTRIES",
    "SKU_COUNTS",
    "ORDERING_METHODS",
    "CLIENT_COUNTS",
    "ORDER_VALUES",
    "PAYMENT_TERMS",
    "DELIVERY_OPTIONS",
    "GO_LIVE_TIMELINES",
    "MINIMUM_ORDER_VALUES",
    "FEATURES",
    "STEPS",
    "DRAFT_KEY",
    "DRAFT_TTL_MS",
  ];

  for (const name of EXPECTED_EXPORTS) {
    it(`exports ${name}`, () => {
      expect(content).toContain(name);
    });
  }

  it("STEPS has 4 wizard steps", () => {
    // Verify the STEPS array definition matches expected step count
    const stepsMatch = content.match(/export\s+const\s+STEPS\s*=\s*\[([^\]]+)\]/);
    expect(stepsMatch).not.toBeNull();
    const items = stepsMatch![1].split(",").filter((s) => s.trim().length > 0);
    expect(items.length).toBe(4);
  });

  it("DRAFT_TTL_MS is 7 days in milliseconds", () => {
    // 7 * 24 * 60 * 60 * 1000 = 604800000
    expect(content).toContain("7 * 24 * 60 * 60 * 1000");
  });
});

describe("intake wizard components", () => {
  it("option-button.tsx exports OptionButton", () => {
    const content = fs.readFileSync(
      path.join(INTAKE_DIR, "option-button.tsx"),
      "utf-8"
    );
    expect(content).toContain("export function OptionButton");
  });

  it("step-company.tsx exports StepCompany", () => {
    const content = fs.readFileSync(
      path.join(INTAKE_DIR, "step-company.tsx"),
      "utf-8"
    );
    expect(content).toContain("export function StepCompany");
  });
});
