import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Regression for PORTAL-SITES-D004: clicking a section pill in the intake
// form's nav jumped `currentSection` directly via setCurrentSection(id) with
// no scroll reset, while Back/Next (goPrev/goNext) both call
// window.scrollTo({ top: 0, ... }) after switching sections. Jumping via the
// pill nav (e.g. from a long "Style" section down to "Compliance") left the
// viewport scrolled deep into the old section's content instead of the top
// of the new one.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(
  path.join(ROOT, "components/site-engine/intake-form.tsx"),
  "utf-8",
);

function extractBalancedBlock(s: string, fromIndex: number): string {
  const start = s.indexOf("{", fromIndex);
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces");
}

describe("intake-form section pill nav — scroll to top on click", () => {
  it("goPrev/goNext both scroll to top (sanity check on the pattern we must match)", () => {
    const goNextIdx = src.indexOf("const goNext = () => {");
    const goNextBody = extractBalancedBlock(src, goNextIdx);
    expect(goNextBody).toContain('window.scrollTo({ top: 0, behavior: "smooth" })');

    const goPrevIdx = src.indexOf("const goPrev = () => {");
    const goPrevBody = extractBalancedBlock(src, goPrevIdx);
    expect(goPrevBody).toContain('window.scrollTo({ top: 0, behavior: "smooth" })');
  });

  it("the pill nav's onClick also scrolls to top when jumping sections", () => {
    const navIdx = src.indexOf('aria-label="Form sections"');
    expect(navIdx).toBeGreaterThan(-1);
    const onClickIdx = src.indexOf("onClick={", navIdx);
    expect(onClickIdx).toBeGreaterThan(-1);
    // extractBalancedBlock starting at the JSX attribute's opening `{`
    // captures the whole `{() => { ...body... }}` — both the attribute
    // brace and the arrow function's brace close together.
    const handlerBody = extractBalancedBlock(src, onClickIdx + "onClick=".length);
    expect(handlerBody).toContain("setCurrentSection(id)");
    expect(handlerBody).toContain(
      'window.scrollTo({ top: 0, behavior: "smooth" })',
    );
  });
});
