import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Guard against a SILENTLY CLOBBERED property gate.
//
// The bug this exists for, caught during the fix that added these gates:
//
//   where: { orgId, ...strictClause, createdAt, propertyId: { not: null } }
//
// `strictClause` keys on propertyId. The trailing `propertyId` key overwrote
// it — object literals keep the LAST key — so the gate silently vanished and
// the per-property lead groupBy in the weekly digest email went back to
// counting the operator's entire synced AppFolio account. All 1836 tests
// stayed green, because nothing inspected the where-clause that actually
// reached Prisma.
//
// This is a source guard — same convention as
// __tests__/public-report-onepager.test.ts and the nav drift guard. It is
// deliberately about SHAPE, not values.
//
// (An earlier version of this comment claimed a behavioural test was
// impossible because `marketablePropertyIds` uses a dynamic
// `await import("@/lib/db")` that vi.mock cannot intercept. That is false —
// __tests__/marketable-org-clause.test.ts does exactly that and passes. The
// claim was removed rather than left to talk the next author out of writing
// the better test.)
//
// TWO DIRECTIONS, NOT ONE. The original guard only rejected a key appearing
// AFTER a gate spread. That is correct for `propertyId` (a spread later in
// the literal wins, so the gate survives), but WRONG for `OR`: an
// includeOrgLevel gate is itself `{ OR: [...] }`, so a literal holding both
// a gate spread and its own top-level `OR` loses one of them no matter
// which comes first. Mutation-verified by parallel-review 2026-08-04:
// rewriting getActivityFeed's visitorSession where to
// `{ orgId, startedAt, OR: [engagement...], ...orgLevelClause }` silently
// deleted the ENGAGEMENT filter — every session counted as engaged — and
// all 10 tests stayed green. The only safe shape is an AND-wrap, so `OR`
// co-existing with a gate spread now fails regardless of order.
// ---------------------------------------------------------------------------

const GATED_FILES = [
  "../lib/reports/weekly-digest.ts",
  "../lib/dashboard/queries.ts",
  "../app/api/cron/pixel-weekly-digest/route.ts",
  "../app/portal/layout.tsx",
  "../app/admin/clients/[id]/page.tsx",
  // Modified in the same range and carries a `...propertyClause` spread;
  // was silently unguarded.
  "../lib/reports/generate.ts",
  // Holds the sharpest latent instance: a literal top-level
  // `OR: [SUBMITTED, UNDER_REVIEW]` sitting beside a gate spread that is
  // safe today only because it happens to be built without opts.
  "../app/portal/page.tsx",
];

/**
 * Blank out comments so `propertyId:` / `OR:` mentioned in prose is not
 * scanned as code. Replaces with spaces rather than deleting so every
 * offset below stays valid. Without this, a future explanatory comment
 * placed after a gate spread fails the suite with a bogus clobber report —
 * and the natural "fix" is to reword the comment, which is the fastest
 * route to someone deleting the guard.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** Names that carry a marketable-property gate. */
const GATE_SPREAD =
  /\.\.\.(strictClause|leadClause|orgLevelClause|propertyClause|marketableClause|inMarketableOrOrgLevel|inMarketable)\b/g;

/**
 * Split a source file into brace-balanced object literals that follow a
 * `where:` key, so we only inspect the objects Prisma actually receives.
 */
function whereObjects(src: string): string[] {
  const out: string[] = [];
  const re = /where:\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

/**
 * Keys at depth 1 of the object, in source order, plus gate-spread positions.
 * Nested objects/arrays are skipped so an `OR` inside an `AND: [...]` element
 * (a legitimate, non-clobbering shape) is not flagged.
 */
function topLevelKeyOffsets(objSrc: string, key: string): number[] {
  const body = objSrc.slice(objSrc.indexOf("{") + 1);
  const offsets: number[] = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (depth === 0 && body.startsWith(key, i)) {
      const before = body[i - 1] ?? ",";
      const after = body.slice(i + key.length).match(/^\s*:/);
      if (after && !/[\w.$]/.test(before)) offsets.push(i);
    }
  }
  return offsets;
}

function gateSpreadOffsets(objSrc: string): number[] {
  const body = objSrc.slice(objSrc.indexOf("{") + 1);
  const offsets: number[] = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") depth--;
    else if (depth === 0) {
      GATE_SPREAD.lastIndex = i;
      const m = GATE_SPREAD.exec(body);
      if (m && m.index === i) offsets.push(i);
    }
  }
  return offsets;
}

describe("marketable gate is never clobbered by a later key", () => {
  for (const rel of GATED_FILES) {
    const file = path.resolve(__dirname, rel);
    const src = stripComments(fs.readFileSync(file, "utf-8"));
    const objs = whereObjects(src).filter(
      (o) => gateSpreadOffsets(o).length > 0,
    );

    it(`${rel.replace("../", "")} has at least one gated where`, () => {
      expect(objs.length).toBeGreaterThan(0);
    });

    it(`${rel.replace("../", "")} never re-declares propertyId after a gate spread`, () => {
      for (const obj of objs) {
        const lastSpread = Math.max(...gateSpreadOffsets(obj));
        for (const at of topLevelKeyOffsets(obj, "propertyId")) {
          expect(
            at,
            `\`propertyId\` is declared AFTER a gate spread and overwrites it:\n${obj.slice(0, 400)}`,
          ).toBeLessThan(lastSpread);
        }
      }
    });

    it(`${rel.replace("../", "")} never puts a top-level OR beside a gate spread (either order)`, () => {
      for (const obj of objs) {
        expect(
          topLevelKeyOffsets(obj, "OR"),
          `a top-level \`OR\` shares an object literal with a gate spread. An includeOrgLevel gate IS an \`OR\`, so one of the two is silently dropped whichever order they appear in — and the survivor looks perfectly correct. AND-wrap instead: \`AND: [gateClause, { OR: [...] }]\`.\n${obj.slice(0, 400)}`,
        ).toHaveLength(0);
      }
    });
  }
});
