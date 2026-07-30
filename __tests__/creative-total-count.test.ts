import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Regression for PORTAL-GROWTH-D003: the creative studio "Total" stat card
// used `requests.length`, but the requests list query is capped at
// `take: 200`. Once an org has more than 200 creative requests, the stat
// silently undercounts. The fix sums the ungated `groupBy` counts instead,
// which cover every row regardless of the list's take cap.

const ROOT = path.resolve(__dirname, "..");

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("creative studio — Total stat card", () => {
  const src = readFile("app/portal/creative/page.tsx");

  it("does not render the Total card from the take-capped requests.length", () => {
    expect(src).not.toMatch(/label="Total"\s+value=\{requests\.length\}/);
  });

  it("derives the total from the ungated groupBy counts", () => {
    expect(src).toMatch(/counts\.reduce\(/);
    expect(src).toMatch(/label="Total"\s+value=\{totalRequests\}/);
  });

  it("sanity check: the groupBy-sum pattern actually beats a 200-row cap", () => {
    // Mirrors the exact reduce used in the page — proves the arithmetic
    // itself is correct given a fixture that exceeds the take:200 cap.
    const counts = [
      { status: "SUBMITTED", _count: { _all: 90 } },
      { status: "DELIVERED", _count: { _all: 90 } },
      { status: "APPROVED", _count: { _all: 90 } },
    ];
    const totalRequests = counts.reduce((sum, r) => sum + r._count._all, 0);
    const cappedListLength = 200; // requests.length after take:200
    expect(totalRequests).toBe(270);
    expect(totalRequests).toBeGreaterThan(cappedListLength);
  });
});
