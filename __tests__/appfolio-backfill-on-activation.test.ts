import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { resolveSyncWindowStart } from "@/lib/integrations/appfolio-sync";

/**
 * Integration scope containment (2026-08-04).
 *
 * The sync now declines to import child records for any property that is not
 * lifecycle=ACTIVE. The corollary: promoting a building to ACTIVE must widen
 * the next sync's window, or every record skipped while it sat IMPORTED is
 * never re-offered — the incremental watermark has already passed them and
 * the operator sees a permanently empty building with no error anywhere.
 */
describe("resolveSyncWindowStart", () => {
  const now = new Date("2026-08-04T12:00:00.000Z");
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const wide = new Date(now.getTime() - THIRTY_DAYS_MS);
  const lastSyncAt = new Date("2026-08-04T11:30:00.000Z");

  it("resumes from the watermark on a normal incremental run", () => {
    expect(
      resolveSyncWindowStart(now, { lastSyncAt, backfillRequestedAt: null }),
    ).toEqual(lastSyncAt);
  });

  it("widens on the first ever run (no watermark)", () => {
    expect(
      resolveSyncWindowStart(now, { lastSyncAt: null, backfillRequestedAt: null }),
    ).toEqual(wide);
  });

  it("widens when the caller explicitly asks for a full backfill", () => {
    expect(
      resolveSyncWindowStart(now, {
        fullBackfill: true,
        lastSyncAt,
        backfillRequestedAt: null,
      }),
    ).toEqual(wide);
  });

  // THE regression this slice exists to prevent. Without it the run resumes
  // from `lastSyncAt` (30 minutes ago) and the just-activated building gets
  // nothing.
  it("widens when a property was just promoted to ACTIVE, even with a fresh watermark", () => {
    expect(
      resolveSyncWindowStart(now, {
        lastSyncAt,
        backfillRequestedAt: new Date("2026-08-04T11:45:00.000Z"),
      }),
    ).toEqual(wide);
  });

  it("goes back to incremental once the request has been retired", () => {
    expect(
      resolveSyncWindowStart(now, { lastSyncAt, backfillRequestedAt: null }),
    ).toEqual(lastSyncAt);
  });
});

// ---------------------------------------------------------------------------
// Structural guards. The pieces below are single prisma calls inside a
// closure-scoped monolith / server actions that need a full prisma mock to
// drive end-to-end; the repo has no such harness (see the note in
// appfolio-inactive-property-gate.test.ts). Lock the shape instead.
// ---------------------------------------------------------------------------
describe("backfill request is armed on every ACTIVE promotion", () => {
  const actions = fs.readFileSync(
    path.resolve(__dirname, "../lib/actions/properties.ts"),
    "utf-8",
  );

  it("arms it from all three lifecycle-activation paths", () => {
    // singular setPropertyLifecycle, bulk setPropertyLifecycleBulk, and
    // activateAllImportedProperties. Miss one and that path's buildings
    // stay empty.
    const calls = actions.match(/requestAppfolioBackfill\(/g) ?? [];
    expect(calls.length).toBe(3);
  });

  it("re-reads affected orgs on the bulk path instead of assuming scope.orgId", () => {
    // An agency caller has orgFilter={}, so one bulk call can span multiple
    // client orgs. Stamping only scope.orgId would silently skip the rest.
    expect(actions).toContain('distinct: ["orgId"]');
  });
});

describe("backfill request is retired safely", () => {
  const sync = fs.readFileSync(
    path.resolve(__dirname, "../lib/integrations/appfolio-sync.ts"),
    "utf-8",
  );

  it("only clears after a run that actually completed a phase", () => {
    expect(sync).toContain("if (anyPhaseCompleted && backfillRequestedAt)");
  });

  it("uses an lte guard so a request arriving mid-run is not swallowed", () => {
    // An operator activating a second property while the sync is in flight
    // stamps a LATER timestamp. A bare `backfillRequestedAt: null` write
    // would discard it and leave that second building empty.
    expect(sync).toContain("backfillRequestedAt: { lte: backfillRequestedAt }");
  });
});
