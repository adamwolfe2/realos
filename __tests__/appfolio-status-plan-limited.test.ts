import { describe, expect, it, vi } from "vitest";

// SG 2026-11-25: guest_cards and showings 404 on SG's AppFolio plan. Those
// two auto-skipped phases kept "AppFolio sync completed with warnings, 8 of
// 10 phases" on every portal page. Not-on-plan is expected (synced, one
// quiet line); a real phase failure must still read as partial.

const row = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db", () => ({
  prisma: { appFolioIntegration: { findUnique: vi.fn(async () => row.current) } },
}));

import { getAppFolioStatus, planLimitedSummary } from "@/lib/integrations/appfolio-status";

const base = {
  instanceSubdomain: "sg",
  clientIdEncrypted: "x",
  clientSecretEncrypted: "x",
  apiKeyEncrypted: null,
  useEmbedFallback: false,
  syncStatus: "idle",
  syncStartedAt: null,
  lastSyncAt: new Date(),
  lastError: null,
};
const skipped = [
  "leads: phase auto-skipped after 3 consecutive failures (last: AppFolio guest_cards page returned 404). Use Retry skipped phases to re-attempt.",
  "showings: phase auto-skipped after 3 consecutive failures (last: AppFolio showings returned 404). Use Retry skipped phases to re-attempt.",
];

describe("getAppFolioStatus plan limits", () => {
  it("reports not on the plan are synced, not partial", async () => {
    // Real SG stats: runtime skip warnings plus the stored phaseWarnings.
    const phaseWarnings = [
      "leads: report unavailable on this AppFolio plan (404) — upgrade plan or contact AppFolio support to enable this report",
      "showings: report unavailable on this AppFolio plan (404) — upgrade plan or contact AppFolio support to enable this report",
    ];
    row.current = { ...base, lastSyncStats: { warnings: skipped, phaseWarnings, phasesCompleted: 8, phasesSkipped: 2, totalPhases: 10 } };
    const s = await getAppFolioStatus("org");
    expect(s.state).toBe("synced");
    expect(s.stats?.unsupportedReports).toHaveLength(4);
    expect(planLimitedSummary(s.stats?.unsupportedReports)).toBe(
      "Not on this AppFolio plan: guest cards (leads), showings (tours). Expected; everything else syncs.",
    );
  });

  it("a real phase failure stays partial and loud", async () => {
    row.current = {
      ...base,
      lastSyncStats: { warnings: [...skipped, "residents: fetch failed: ETIMEDOUT"], phasesCompleted: 7, phasesSkipped: 2, totalPhases: 10 },
    };
    const s = await getAppFolioStatus("org");
    expect(s.state).toBe("partial");
    expect(s.lastError).toBe("residents: fetch failed: ETIMEDOUT");
  });

  it("a phase auto-skipped after server errors is a failure, not a plan limit", async () => {
    const skipped500 = "applications: phase auto-skipped after 3 consecutive failures (last: AppFolio applicant_directory returned 500).";
    row.current = { ...base, lastSyncStats: { warnings: [...skipped, skipped500], phasesCompleted: 7, phasesSkipped: 3, totalPhases: 10 } };
    const s = await getAppFolioStatus("org");
    expect(s.state).toBe("partial");
    expect(s.lastError).toBe(skipped500);
    expect(planLimitedSummary(s.stats?.unsupportedReports)).not.toContain("applications");
  });

  it("no unsupported reports, no line", () => {
    expect(planLimitedSummary([])).toBeNull();
    expect(planLimitedSummary(undefined)).toBeNull();
  });
});
