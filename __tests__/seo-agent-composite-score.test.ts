import { describe, it, expect } from "vitest";
import { computeCompositeHealthScore } from "@/app/portal/seo/agent/page";

// Regression for PORTAL-SEO-D001: a property with NO data yet (no Lighthouse
// audit, no target queries, no AEO scans, no backlink summary) must show a
// "no data" state on the composite health score, not a fake 0/100 · Critical.
// Bug was that rankCoverage/citationRate defaulted to 0 (not null) when
// there was no underlying data, and those zeroes were unconditionally
// counted as two real signal parts — enough to cross the ">= 2 parts"
// threshold and produce a fake composite of 0.

describe("computeCompositeHealthScore", () => {
  it("returns null (no data) when nothing has been scanned yet", () => {
    const score = computeCompositeHealthScore({
      performance: null,
      seoScore: null,
      accessibility: null,
      targetQueryCountTotal: 0,
      rankCoverage: 0,
      aeoTotal: 0,
      citationRate: 0,
      backlinkDomainRank: null,
    });
    expect(score).toBeNull();
  });

  it("computes a real composite once at least two pillars have data", () => {
    const score = computeCompositeHealthScore({
      performance: 90,
      seoScore: 80,
      accessibility: 100,
      targetQueryCountTotal: 10,
      rankCoverage: 0.5,
      aeoTotal: 0,
      citationRate: 0,
      backlinkDomainRank: null,
    });
    expect(score).not.toBeNull();
    expect(score).toBeGreaterThan(0);
  });

  it("does not count rank coverage when there are zero target queries", () => {
    // Only the technical pillar has data — that's one part, below the
    // 2-part threshold — so composite must stay null even though
    // rankCoverage is (correctly) 0.
    const score = computeCompositeHealthScore({
      performance: 90,
      seoScore: 80,
      accessibility: 100,
      targetQueryCountTotal: 0,
      rankCoverage: 0,
      aeoTotal: 0,
      citationRate: 0,
      backlinkDomainRank: null,
    });
    expect(score).toBeNull();
  });
});
