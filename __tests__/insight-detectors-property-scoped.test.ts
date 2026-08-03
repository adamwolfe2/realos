import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Integration scope containment (2026-08-04) — the insight detectors.
 *
 * An AppFolio connection imports the operator's ENTIRE account. SG Real
 * Estate has 135 Property rows and is a LeaseStack customer for exactly one
 * building; 457 of their 537 insights (85%) had already been GENERATED about
 * buildings that are not in LeaseStack. Insight bodies bake counts in as
 * literal numbers and get emailed, so an ungated detector does not just
 * render a wrong tile — it mails the customer a wrong number.
 *
 * Detector.run was widened to run(orgId, propertyIds) so the scope is
 * available and conventional. That alone does NOT force compliance:
 * TypeScript permits a function declaring fewer parameters to satisfy a
 * wider signature, so `run(orgId)` still type-checks. This file is the
 * enforcement layer — a new detector that never mentions the scope fails
 * here rather than shipping green and emailing junk.
 */
const DETECTOR_DIR = path.resolve(__dirname, "../lib/insights/detectors");

/**
 * Escape hatch for queries that genuinely have no property dimension — an
 * AdAccount is one credential per org, not per building. Write this marker
 * in a comment inside the `where` literal to declare it deliberate:
 *
 *   where: {
 *     orgId, // property-scope: org-level — AdAccount is per-org, not per-building
 *   }
 *
 * Deliberately verbose so it cannot be typed by accident, and it stays
 * greppable when someone audits what was exempted and why.
 */
const ORG_LEVEL_OPT_OUT = "property-scope: org-level";

/**
 * Blank out comments, preserving length so offsets stay valid. Without
 * this, prose mentioning `propertyId` satisfies the guard and a genuinely
 * ungated query passes on the strength of a comment about it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/**
 * Brace-balanced `where:` object literals, as [start, end) offsets into the
 * source. Balanced rather than a fixed window so a nested `{ ... }` cannot
 * truncate the object early and hide the clause that scopes it.
 */
function whereObjectRanges(src: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /where:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
    }
    out.push([m.index, i]);
  }
  return out;
}

const detectorFiles = fs
  .readdirSync(DETECTOR_DIR)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .sort();

describe("every insight detector is property-scoped", () => {
  it("finds the detector directory (guards against a silent rename)", () => {
    // If this ever hits 0, every test below would vacuously pass.
    expect(detectorFiles.length).toBeGreaterThanOrEqual(17);
  });

  it.each(detectorFiles)(
    "%s accepts and references the marketable property scope",
    (file) => {
      const src = fs.readFileSync(path.join(DETECTOR_DIR, file), "utf-8");
      expect(
        src.includes("propertyIds"),
        `${file} never references propertyIds. Every property-dimensioned query in a detector must be scoped to the buildings enabled in LeaseStack — the numbers it computes get emailed to the customer.`,
      ).toBe(true);
    },
  );

  it.each(detectorFiles)(
    "%s does not query bare { orgId } without a property clause",
    (file) => {
      const raw = fs.readFileSync(path.join(DETECTOR_DIR, file), "utf-8");
      // stripComments preserves length, so offsets index into both.
      const src = stripComments(raw);
      // `where: { orgId }` / `where: { orgId, ... }` with no property
      // scoping anywhere in the SAME object literal is the exact leaky
      // idiom this slice exists to kill.
      for (const [start, end] of whereObjectRanges(src)) {
        const obj = src.slice(start, end);
        if (!/^where:\s*\{\s*orgId\s*[,}]/.test(obj)) continue;
        // Deliberate org-level query, declared in a comment (which only
        // survives in `raw` — the stripped copy cannot be gamed by prose).
        if (raw.slice(start, end).includes(ORG_LEVEL_OPT_OUT)) continue;
        expect(
          /propertyId|propertyIds|marketable/.test(obj),
          `${file} has a where:{ orgId ... } with no property scoping. Scope it, or if the model genuinely has no property dimension declare it with a "${ORG_LEVEL_OPT_OUT}" comment inside the where:\n${obj.slice(0, 300)}`,
        ).toBe(true);
      }
    },
  );
});

describe("the runner enforces scope regardless of detector cooperation", () => {
  const runner = fs.readFileSync(
    path.resolve(__dirname, "../lib/insights/run.ts"),
    "utf-8",
  );

  it("resolves the marketable property list once per org", () => {
    expect(runner).toContain("marketablePropertyIds(orgId)");
  });

  it("passes the scope into every detector", () => {
    expect(runner).toContain("detector.run(orgId, propertyIds)");
  });

  it("fails CLOSED when an org has no enabled properties", () => {
    // Must skip the pass, not fall through to an org-wide run.
    expect(runner).toContain("if (propertyIds.length === 0)");
    expect(runner).toContain("summary.skipped");
  });

  it("drops insights attributed to a non-marketable property before upsert", () => {
    // The backstop that a forgetful future detector cannot bypass.
    expect(runner).toContain("marketable.has(i.propertyId)");
    expect(runner).toContain("totalOutOfScope");
  });

  it("keeps org-level (null-property) insights rather than silently deleting them", () => {
    expect(runner).toContain("i.propertyId == null");
  });
});
