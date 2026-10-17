import { describe, it, expect } from "vitest";
import { appfolioSyncAuditDescription } from "@/lib/integrations/appfolio-sync";

/**
 * Regression: the AuditEvent written at the end of runAppfolioSync said
 * "completed with warnings" even when ZERO phases completed. The admin
 * activity tab (app/admin/clients/[id]/activity-tab.tsx) keys off the
 * "<name> sync failed" / "sync completed with warnings:" prefixes.
 */
describe("appfolioSyncAuditDescription", () => {
  it("reads as a failure when no phase completed", () => {
    const d = appfolioSyncAuditDescription(false, "properties: boom");
    expect(d).toBe("AppFolio sync failed: properties: boom");
    expect(d).not.toMatch(/completed/i);
  });

  it("still reads as a failure when no phase completed and no error text", () => {
    expect(appfolioSyncAuditDescription(false, null)).toMatch(/^AppFolio sync failed/);
  });

  it("keeps 'completed with warnings' when some phase completed with an error", () => {
    expect(appfolioSyncAuditDescription(true, "leads: x")).toBe(
      "AppFolio sync completed with warnings: leads: x",
    );
  });

  it("is plain 'completed' on a clean run", () => {
    expect(appfolioSyncAuditDescription(true, null)).toBe("AppFolio sync completed");
  });

  it("matches the activity-tab failure template", () => {
    const d = appfolioSyncAuditDescription(false, "x");
    expect(d).toMatch(/^(.+?) sync (?:triggered by agency staff )?\(?failed/i);
  });
});
