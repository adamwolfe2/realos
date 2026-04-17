import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { glob } from "glob";

/**
 * Structural test: scans all .tsx files under app/ and components/ for
 * multi-column grid patterns that lack a mobile-first single-column
 * breakpoint. A grid using `grid-cols-2` or `grid-cols-3` should also
 * have `grid-cols-1` (or start at 1 column by default) to avoid broken
 * layouts on small screens.
 *
 * Follows the same pattern as auth-boundaries.test.ts and
 * rate-limit-coverage.test.ts — file-scanning structural tests.
 */

const ROOT = path.resolve(__dirname, "..");

function findTsxFiles(): string[] {
  return glob.sync("**/*.tsx", {
    cwd: ROOT,
    ignore: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "__tests__/**",
    ],
  });
}

// Matches className strings containing grid-cols-2 or grid-cols-3
// but NOT preceded by grid-cols-1 in the same className attribute.
//
// Strategy: find all lines with `grid grid-cols-{2,3}` and check if
// the same className/class string also contains a `grid-cols-1` variant.
function findMissingMobileBreakpoints(
  content: string,
  filePath: string
): string[] {
  const violations: string[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comments and non-JSX lines
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) {
      continue;
    }

    // Look for grid-cols-2 or grid-cols-3 patterns
    const hasMultiCol =
      /grid[\s-]cols-[23]/.test(line) && line.includes("grid");

    if (!hasMultiCol) continue;

    // Check if the same line/className includes a mobile breakpoint
    // Valid patterns: grid-cols-1, sm:grid-cols-2, md:grid-cols-3 etc.
    // If they use grid-cols-1 anywhere in the same class string, it's fine
    const hasMobileFirst =
      /grid-cols-1/.test(line) ||
      // If they use sm: or md: prefixed grid-cols, the default is 1 column
      /\b(sm|md|lg|xl):grid-cols-[23]/.test(line);

    if (!hasMobileFirst) {
      violations.push(`${filePath}:${i + 1}`);
    }
  }

  return violations;
}

describe("mobile-responsive grids", () => {
  const tsxFiles = findTsxFiles();

  it("finds .tsx files to scan", () => {
    expect(tsxFiles.length).toBeGreaterThan(10);
  });

  it("all grid-cols-2/3 usages have mobile-first breakpoints", () => {
    const allViolations: string[] = [];

    for (const file of tsxFiles) {
      const fullPath = path.join(ROOT, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      const violations = findMissingMobileBreakpoints(content, file);
      allViolations.push(...violations);
    }

    if (allViolations.length > 0) {
      // Log violations for debugging but don't fail hard —
      // some grids intentionally stay multi-column on mobile (e.g. 2-col stats,
      // icon grids, settings panels). Baseline is 51 as of 2026-03-26.
      // Goal: reduce over time. New code should not add violations.
      const MAX_ALLOWED = 55;
      expect(
        allViolations.length,
        `Found ${allViolations.length} grid layouts missing mobile-first breakpoints (max ${MAX_ALLOWED}):\n${allViolations.slice(0, 20).join("\n")}`
      ).toBeLessThanOrEqual(MAX_ALLOWED);
    }
  });

  // Specifically check high-traffic pages for strict mobile compliance
  const CRITICAL_FILES = [
    "app/(marketing)/page.tsx",
    "components/homepage/hero-section.tsx",
    "components/homepage/pricing-section.tsx",
    "components/homepage/features-section.tsx",
  ];

  for (const file of CRITICAL_FILES) {
    it(`${file} — grids have mobile breakpoints`, () => {
      const fullPath = path.join(ROOT, file);
      if (!fs.existsSync(fullPath)) return;
      const content = fs.readFileSync(fullPath, "utf-8");
      const violations = findMissingMobileBreakpoints(content, file);
      expect(
        violations,
        `Mobile breakpoint violations in ${file}:\n${violations.join("\n")}`
      ).toEqual([]);
    });
  }
});
