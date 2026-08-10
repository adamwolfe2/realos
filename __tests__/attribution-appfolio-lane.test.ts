import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Slice: attribution (2026-07-01). AppFolio-synced leads were dumped into a
// single "imported, excluded" bucket, which for an AppFolio-driven operator
// (Telegraph: 94% of leads) emptied the whole attribution view. They are now a
// first-class "AppFolio / Leasing" lane that flows through the funnel. Only
// genuinely unattributed NON-external leads stay excluded. Structural guards so
// the exclusion behavior can't silently return.

const taxPath = path.resolve(__dirname, "../lib/attribution/source-taxonomy.ts");
const qPath = path.resolve(__dirname, "../lib/attribution/queries.ts");
// lead-flow-diagram.tsx (the original hero) was deleted 2026-07-29 as part
// of the donut/graph design-cohesion sweep — its funnel is now the inline
// stage-strip in the attribution page itself, so the guard moved there.
const diagramPath = path.resolve(
  __dirname,
  "../app/portal/attribution/page.tsx",
);
const revPath = path.resolve(
  __dirname,
  "../app/portal/reverse-attribution/page.tsx",
);
const read = (p: string) => fs.readFileSync(p, "utf-8");

describe("attribution — AppFolio first-class leasing lane", () => {
  it("registers an AppFolio canonical source in the leasing category", () => {
    const content = read(taxPath);
    expect(content).toContain('id: "appfolio"');
    expect(content).toContain('category: "leasing"');
    expect(content).toContain('| "leasing"');
  });

  it("routes PMS-synced (externalSystem) leads to the AppFolio lane, not excluded", () => {
    const content = read(qPath);
    expect(content).toContain("APPFOLIO_SOURCE");
    expect(content).toContain('getSource("appfolio")');
    // Only non-external unknown leads increment the excluded bucket.
    expect(content).toContain("if (lead.externalSystem != null) {");
    expect(content).toContain("channel = APPFOLIO_SOURCE;");
  });

  it("frames AppFolio leads as their own leasing lane, not an excluded bucket", () => {
    const content = read(diagramPath);
    expect(content).toContain("imported leads labeled separately");
    expect(content).toContain("Imported from PMS");
    expect(content).toContain("Excluded from LeaseStack-generated ROI");
    expect(content).not.toContain(
      "imported leads (AppFolio sync, no marketing channel) are excluded",
    );
  });

  it("consolidates reverse attribution without breaking old bookmarks", () => {
    const content = read(revPath);
    expect(content).toContain("URLSearchParams");
    expect(content).toContain('redirect(`/portal/attribution');
  });
});
