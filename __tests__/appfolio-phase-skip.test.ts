import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { isUnsupportedAppfolioWarning } from "@/lib/integrations/appfolio-status";

/**
 * Regression tests for the AppFolio phase-skip bug:
 *
 *   1. recordPhaseFailure marks a phase as skipped:unsupported on the first
 *      404/400 — the fix is correct, but the result must also be persisted
 *      in phaseWarnings so the operator sees it even when lastError is cleared.
 *
 *   2. lastError is cleared when anyPhaseCompleted — so skipped-phase errors
 *      silently vanish from the UI. The fix stores them in phaseWarnings which
 *      surfaces via AppFolioStatus.stats.unsupportedReports → "partial" state.
 *
 *   3. parseStats must read phaseWarnings from lastSyncStats and merge them
 *      into unsupportedReports (distinct from actionable warnings).
 *
 *   4. Permanent skip must be reset when credentials change (PATCH saves new
 *      apiKey / instanceSubdomain → phaseFailures cleared from lastSyncStats).
 */

const syncSrc = path.resolve(__dirname, "../lib/integrations/appfolio-sync.ts");
const statusSrc = path.resolve(__dirname, "../lib/integrations/appfolio-status.ts");
const routeSrc = path.resolve(
  __dirname,
  "../app/api/tenant/appfolio/route.ts",
);
const readSync = () => fs.readFileSync(syncSrc, "utf-8");
const readStatus = () => fs.readFileSync(statusSrc, "utf-8");
const readRoute = () => fs.readFileSync(routeSrc, "utf-8");

// ---------------------------------------------------------------------------
// isUnsupportedAppfolioWarning — unit test on the exported classifier
// ---------------------------------------------------------------------------
describe("isUnsupportedAppfolioWarning", () => {
  it("matches 404 return codes", () => {
    expect(isUnsupportedAppfolioWarning("guest_cards returned 404")).toBe(true);
  });

  it("matches 400 return codes", () => {
    expect(isUnsupportedAppfolioWarning("report returned 400")).toBe(true);
  });

  it("matches 'not a valid report' phrase", () => {
    expect(
      isUnsupportedAppfolioWarning("Id is not a valid report"),
    ).toBe(true);
  });

  it("matches 'no longer available' phrase", () => {
    expect(
      isUnsupportedAppfolioWarning("This report is no longer available"),
    ).toBe(true);
  });

  it("matches 'auto-skipped after' phrase (warning written by isPhaseSkipped path)", () => {
    expect(
      isUnsupportedAppfolioWarning(
        "leads: phase auto-skipped after 3 consecutive failures",
      ),
    ).toBe(true);
  });

  it("does NOT match transient errors", () => {
    expect(isUnsupportedAppfolioWarning("ECONNRESET fetch failed")).toBe(false);
    expect(isUnsupportedAppfolioWarning("timeout after 30s")).toBe(false);
    expect(isUnsupportedAppfolioWarning("500 Internal Server Error")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appfolio-sync.ts structural guards — phaseWarnings persistence
// ---------------------------------------------------------------------------
describe("appfolio-sync.ts — phaseWarnings persistence in persistedStats", () => {
  it("builds phaseWarnings from phaseFailures entries where skipped + unsupported", () => {
    const content = readSync();
    // The phaseWarnings array must be derived from phaseFailures
    expect(content).toContain("phaseWarnings");
    expect(content).toContain('entry.reason === "unsupported"');
    expect(content).toContain("entry.skipped");
  });

  it("includes phaseWarnings in persistedStats", () => {
    const content = readSync();
    // persistedStats must include phaseWarnings so it survives across runs
    expect(content).toContain("phaseWarnings, // operator-visible");
  });

  it("recordPhaseFailure marks unsupported on 404 pattern", () => {
    const content = readSync();
    // The regex in recordPhaseFailure must cover 404 and 400
    expect(content).toContain("/\\b40[04]\\b|not a valid report|no longer available|not available on/i");
    expect(content).toContain('reason: unsupported ? "unsupported" : "transient"');
    expect(content).toContain("skipped: unsupported || consecutiveFailures >= PHASE_SKIP_THRESHOLD");
  });

  it("marks phase skipped immediately on first 404 (no 3-strike wait)", () => {
    const content = readSync();
    // The comment must document the immediate-skip behavior
    expect(content).toContain("no 3-strike wait");
    // And unsupported skips on first hit (skipped: unsupported || consecutiveFailures >= ...)
    expect(content).toContain("skipped: unsupported || consecutiveFailures >= PHASE_SKIP_THRESHOLD");
  });
});

// ---------------------------------------------------------------------------
// appfolio-status.ts structural guards — parseStats reads phaseWarnings
// ---------------------------------------------------------------------------
describe("appfolio-status.ts — parseStats reads phaseWarnings into unsupportedReports", () => {
  it("reads phaseWarnings from the raw stats object", () => {
    const content = readStatus();
    expect(content).toContain("r.phaseWarnings");
    expect(content).toContain("storedPhaseWarnings");
  });

  it("merges storedPhaseWarnings into unsupportedReports", () => {
    const content = readStatus();
    expect(content).toContain("...storedPhaseWarnings");
    // Uses Set to deduplicate
    expect(content).toContain("new Set([...unsupportedFromWarnings, ...storedPhaseWarnings])");
  });

  it("partial detection triggers on unsupportedReports even when phasesAccounted === totalPhases", () => {
    const content = readStatus();
    // The new hasPlanLimitations condition
    expect(content).toContain("hasPlanLimitations");
    expect(content).toContain("stats.unsupportedReports?.length ?? 0");
    expect(content).toContain("hasTransientFailures || hasPlanLimitations");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/tenant/appfolio — credential change resets skipped phases
// ---------------------------------------------------------------------------
describe("PATCH /api/tenant/appfolio — credential change resets phaseFailures", () => {
  it("detects credential change when apiKey is being updated", () => {
    const content = readRoute();
    expect(content).toContain("credentialsChanging");
    expect(content).toContain("d.apiKey !== undefined");
    expect(content).toContain("d.instanceSubdomain !== undefined");
  });

  it("strips phaseFailures and phaseWarnings from lastSyncStats when credentials change", () => {
    const content = readRoute();
    expect(content).toContain("phaseFailures: _pf");
    expect(content).toContain("phaseWarnings: _pw");
    expect(content).toContain("data.lastSyncStats = rest");
  });
});
