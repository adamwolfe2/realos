import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Regression for PORTAL-SITES-D002 / D003: both the visual-direction-picker
// screenshot uploader and the intake form's general Assets uploader looped
// over a multi-file batch, pushing each successful upload into a local
// `next` array, but only called onChange/update(next) AFTER the loop
// finished. If file #3 of 5 failed, the thrown error skipped straight to
// the catch block and `onChange(next)` was never called — silently
// discarding the 2 uploads that had already succeeded.
//
// Fix: catch per-file inside the loop so one failure can't unwind past
// already-accumulated successes, and always commit whatever succeeded.
//
// These are structural (source-inspection) tests rather than rendered
// component tests: this repo's vitest config runs a "node" environment with
// no React Testing Library / jsdom, and only picks up __tests__/**/*.test.ts
// (not .tsx), so client component behavior here is verified the same way
// other TSX-only logic in this repo is (see push-panel / seo-content-draft
// structural tests) — by asserting on the actual source structure of the
// fix rather than re-implementing a parallel copy of the algorithm.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

/**
 * Extracts a balanced-brace block starting at the first `{` found at or
 * after `fromIndex`, by counting braces. Returns the substring including
 * both the opening and closing brace.
 */
function extractBalancedBlock(src: string, fromIndex: number): string {
  const start = src.indexOf("{", fromIndex);
  if (start === -1) throw new Error("no opening brace found");
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces");
}

function extractFunctionBody(src: string, marker: string): string {
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`marker not found: ${marker}`);
  return extractBalancedBlock(src, idx);
}

describe("visual-direction-picker ScreenshotsPanel — partial batch-upload failure", () => {
  const src = read("components/site-engine/visual-direction-picker.tsx");
  const body = extractFunctionBody(src, "const handle = async (files: FileList | null) => {");

  it("catches per-file inside the upload loop (not only once around the whole loop)", () => {
    const forIdx = body.indexOf("for (const file of Array.from(files))");
    expect(forIdx).toBeGreaterThan(-1);
    const loopBody = extractBalancedBlock(body, forIdx);
    // The fix nests a try/catch per iteration so one bad file can't abort
    // the batch and lose already-pushed successes.
    expect(loopBody).toContain("try {");
    expect(loopBody).toContain("catch (err)");
  });

  it("commits onChange(next) after the loop regardless of a mid-batch failure", () => {
    // onChange(next) must be reachable after the for-loop closes, i.e. NOT
    // solely inside a scope that a per-file throw could unwind past.
    const afterLoop = body.slice(
      body.indexOf("for (const file of Array.from(files))"),
    );
    const loopBody = extractBalancedBlock(
      afterLoop,
      afterLoop.indexOf("for (const file of Array.from(files))"),
    );
    const remainder = afterLoop.slice(afterLoop.indexOf(loopBody) + loopBody.length);
    expect(remainder).toMatch(/onChange\(next\)/);
  });
});

describe("intake-form AssetsSection — partial batch-upload failure", () => {
  const src = read("components/site-engine/intake-form.tsx");
  const body = extractFunctionBody(src, "const handleFiles = async (files: FileList | null) => {");

  it("catches per-file inside the upload loop (not only once around the whole loop)", () => {
    const forIdx = body.indexOf("for (const file of Array.from(files))");
    expect(forIdx).toBeGreaterThan(-1);
    const loopBody = extractBalancedBlock(body, forIdx);
    expect(loopBody).toContain("try {");
    expect(loopBody).toContain("catch (err)");
  });

  it("commits update(\"assets\", next) after the loop regardless of a mid-batch failure", () => {
    const afterLoop = body.slice(
      body.indexOf("for (const file of Array.from(files))"),
    );
    const loopBody = extractBalancedBlock(
      afterLoop,
      afterLoop.indexOf("for (const file of Array.from(files))"),
    );
    const remainder = afterLoop.slice(afterLoop.indexOf(loopBody) + loopBody.length);
    expect(remainder).toMatch(/update\("assets", next\)/);
  });
});
