import { describe, it, expect } from "vitest";
import { cursiveSyncMessage } from "@/components/marketplace/seller-import-wizard";

// ---------------------------------------------------------------------------
// Regression for MARKETPLACE-D001: /api/marketplace/seller/import-cursive
// starts the sync in the background and only ever responds { ok, note } —
// never the { sourceId, summary: { fetchedCount, ... } } shape the wizard
// used to assume. Reading `cursiveSummary.summary.fetchedCount` threw a
// TypeError on every successful sync. cursiveSyncMessage must render safely
// off the real response shape.
// ---------------------------------------------------------------------------

describe("cursiveSyncMessage (MARKETPLACE-D001)", () => {
  it("never throws on the real background-sync response shape", () => {
    expect(() =>
      cursiveSyncMessage({
        ok: true,
        note: "Sync started in background. Refresh your dashboard in 1-3 minutes.",
      }),
    ).not.toThrow();
  });

  it("renders the server-provided note when present", () => {
    expect(
      cursiveSyncMessage({ ok: true, note: "Sync started in background." }),
    ).toBe("Sync started in background.");
  });

  it("falls back to a safe message when note is missing", () => {
    expect(cursiveSyncMessage({ ok: true })).toMatch(/background/i);
  });

  it("falls back safely for a null summary (no sync attempted yet)", () => {
    expect(() => cursiveSyncMessage(null)).not.toThrow();
  });
});
