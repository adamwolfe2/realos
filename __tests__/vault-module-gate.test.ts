import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression for PORTAL-PROPERTIES-D005: the vault page must check the
// moduleVault gate BEFORE running the credential/property/access-log
// queries, so orgs without the paid module never pay for the DB round
// trips just to render a pitch screen.

const ROOT = path.resolve(__dirname, "..");

describe("vault page — module gate ordering", () => {
  it("returns the pitch screen before the Promise.all query block", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "app/portal/vault/page.tsx"),
      "utf-8",
    );
    const gateIdx = src.indexOf("if (!moduleEnabled)");
    const queryIdx = src.indexOf("await Promise.all([");
    expect(gateIdx).toBeGreaterThan(-1);
    expect(queryIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(queryIdx);
  });
});
