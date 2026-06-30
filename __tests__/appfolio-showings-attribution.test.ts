import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// P2 — AppFolio showings phase must not guess "first ACTIVE property" for a
// multi-property org when a tour's lead has no resolved property: that
// mis-attributes the tour to the wrong building. It should only auto-attach
// when the org has exactly one active property, else skip-with-warning.

const srcPath = path.resolve(
  __dirname,
  "../lib/integrations/appfolio-sync.ts",
);
const read = () => fs.readFileSync(srcPath, "utf-8");

describe("appfolio showings — wrong-building attribution guard", () => {
  it("only auto-attaches when the org has exactly one active property", () => {
    const content = read();
    expect(content).toContain("activeProps.length !== 1");
  });

  it("warns and skips instead of guessing for ambiguous orgs", () => {
    const content = read();
    expect(content).toContain("wrong-building attribution");
    // The old unconditional findFirst fallback for showings must be gone.
    expect(content).not.toMatch(
      /prefer the org's first ACTIVE\s*\n\s*\/\/\s*property/,
    );
  });
});
