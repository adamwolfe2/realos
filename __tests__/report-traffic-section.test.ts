import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Site traffic section (2026-09-20) — the reach half of the client report's
// argument: we drove traffic, we captured leads from it, they became leases.
//
// The suite runs in a `node` env with no testing-library, so these are
// structural guards in the same spirit as report-zero-visitors.test.ts. Each
// one pins a rule that a real snapshot review caught, so a later refactor
// can't quietly undo it.
// ---------------------------------------------------------------------------

const src = fs.readFileSync(
  path.resolve(__dirname, "../components/portal/reports/property-one-pager.tsx"),
  "utf-8",
);

describe("Site traffic section never prints a zero as a result", () => {
  it("drops pages with no sessions instead of listing them at 0", () => {
    expect(src).toContain("(topPages ?? []).filter((p) => p.sessions > 0)");
  });

  it("never renders topPages.clicks, which is 0 for every GA4-only org", () => {
    expect(src).not.toMatch(/\brow\.clicks\b/);
  });

  it("drops cities and states with no visitors", () => {
    expect(src).toContain("(visitorStats?.topCities ?? []).filter((c) => c.count > 0)");
    expect(src).toContain("(visitorStats?.topStates ?? []).filter((r) => r.count > 0)");
  });

  it("omits the whole section when it has nothing to show", () => {
    expect(src).toContain("{pageRows.length > 0 || cityRows.length > 0 ? (");
  });

  it("omits each column independently rather than leaving a hole", () => {
    expect(src).toContain("{pageRows.length > 0 ? (");
    expect(src).toContain("{cityRows.length > 0 ? (");
    // Two-column split only when both columns actually have content.
    expect(src).toContain("pageRows.length > 0 && cityRows.length > 0");
  });
});

describe("section claims are assembled from surviving clauses", () => {
  it("builds the traffic claim by filtering, so a zero input drops its clause", () => {
    expect(src).toContain("const trafficClauses = [");
    expect(src).toContain("].filter(Boolean)");
    expect(src).toContain("organicSessions > 0");
    expect(src).toContain("identifiedVisitors > 0");
  });

  it("renders no sentence at all when no clause survives", () => {
    expect(src).toContain(
      "const trafficClaim = trafficClauses.length ? `${trafficClauses.join(\", \")}.` : null;",
    );
    expect(src).toContain("{trafficClaim ? (");
    expect(src).toContain("{acquisitionClaim ? (");
  });

  it("gates the acquisition claim on real conversations, not a bare render", () => {
    expect(src).toMatch(/chatConversations > 0 && chatLeads > 0 && kpis\.leads > 0/);
  });
});

// 2026-09-20: the client one-pager is a sales document. These fields are
// computed on every snapshot and must stay OFF it — each was checked against
// the live Telegraph Commons report and found to argue against us, contradict
// the headline band, or be empty.
describe("operator-only material stays off the client one-pager", () => {
  it("never renders insights (they are severity-ranked alarms)", () => {
    expect(src).not.toMatch(/\bsnapshot\.insights\b/);
    expect(src).not.toMatch(/\binsights\.map\b/);
  });

  it("never renders the funnel (three zero rungs, and Signed disagrees with the band)", () => {
    expect(src).not.toMatch(/\bsnapshot\.funnel\b/);
    expect(src).not.toMatch(/\bfunnel\.map\b/);
  });

  it("never renders ad spend, which hiddenSections already suppresses as money", () => {
    expect(src).not.toMatch(/\badPerformance\b/);
  });

  it("never renders contentStats while nothing is published", () => {
    expect(src).not.toMatch(/\bcontentStats\b/);
  });

  it("keeps the data-source coverage strip off the client surface", () => {
    expect(src).not.toMatch(/\bcoverageRows\b/);
    expect(src).not.toMatch(/\bCOVERAGE_DOT\b/);
    expect(src).not.toContain("Cohort report");
  });

  it("demographic enrichment (age, gender) stays off — it is wrong for the asset class", () => {
    expect(src).not.toMatch(/\bageRanges\b/);
    expect(src).not.toMatch(/\bgenderSplit\b/);
  });
});
