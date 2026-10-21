// Guard: lease counts that mean "occupied now" must use currentLeaseWhere.
// A bare `status: ACTIVE` lease query counted every lease the AppFolio sync
// had ever seen (Telegraph Commons: 177 on 100 units). Forward-looking
// renewal windows use `status: { in: [...] }` + an endDate range and are fine.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app/portal", "lib/properties", "lib/insights", "lib/reports"];
const BARE_ACTIVE =
  /prisma\.lease\s*\.(count|aggregate|findMany|findFirst|groupBy)\(\{[\s\S]{0,400}?status:\s*(LeaseStatus\.ACTIVE|"ACTIVE")\s*[,}]/g;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("current-lease guard", () => {
  it("no bare status: ACTIVE lease queries in portal, property, insight or report code", () => {
    const offenders = ROOTS.flatMap(files).filter((f) => {
      BARE_ACTIVE.lastIndex = 0;
      return BARE_ACTIVE.test(readFileSync(f, "utf8"));
    });
    expect(offenders).toEqual([]);
  });

  it("the pattern catches a bare ACTIVE count", () => {
    BARE_ACTIVE.lastIndex = 0;
    expect(BARE_ACTIVE.test('prisma.lease.count({ where: { orgId, status: "ACTIVE" } })')).toBe(true);
    BARE_ACTIVE.lastIndex = 0;
    expect(BARE_ACTIVE.test("prisma.lease.count({ where: { status: { in: [LeaseStatus.ACTIVE] } } })")).toBe(false);
  });
});
