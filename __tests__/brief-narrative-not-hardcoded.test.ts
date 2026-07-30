import { describe, it, expect } from "vitest";
import { buildComparisonPageBody } from "@/app/brief/[token]/page";

// ---------------------------------------------------------------------------
// Regression for AUDIT-MAGNET-D001: the brief's action-plan comparison-page
// item and narrative panel hardcoded one pilot client's building/competitor
// names ("255 California Street vs 555 California Street vs 101 California
// Street"). Any brief built for a different prospect (app/admin/briefs/
// actions.ts allows any org) rendered that pilot client's data. The action
// body must be driven off the brief's own brand + AEO competitor data.
// ---------------------------------------------------------------------------

describe("buildComparisonPageBody (AUDIT-MAGNET-D001)", () => {
  it("never mentions the pilot client's building or competitors for a different prospect", () => {
    const body = buildComparisonPageBody({
      brand: "Acme Tower",
      aeo: {
        competitorCounts: [
          { name: "Rival Plaza", count: 4 },
          { name: "Other Center", count: 2 },
        ],
      },
    });
    expect(body).toContain("Acme Tower");
    expect(body).toContain("Rival Plaza");
    expect(body).not.toMatch(/255 California|555 California|101 California/);
  });

  it("names the prospect's own brand instead of the hardcoded pilot brand", () => {
    const body = buildComparisonPageBody({
      brand: "Different Client LLC",
      aeo: { competitorCounts: [{ name: "Some Competitor", count: 1 }] },
    });
    expect(body).toContain("Different Client LLC");
    expect(body).not.toContain("255 Cal");
  });

  it("falls back to a neutral sentence (no invented competitor) when the scan found none", () => {
    const body = buildComparisonPageBody({
      brand: "No Competitor Co",
      aeo: { competitorCounts: [] },
    });
    expect(body).toContain("No Competitor Co");
    expect(body).not.toMatch(/255 California|555 California|101 California/);
    expect(body).not.toMatch(/vs\s+undefined/i);
  });
});
