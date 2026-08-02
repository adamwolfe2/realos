import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Slice: report-share (2026-07-01), redesigned 2026-08-01. Both the operator
// report page and the public /r/[token] share link must render the SAME
// flat single-scroll PropertyOnePager body the /portal/reports live preview
// generates — fed from the frozen report.snapshot, not a live query — and
// NOT the old PropertyHeroBanner + report-header band + tabbed
// ReportDashboard stack Adam rejected on sight. Structural guard so a
// refactor can't silently reintroduce that stack or let the two surfaces
// drift apart.

const detailPagePath = path.resolve(
  __dirname,
  "../app/portal/reports/[id]/page.tsx",
);
const publicPagePath = path.resolve(__dirname, "../app/r/[token]/page.tsx");
const controlsPath = path.resolve(
  __dirname,
  "../components/portal/reports/report-editor-controls.tsx",
);
const readDetail = () => fs.readFileSync(detailPagePath, "utf-8");
const readPublic = () => fs.readFileSync(publicPagePath, "utf-8");
const readControls = () => fs.readFileSync(controlsPath, "utf-8");

describe("report surfaces render the shared PropertyOnePager snapshot body", () => {
  const surfaces: Array<[string, () => string]> = [
    ["operator /portal/reports/[id]", readDetail],
    ["public /r/[token]", readPublic],
  ];

  for (const [name, read] of surfaces) {
    it(`${name} renders <PropertyOnePager snapshot={snapshot} ...> fed from report.snapshot`, () => {
      const content = read();
      expect(content).toContain(
        'import { PropertyOnePager } from "@/components/portal/reports/property-one-pager"',
      );
      expect(content).toMatch(/<PropertyOnePager\s+snapshot=\{snapshot\}/);
      // Frozen persisted snapshot, not a fresh generateReportSnapshot() call.
      expect(content).toContain(
        "const snapshot = report.snapshot as unknown as ReportSnapshot;",
      );
      expect(content).not.toContain("generateReportSnapshot(");
      // The old rejected stack must not come back.
      expect(content).not.toContain("PropertyHeroBanner");
      expect(content).not.toContain("ReportDashboard");
      expect(content).not.toContain("ReportPrintHeader");
      expect(content).not.toContain("ReportHeaderStrip");
      expect(content).not.toContain("<ReportView");
    });
  }
});

describe("public /r/[token] — one-pager share view", () => {
  it("still surfaces the operator headline + personal note", () => {
    const content = readPublic();
    expect(content).toContain("report.headline");
    expect(content).toContain("report.notes");
  });

  it("stays tenant-scoped: only status=shared reports resolve", () => {
    const content = readPublic();
    expect(content).toContain("isValidShareToken");
    expect(content).toContain('report.status !== "shared"');
    expect(content).toContain("notFound()");
  });

  it("keeps view-count tracking on open", () => {
    const content = readPublic();
    expect(content).toContain("viewCount: { increment: 1 }");
    expect(content).toContain("lastViewedAt: new Date()");
  });
});

describe("report editor — public link affordance", () => {
  it("offers a Copy public link button only once shared", () => {
    const content = readControls();
    expect(content).toContain("Copy public link");
    expect(content).toContain('status === "shared" && shareUrl');
  });

  it("shows the live link and frames it as never a PDF", () => {
    const content = readControls();
    expect(content).toContain("Live link (never a PDF)");
  });
});
