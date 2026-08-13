import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// snapshot.hiddenSections (2026-08-13) — presentation-only suppression for
// client-facing reports (first use: the SG Real Estate CEO report, which
// must not show rent roll / lease turnover / "Zillow: not tracked" rows).
//
// Same structural-guard style as report-zero-visitors.test.ts: the suite
// runs in a node env with no testing-library, so we pin the source shape
// that makes the suppression real. If someone reverts a guard, these fail.
// ---------------------------------------------------------------------------

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf-8");

describe("PropertyOnePager honors snapshot.hiddenSections", () => {
  const src = read("../components/portal/reports/property-one-pager.tsx");

  it("derives the three flags from the snapshot", () => {
    expect(src).toContain('new Set(snapshot.hiddenSections ?? [])');
    expect(src).toContain('hidden.has("money")');
    expect(src).toContain('hidden.has("turnover")');
    expect(src).toContain('hidden.has("untracked-sources")');
  });

  it("gates the rent-roll KPI card behind !hideMoney", () => {
    expect(src).toMatch(/\{!hideMoney \? \(\s*<KpiCard[\s\S]{0,200}label="Monthly rent roll"/);
  });

  it("gates the occupancy KPI card behind !hideTurnover", () => {
    expect(src).toMatch(/\{!hideTurnover \? \(\s*<KpiCard[\s\S]{0,220}Occupancy across/);
  });

  it("reflows the KPI grid instead of leaving holes", () => {
    expect(src).toContain(
      "repeat(${2 + (hideTurnover ? 0 : 1) + (hideMoney ? 0 : 1)}, minmax(0, 1fr))",
    );
  });

  it("gates past-due balance and revenue-at-risk behind !hideMoney", () => {
    expect(src).toMatch(/\{!hideMoney \? \(\s*<Stat[\s\S]{0,120}label="Past-due balance"/);
    expect(src).toMatch(/\{!hideMoney \? \(\s*<div[\s\S]{0,220}Monthly revenue at risk/);
  });

  it("gates the whole Renewals-at-risk section behind !hideTurnover", () => {
    expect(src).toMatch(/\{!hideTurnover \? \(\s*<section>\s*<SectionHeading>Renewals at risk/);
  });

  it("gates the Zillow / Apartments.com 'not tracked' rows behind !hideUntracked", () => {
    expect(src).toMatch(/\{!hideUntracked\s*\?\s*\["Zillow", "Apartments\.com"\]/);
  });

  it("legacy snapshots (no hiddenSections) hide nothing", () => {
    // The flags must come only from the optional field with a [] default —
    // no other source may force-hide a section.
    expect(src).not.toContain('hiddenSections!');
    expect(src).toContain("snapshot.hiddenSections ?? []");
  });
});

describe("generate-alltime-report --hide flag", () => {
  const src = read("../scripts/generate-alltime-report.ts");

  it("rejects unknown keys instead of silently ignoring them", () => {
    expect(src).toContain('KNOWN_HIDE_KEYS');
    expect(src).toMatch(/Unknown --hide key/);
  });

  it("writes hiddenSections onto the snapshot only when asked", () => {
    expect(src).toContain(
      'HIDE.length > 0 ? { ...generated, hiddenSections: HIDE } : generated',
    );
  });
});
