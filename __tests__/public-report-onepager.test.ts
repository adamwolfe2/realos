import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Slice: report-share (2026-07-01). The public /r/[token] share link must
// render the beautiful PropertyOnePager — NOT the busy tabbed ReportView
// shell — while preserving Norman's May-22 building-image hero + the operator
// headline/note human layer. Structural guard so a refactor can't silently
// revert the public link back to the tabbed shell or drop the hero.

const pagePath = path.resolve(__dirname, "../app/r/[token]/page.tsx");
const controlsPath = path.resolve(
  __dirname,
  "../components/portal/reports/report-editor-controls.tsx",
);
const readPage = () => fs.readFileSync(pagePath, "utf-8");
const readControls = () => fs.readFileSync(controlsPath, "utf-8");

describe("public /r/[token] — one-pager share view", () => {
  it("renders the PropertyOnePager, not the tabbed ReportView shell", () => {
    const content = readPage();
    expect(content).toContain("PropertyOnePager");
    expect(content).toContain("<PropertyOnePager");
    // The busy tabbed shell must no longer be the public surface.
    expect(content).not.toContain("<ReportView");
  });

  it("keeps Norman's building-image hero pinned at the top", () => {
    const content = readPage();
    expect(content).toContain("PropertyHeroBanner");
    expect(content).toContain("loadPropertyHero");
  });

  it("still surfaces the operator headline + personal note", () => {
    const content = readPage();
    expect(content).toContain("report.headline");
    expect(content).toContain("report.notes");
  });

  it("stays tenant-scoped: only status=shared reports resolve", () => {
    const content = readPage();
    expect(content).toContain("isValidShareToken");
    expect(content).toContain('report.status !== "shared"');
    expect(content).toContain("notFound()");
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
