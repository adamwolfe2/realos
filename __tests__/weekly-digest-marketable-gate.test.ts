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
// A behavioural test would be better, but `marketablePropertyIds` pulls the
// client through a DYNAMIC `await import("@/lib/db")` that vi.mock does not
// intercept, so mocking it means mocking the DB itself. This is a source
// guard instead — same convention as __tests__/public-report-onepager.test.ts
// and the nav drift guard. It is deliberately about SHAPE, not values: any
// `propertyId` or `OR` key appearing AFTER a gate spread inside the same
// object literal is a clobber, regardless of what it holds.
// ---------------------------------------------------------------------------

const GATED_FILES = [
  "../lib/reports/weekly-digest.ts",
  "../lib/dashboard/queries.ts",
  "../app/api/cron/pixel-weekly-digest/route.ts",
  "../app/portal/layout.tsx",
  "../app/admin/clients/[id]/page.tsx",
];

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
    const src = fs.readFileSync(file, "utf-8");
    const objs = whereObjects(src).filter(
      (o) => gateSpreadOffsets(o).length > 0,
    );

    it(`${rel.replace("../", "")} has at least one gated where`, () => {
      expect(objs.length).toBeGreaterThan(0);
    });

    it(`${rel.replace("../", "")} never re-declares propertyId/OR after a gate spread`, () => {
      for (const obj of objs) {
        const lastSpread = Math.max(...gateSpreadOffsets(obj));
        for (const key of ["propertyId", "OR"]) {
          for (const at of topLevelKeyOffsets(obj, key)) {
            expect(
              at,
              `\`${key}\` is declared AFTER a gate spread and overwrites it:\n${obj.slice(0, 400)}`,
            ).toBeLessThan(lastSpread);
          }
        }
      }
    });
  }
});
