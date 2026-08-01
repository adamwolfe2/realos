import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Coverage gap: POST /api/tenant/appfolio/clear-stuck had zero test
// coverage. Resets a wedged AppFolio sync row (syncStatus stuck at
// "syncing" after a Vercel function timeout) — but must NOT clear a sync
// that's genuinely still running (<10 min old), or a customer's real
// in-flight sync gets silently killed from the UI. Covers: not connected,
// already idle (no-op success), still-running guard (409), and the actual
// clear path.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: { appFolioIntegration: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));

const mockRequireWritableWorkspace = vi.fn();
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  };
});

import { POST } from "@/app/api/tenant/appfolio/clear-stuck/route";
import { ForbiddenError } from "@/lib/tenancy/scope";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireWritableWorkspace.mockResolvedValue({ orgId: "org_1" });
});

describe("POST /api/tenant/appfolio/clear-stuck", () => {
  it("surfaces a ForbiddenError's status (e.g. trial expired)", async () => {
    mockRequireWritableWorkspace.mockRejectedValue(new ForbiddenError("Trial expired"));
    const res = (await POST()) as Response;
    expect(res.status).toBe(403);
  });

  it("404s when AppFolio isn't connected for this tenant", async () => {
    h.db.appFolioIntegration.findUnique.mockResolvedValue(null);
    const res = (await POST()) as Response;
    expect(res.status).toBe(404);
  });

  it("no-ops with ok:true when the sync isn't currently 'syncing'", async () => {
    h.db.appFolioIntegration.findUnique.mockResolvedValue({
      id: "integ_1",
      syncStatus: "error",
      syncStartedAt: null,
    });
    const res = (await POST()) as Response;
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, cleared: false });
    expect(h.db.appFolioIntegration.update).not.toHaveBeenCalled();
  });

  it("refuses to clear a sync started less than 10 minutes ago (409)", async () => {
    h.db.appFolioIntegration.findUnique.mockResolvedValue({
      id: "integ_1",
      syncStatus: "syncing",
      syncStartedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
    });
    const res = (await POST()) as Response;
    expect(res.status).toBe(409);
    expect(h.db.appFolioIntegration.update).not.toHaveBeenCalled();
  });

  it("clears a sync stuck for more than 10 minutes", async () => {
    h.db.appFolioIntegration.findUnique.mockResolvedValue({
      id: "integ_1",
      syncStatus: "syncing",
      syncStartedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
    });
    const res = (await POST()) as Response;
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, cleared: true });
    expect(h.db.appFolioIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orgId: "org_1" },
        data: expect.objectContaining({ syncStatus: "error", syncStartedAt: null }),
      }),
    );
  });

  it("clears even with no syncStartedAt (defensive — never throws building the message)", async () => {
    h.db.appFolioIntegration.findUnique.mockResolvedValue({
      id: "integ_1",
      syncStatus: "syncing",
      syncStartedAt: null,
    });
    const res = (await POST()) as Response;
    expect(res.status).toBe(200);
  });
});
