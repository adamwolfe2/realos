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
      // Named-import form is free to vary (the public page also pulls the
      // ReportHeroImage type); what matters is that the body comes from
      // the shared one-pager module.
      expect(content).toMatch(
        /import\s*\{[^}]*\bPropertyOnePager\b[^}]*\}\s*from\s*"@\/components\/portal\/reports\/property-one-pager"/s,
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

// 2026-09-19: the first cut of the animated cover hid every block behind
// InView + .ls-reveal (opacity:0 until JS stamps data-inview). Hydration
// failed over a tunnel and the whole report rendered BLANK on a phone. A
// document we send to clients must be legible without JS, so the one-pager
// uses the CSS-only .ls-view-* reveals injected by ReportMotionStyles.
describe("one-pager motion never gates content on JS", () => {
  const onePager = fs.readFileSync(
    path.resolve(__dirname, "../components/portal/reports/property-one-pager.tsx"),
    "utf-8",
  );
  it("ships its scroll-reveal CSS with the component", () => {
    expect(onePager).toContain("<ReportMotionStyles />");
  });
  it("uses no JS-gated reveal (InView / ls-reveal / ls-grow-x)", () => {
    expect(onePager).not.toContain("InView");
    expect(onePager).not.toMatch(/className="[^"]*\bls-reveal\b/);
    expect(onePager).not.toMatch(/className="[^"]*\bls-grow-x\b/);
  });
  it("keeps the hidden start state inside an @supports gate", () => {
    const motion = fs.readFileSync(
      path.resolve(__dirname, "../components/portal/reports/report-motion-styles.tsx"),
      "utf-8",
    );
    expect(motion).toContain("@supports (animation-timeline: view())");
    // Only `from` keyframes: the base style is the finished state.
    expect(motion).not.toMatch(/@keyframes[^}]*\bto\s*\{/);
  });
});
