import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Slice: reports-pdf (2026-07-01). The report detail page injects a print
// <style> as a direct child of .report-page. The @media print reset
// "display: block !important" on `.report-page > *` was ALSO hitting that
// <style> element, un-hiding it so its raw CSS printed as visible text — the
// "5 sheets of raw CSS in the PDF" bug. Guard the two-part fix so a refactor
// can't reintroduce the leak.
//
// 2026-07-29: the print CSS moved out of an inline <style> in page.tsx and
// into the shared ReportPrintStyles component (components/portal/reports/
// report-print-styles.tsx), which both the portal report page and the
// public /r/[token] share page now render. That component is the source of
// truth for this guard.

const pagePath = path.resolve(
  __dirname,
  "../components/portal/reports/report-print-styles.tsx",
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
