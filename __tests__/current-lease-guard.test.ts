// Guard: lease counts that mean "occupied now" must use currentLeaseWhere.
// A bare `status: ACTIVE` lease query counted every lease the AppFolio sync
// had ever seen (Telegraph Commons: 177 on 100 units). Forward-looking
// renewal windows use `status: { in: [...] }` + an endDate range and are fine.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app/portal", "lib/properties", "lib/insights", "lib/reports"];
const CALL = /prisma\.lease\s*\.(count|aggregate|findMany|findFirst|groupBy)\(/g;
const BARE_STATUS = /status:\s*(LeaseStatus\.ACTIVE|"ACTIVE")\s*[,}]/;

// Full argument text of every prisma.lease.<op>(...) call (balanced parens),
// so query length or formatting cannot hide a bare status.
function leaseCalls(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(CALL)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

const hasBareActive = (src: string) => leaseCalls(src).some((c) => BARE_STATUS.test(c));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

describe("current-lease guard", () => {
  it("no bare status: ACTIVE lease queries in portal, property, insight or report code", () => {
    const offenders = ROOTS.flatMap(files).filter((f) => hasBareActive(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the check catches a bare ACTIVE count, however far status sits from the call", () => {
    expect(hasBareActive('prisma.lease.count({ where: { orgId, status: "ACTIVE" } })')).toBe(true);
    const padded = `prisma.lease.findMany({ where: { orgId, ${"x: 1, ".repeat(200)}status: LeaseStatus.ACTIVE }, select: { id: true } })`;
    expect(hasBareActive(padded)).toBe(true);
    expect(hasBareActive("prisma.lease.count({ where: { status: { in: [LeaseStatus.ACTIVE] } } })")).toBe(false);
  });
});
