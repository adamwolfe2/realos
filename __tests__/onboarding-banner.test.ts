import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Structural tests for the onboarding banner component.
 * Verifies the file exists, exports OnboardingBanner, has 3 steps,
 * contains the correct links, has dismiss functionality, and proper
 * accessibility attributes.
 */

const BANNER_PATH = path.resolve(
  __dirname,
  "../components/onboarding-banner.tsx"
);

const content = fs.readFileSync(BANNER_PATH, "utf-8");

describe("onboarding-banner file", () => {
  it("exists", () => {
    expect(fs.existsSync(BANNER_PATH)).toBe(true);
  });

  it("exports OnboardingBanner", () => {
    expect(content).toContain("export function OnboardingBanner");
  });
});

describe("onboarding-banner steps", () => {
  it("has 3 steps (browse catalog, place order, standing orders)", () => {
    expect(content).toContain("Browse the catalog");
    expect(content).toContain("Place your first order");
    expect(content).toContain("Set up standing orders");
  });

  it("contains link to /client-portal/catalog", () => {
    expect(content).toContain("/client-portal/catalog");
  });

  it("contains link to /client-portal/standing-orders", () => {
    expect(content).toContain("/client-portal/standing-orders");
  });
});

describe("onboarding-banner dismiss functionality", () => {
  it("has a localStorage key for dismissal", () => {
    expect(content).toContain("onboarding-dismissed");
  });

  it("reads from localStorage on mount", () => {
    expect(content).toContain("localStorage.getItem");
  });

  it("writes to localStorage on dismiss", () => {
    expect(content).toContain("localStorage.setItem");
  });

  it("has a handleDismiss function", () => {
    expect(content).toContain("handleDismiss");
  });
});

describe("onboarding-banner accessibility", () => {
  it("has aria-label on the dismiss button", () => {
    expect(content).toContain('aria-label="Dismiss welcome guide"');
  });

  it("uses semantic heading for the title", () => {
    expect(content).toMatch(/<h2[\s\S]*?Welcome to your portal/);
  });

  it("dismiss button has minimum touch target", () => {
    expect(content).toContain("min-h-[44px]");
    expect(content).toContain("min-w-[44px]");
  });
});
