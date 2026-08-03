import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { coverageRows } from "@/components/portal/reports/snapshot-shared";
import type { ReportSnapshot } from "@/lib/reports/generate";

// ---------------------------------------------------------------------------
// Zero-visitor report surfaces (2026-08-03).
//
// Why this exists: `buildVisitorStats` returns undefined and
// `kpis.identifiedVisitors` comes back 0 whenever no Visitor row can be filed
// under a LAUNCHED building — Visitor.propertyId unstamped, or every property
// inactive. That is "nothing attributable", NOT "nobody visited". The demo org
// (telegraph-commons-demo) sits in exactly that state with 150 real but
// unstamped visitors.
//
// Rendering "0 Identified visitors" next to real chatbot numbers turns absent
// data into a measured result, and the report is the artifact we hand clients
// as proof. So every visitor claim omits itself at zero rather than printing
// a 0. These lock that in on the surfaces that actually ship.
// ---------------------------------------------------------------------------

function snap(over: Record<string, unknown>): ReportSnapshot {
  return {
    kpis: { leads: 12, identifiedVisitors: 0 },
    trafficTrend: [],
    adPerformance: [],
    ...over,
  } as unknown as ReportSnapshot;
}

describe("coverageRows — visitor pixel row", () => {
  const visitorRow = (s: ReportSnapshot) =>
    coverageRows(s).find((r) => r.label.startsWith("Visitor pixel"))!;

  it("does not claim 'live' when there is nothing to show", () => {
    const row = visitorRow(snap({}));
    expect(row.state).toBe("prog");
    // The LABEL has to carry the state, not just the dot colour — print/PDF
    // and colour-blind readers only get the words.
    expect(row.label).not.toContain("live");
    expect(row.label).toBe("Visitor pixel: no identifications yet");
  });

  it("says live once visitors are actually identified", () => {
    const row = visitorRow(snap({ kpis: { leads: 1, identifiedVisitors: 4 } }));
    expect(row.state).toBe("live");
    expect(row.label).toBe("Visitor pixel: live");
  });

  it("does NOT infer pixel state from trafficTrend", () => {
    // Regression guard. trafficTrend was once OR'd into this row, which made
    // it structurally unable to ever report anything but "live": bucketDaily()
    // returns `new Array(days).fill(0)`, so a generated snapshot ALWAYS has a
    // non-empty trafficTrend — all-zero traffic included. That silently turned
    // the honest "no identifications yet" branch into dead code. trafficTrend
    // is GA4/GSC/ad-spend derived and carries no pixel signal at all.
    const allZeroTraffic = snap({ trafficTrend: [0, 0, 0, 0, 0, 0, 0] });
    expect(visitorRow(allZeroTraffic).state).toBe("prog");

    const realTraffic = snap({ trafficTrend: [4, 9, 2, 0, 7, 1, 3] });
    expect(visitorRow(realTraffic).state).toBe("prog");
    expect(visitorRow(realTraffic).label).toBe(
      "Visitor pixel: no identifications yet",
    );
  });

  it("treats a missing identifiedVisitors the same as 0", () => {
    const row = visitorRow(snap({ kpis: { leads: 1 } }));
    expect(row.state).toBe("prog");
    expect(row.label).toBe("Visitor pixel: no identifications yet");
  });
});

// The renderers below are .tsx components and the suite runs in a `node`
// environment with no testing-library, so these are structural guards in the
// same spirit as __tests__/public-report-onepager.test.ts — they fail if
// someone reintroduces an unguarded zero tile.
describe("visitor tiles omit themselves at zero", () => {
  const read = (p: string) =>
    fs.readFileSync(path.resolve(__dirname, p), "utf-8");

  it("one-pager (operator + public share + PDF) guards the visitor Stat", () => {
    const src = read("../components/portal/reports/property-one-pager.tsx");
    // The tile must be behind a > 0 check...
    expect(src).toMatch(
      /identifiedVisitors > 0 \? \(\s*<Stat value=\{num\(identifiedVisitors\)\} label="Identified visitors"/,
    );
    // ...and the grid must reflow so the omitted tile doesn't leave a hole.
    expect(src).toContain(
      'identifiedVisitors > 0 ? "grid-cols-3" : "grid-cols-2"',
    );
    // The old unconditional form must not come back.
    expect(src).not.toContain(
      '<Stat value={num(kpis.identifiedVisitors)} label="Identified visitors" />',
    );
  });

  it("property snapshot dashboard guards its visitor Stat and heading", () => {
    const src = read("../components/portal/reports/dashboard/sections.tsx");
    expect(src).not.toContain(
      '<Stat value={num(s.kpis.identifiedVisitors)} label="Identified visitors" />',
    );
    expect(src).toMatch(/identifiedVisitors > 0 \? \(\s*<Stat value=\{num\(identifiedVisitors\)\}/);
    // Heading must not promise a visitor number the card isn't rendering.
    expect(src).toContain(
      '{identifiedVisitors > 0 ? "Chatbot & visitor capture" : "Chatbot capture"}',
    );
    // The drill-in context line must not assert "0 identified visitors".
    expect(src).not.toContain(
      "context: `${num(kpis.identifiedVisitors ?? 0)} identified visitors`",
    );
  });
});
