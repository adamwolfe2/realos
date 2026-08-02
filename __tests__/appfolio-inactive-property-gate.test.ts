import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isInactiveAppfolioProperty } from "@/lib/integrations/appfolio-sync";

/**
 * SG Real Estate lead/application overclaim (2026-08-01 forensic audit):
 * AppFolio's sync ingests the ENTIRE portfolio account-wide with no
 * lifecycle gate, so leads/applications/residents/leases for EXCLUDED
 * (curated-out junk sub-records like parking/storage) and IMPORTED
 * (not-yet-launched) properties landed in the DB — 766 of 929 leads, ~791
 * of 895 applications belonged to non-ACTIVE properties. Fix: each phase
 * that attaches people-data to a resolved property now skips (and counts)
 * rows whose property isn't ACTIVE, via isInactiveAppfolioProperty.
 */
describe("isInactiveAppfolioProperty", () => {
  const lifecycles = new Map<string, string>([
    ["active-1", "ACTIVE"],
    ["imported-1", "IMPORTED"],
    ["excluded-1", "EXCLUDED"],
    ["archived-1", "ARCHIVED"],
  ]);

  it("is false for a resolved ACTIVE property — syncs normally", () => {
    expect(isInactiveAppfolioProperty("active-1", lifecycles)).toBe(false);
  });

  it("is true for a resolved IMPORTED property (not launched yet)", () => {
    expect(isInactiveAppfolioProperty("imported-1", lifecycles)).toBe(true);
  });

  it("is true for a resolved EXCLUDED property (curated-out junk)", () => {
    expect(isInactiveAppfolioProperty("excluded-1", lifecycles)).toBe(true);
  });

  it("is true for a resolved ARCHIVED property", () => {
    expect(isInactiveAppfolioProperty("archived-1", lifecycles)).toBe(true);
  });

  it("is FALSE for a null propertyId — that's the existing, separate no-property skip path", () => {
    expect(isInactiveAppfolioProperty(null, lifecycles)).toBe(false);
  });

  it("is true for a propertyId not present in the lifecycle map (defensive default)", () => {
    expect(isInactiveAppfolioProperty("unknown-id", lifecycles)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Structural guard: runAppfolioSync's inner phases are a closure-scoped
// monolith that requires a full REST client + prisma mock to drive
// end-to-end (no existing test in this repo does that — see
// appfolio-sync-manual-force.test.ts, which mocks runAppfolioSync itself
// rather than its internals). Cheaper and just as precise: lock that every
// phase which attaches people-data to a resolved property actually calls
// the gate and counts skips in stats.skippedInactiveProperty, mirroring the
// existing appfolio-phase-skip.test.ts structural-guard style.
// ---------------------------------------------------------------------------
describe("appfolio-sync.ts — inactive-property gate wired into every people-data phase", () => {
  const content = fs.readFileSync(
    path.resolve(__dirname, "../lib/integrations/appfolio-sync.ts"),
    "utf-8",
  );

  it("declares skippedInactiveProperty on the stats shape and initializes it", () => {
    expect(content).toContain("skippedInactiveProperty: number;");
    expect(content).toMatch(/skippedInactiveProperty:\s*0,/);
  });

  it("snapshots property lifecycles once after Phase 0, before the people-data phases run", () => {
    expect(content).toContain("propertyLifecycleById");
    expect(content).toContain("isInactiveResolvedProperty");
  });

  it("gates the leads (guest_cards) phase and counts the skip", () => {
    const leadsPhase = content.slice(
      content.indexOf("1. LEADS — AppFolio v2 report: guest_cards"),
      content.indexOf("1c. SHOWINGS"),
    );
    expect(leadsPhase).toContain("isInactiveResolvedProperty(localPropertyId)");
    expect(leadsPhase).toContain("stats.skippedInactiveProperty += 1");
  });

  it("gates the applications (rental_applications) phase and counts the skip", () => {
    const applicationsPhase = content.slice(
      content.indexOf("1b. APPLICATIONS"),
      content.indexOf("2. TENANTS"),
    );
    expect(applicationsPhase).toContain("isInactiveResolvedProperty(propertyId)");
    expect(applicationsPhase).toContain("stats.skippedInactiveProperty += 1");
  });

  it("gates the residents phase and counts the skip", () => {
    const residentsPhase = content.slice(
      content.indexOf("5. RESIDENTS"),
      content.indexOf("6. LEASES"),
    );
    expect(residentsPhase).toContain("isInactiveResolvedProperty(propertyId)");
    expect(residentsPhase).toContain("stats.skippedInactiveProperty += 1");
  });

  it("gates the leases phase and counts the skip", () => {
    const leasesPhase = content.slice(
      content.indexOf("6. LEASES"),
      content.indexOf("7. DELINQUENCY"),
    );
    expect(leasesPhase).toContain("isInactiveResolvedProperty(propertyId)");
    expect(leasesPhase).toContain("stats.skippedInactiveProperty += 1");
  });

  it("does NOT touch property_directory ingestion itself (Phase 0 stays unconditional)", () => {
    const phase0 = content.slice(
      content.indexOf("0. PROPERTIES"),
      content.indexOf("// Snapshot property lifecycles"),
    );
    expect(phase0).not.toContain("isInactiveResolvedProperty");
  });
});
