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
const diagramPath = path.resolve(
  __dirname,
  "../components/portal/attribution/lead-flow-diagram.tsx",
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

  it("no longer claims AppFolio leads are excluded from attribution", () => {
    const content = read(diagramPath);
    expect(content).not.toContain(
      "imported leads (AppFolio sync, no marketing channel) are excluded",
    );
  });

  it("honestly frames reverse-attribution when pixel identity resolution is off", () => {
    const content = read(revPath);
    expect(content).toContain("reverse.identifiedCount === 0");
    expect(content).toContain("Pixel identity resolution is off");
  });
});
