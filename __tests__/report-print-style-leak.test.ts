import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Slice: reports-pdf (2026-07-01). The report detail page injects an inline
// print <style> as a direct child of .report-page. The @media print reset
// "display: block !important" on `.report-page > *` was ALSO hitting that
// <style> element, un-hiding it so its raw CSS printed as visible text — the
// "5 sheets of raw CSS in the PDF" bug. Guard the two-part fix so a refactor
// can't reintroduce the leak.

const pagePath = path.resolve(
  __dirname,
  "../app/portal/reports/[id]/page.tsx",
);
const read = () => fs.readFileSync(pagePath, "utf-8");

describe("report print/PDF — no raw-CSS-as-text leak", () => {
  it("excludes <style> from the .report-page > * display reset", () => {
    const content = read();
    expect(content).toContain(".report-page > *:not(style)");
    // The unguarded reset that caused the leak must be gone.
    expect(content).not.toMatch(/\.report-page > \*,\s*\n/);
  });

  it("force-hides any <style> element in print as a backstop", () => {
    const content = read();
    expect(content).toContain("style { display: none !important; }");
  });
});
