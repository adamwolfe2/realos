import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Slice 1a — pixel go-live onboarding clarity.
 * The wizard must (a) explain the Cursive/AudienceLab pixel PREREQUISITE up
 * front so a new client isn't blindsided, and (b) present the setup in the
 * correct ORDER (install pixel -> paste webhook -> test/auto-detect) instead
 * of only showing the webhook URL with no context. Structural test so a future
 * edit can't silently drop the onboarding guidance.
 */

const wizardPath = path.resolve(
  __dirname,
  "../components/portal/integrations/cursive-setup-wizard.tsx",
);

function readWizard(): string {
  return fs.readFileSync(wizardPath, "utf-8");
}

describe("Cursive setup wizard — onboarding clarity (Slice 1a)", () => {
  it("explains the Cursive/AudienceLab pixel prerequisite before setup", () => {
    const src = readWizard();
    expect(src).toContain("Before you start");
    expect(src).toContain("Cursive (AudienceLab) pixel");
    // Names the escape hatch when the client has no pixel yet. Whitespace-
    // tolerant: JSX word-wrap can split the phrase across lines in source.
    expect(src).toMatch(/account\s+manager/);
  });

  it("presents the configure phase as explicit ordered steps", () => {
    const src = readWizard();
    // Ordered list, gated on !verified so it disappears once live.
    expect(src).toMatch(/!state\.verified\s*\?\s*\(\s*<ol/);
    expect(src).toContain("list-decimal");
    // The three ordered anchors: install snippet, Webhooks, Test.
    expect(src).toContain("Cursive provides");
    expect(src).toContain("Webhooks");
    expect(src).toContain("Test");
  });
});
