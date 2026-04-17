import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Verifies accessibility attributes are present in key components.
 */

describe("Accessibility attributes", () => {
  it("FAQ has aria-expanded and aria-controls", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../components/faq.tsx"),
      "utf-8"
    );
    expect(content).toContain("aria-expanded");
    expect(content).toContain("aria-controls");
    expect(content).toContain('role="region"');
    expect(content).toContain("aria-labelledby");
  });

  it("ToolCard has keyboard support", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../components/tool-comparison.tsx"),
      "utf-8"
    );
    expect(content).toContain('role="button"');
    expect(content).toContain("tabIndex={0}");
    expect(content).toContain("onKeyDown");
    expect(content).toContain('"Enter"');
    expect(content).toContain('" "');
  });

  it("NavBar dropdown has ARIA and keyboard support", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../components/nav-bar.tsx"),
      "utf-8"
    );
    expect(content).toContain("aria-expanded");
    expect(content).toContain('aria-haspopup="menu"');
    expect(content).toContain('role="menu"');
    expect(content).toContain('"Escape"');
  });

  it("Mobile nav trigger has aria-label", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../components/nav-bar.tsx"),
      "utf-8"
    );
    expect(content).toContain('aria-label="Open navigation menu"');
  });

  it("ProductCard favorite button has aria-label", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../components/product-card.tsx"),
      "utf-8"
    );
    expect(content).toContain("aria-label=");
    expect(content).toContain("Remove from favorites");
    expect(content).toContain("Add to favorites");
  });
});
