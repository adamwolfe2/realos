import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the build-start route split.
 * Verifies all 5 new lib/build/ files exist, route.ts imports from them,
 * each extracted file exports functions, and route.ts is under 400 lines.
 */

const BUILD_LIB_DIR = path.resolve(__dirname, "../lib/build");
const ROUTE_PATH = path.resolve(
  __dirname,
  "../app/api/admin/intakes/[id]/build-start/route.ts"
);

const EXPECTED_BUILD_FILES = [
  "generate-config.ts",
  "commit-artifacts.ts",
  "provision-infrastructure.ts",
  "provision-services.ts",
  "provision-env.ts",
];

describe("build split — lib/build file existence", () => {
  for (const file of EXPECTED_BUILD_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(BUILD_LIB_DIR, file))).toBe(true);
    });
  }
});

describe("route.ts imports from extracted modules", () => {
  const routeContent = fs.readFileSync(ROUTE_PATH, "utf-8");

  it("imports generateConfig", () => {
    expect(routeContent).toContain("generateConfig");
    expect(routeContent).toContain("@/lib/build/generate-config");
  });

  it("imports commitArtifacts", () => {
    expect(routeContent).toContain("commitArtifacts");
    expect(routeContent).toContain("@/lib/build/commit-artifacts");
  });

  it("imports provisionInfrastructure", () => {
    expect(routeContent).toContain("provisionInfrastructure");
    expect(routeContent).toContain("@/lib/build/provision-infrastructure");
  });

  it("imports provisionServices", () => {
    expect(routeContent).toContain("provisionServices");
    expect(routeContent).toContain("@/lib/build/provision-services");
  });

  it("imports provisionEnv functions", () => {
    expect(routeContent).toContain("provisionAutoEnvVars");
    expect(routeContent).toContain("provisionPlaceholderEnvVars");
    expect(routeContent).toContain("@/lib/build/provision-env");
  });
});

describe("each extracted build file exports functions", () => {
  it("generate-config.ts exports generateConfig", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "generate-config.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function generateConfig");
  });

  it("commit-artifacts.ts exports commitArtifacts", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "commit-artifacts.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function commitArtifacts");
  });

  it("provision-infrastructure.ts exports provisionInfrastructure", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "provision-infrastructure.ts"),
      "utf-8"
    );
    expect(content).toContain(
      "export async function provisionInfrastructure"
    );
  });

  it("provision-services.ts exports provisionServices", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "provision-services.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function provisionServices");
  });

  it("provision-env.ts exports provisionAutoEnvVars", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "provision-env.ts"),
      "utf-8"
    );
    expect(content).toContain("export async function provisionAutoEnvVars");
  });

  it("provision-env.ts exports provisionPlaceholderEnvVars", () => {
    const content = fs.readFileSync(
      path.join(BUILD_LIB_DIR, "provision-env.ts"),
      "utf-8"
    );
    expect(content).toContain(
      "export async function provisionPlaceholderEnvVars"
    );
  });
});

describe("route.ts is under 400 lines", () => {
  it("route.ts line count is under 400", () => {
    const content = fs.readFileSync(ROUTE_PATH, "utf-8");
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThan(400);
  });
});
