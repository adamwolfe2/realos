import { describe, it, expect, vi, beforeEach } from "vitest";

// GA4 / Search Console Google sign-in, step 2: the bound property must be
// one Google listed for this login. The client-submitted id alone is never
// trusted.

const h = vi.hoisted(() => ({
  db: {
    seoIntegration: { updateMany: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  load: vi.fn(),
  sync: vi.fn(async () => ({})),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
const scopeMock = vi.hoisted(() => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    requireWorkspaceAdmin: vi.fn(async () => ({ orgId: "org1", userId: "u1" })),
  };
});
vi.mock("@/lib/tenancy/scope", () => ({
  ForbiddenError: scopeMock.ForbiddenError,
  requireWorkspaceAdmin: scopeMock.requireWorkspaceAdmin,
  auditPayload: (_s: unknown, d: unknown) => d,
}));
vi.mock("@/lib/integrations/google-properties", () => ({
  loadPendingSeoOptions: h.load,
  PENDING_OAUTH_BIND: "PENDING_OAUTH_BIND",
}));
vi.mock("@/lib/integrations/seo-sync", () => ({ runSeoSync: h.sync }));
vi.mock("@/lib/onboarding/step-detectors", () => ({
  syncOnboardingProgressInBackground: vi.fn(),
}));

const { bindSeoProperty } = await import("@/lib/actions/seo-oauth-bind");

function form(provider: string, id: string, propertyId?: string) {
  const fd = new FormData();
  fd.set("provider", provider);
  fd.set("propertyIdentifier", id);
  if (propertyId !== undefined) fd.set("propertyId", propertyId);
  return fd;
}

describe("bindSeoProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.load.mockResolvedValue({
      row: { id: "row1" },
      options: [{ id: "123", name: "Main site", detail: null }],
    });
    h.db.seoIntegration.updateMany.mockResolvedValue({ count: 1 });
    h.db.auditEvent.create.mockResolvedValue({});
  });

  it("refuses a property Google did not list for this login", async () => {
    const r = await bindSeoProperty(form("GA4", "999"));
    expect(r.ok).toBe(false);
    expect(h.db.seoIntegration.updateMany).not.toHaveBeenCalled();
  });

  it("binds a listed property to the pending row and starts a sync", async () => {
    const r = await bindSeoProperty(form("GA4", "123"));
    expect(r).toEqual({ ok: true, label: "Main site" });
    expect(h.load).toHaveBeenCalledWith("org1", "GA4", null);
    expect(h.db.seoIntegration.updateMany).toHaveBeenCalledWith({
      where: {
        id: "row1",
        orgId: "org1",
        propertyIdentifier: "PENDING_OAUTH_BIND",
      },
      data: { propertyIdentifier: "123", status: "IDLE" },
    });
    expect(h.sync).toHaveBeenCalledWith("org1", { fullBackfill: true });
  });

  it("fails cleanly when there is no pending sign-in", async () => {
    h.load.mockResolvedValueOnce({ row: null });
    const r = await bindSeoProperty(form("GSC", "sc-domain:x.com"));
    expect(r.ok).toBe(false);
    expect(h.db.seoIntegration.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a non-admin seat without touching Google or the row", async () => {
    scopeMock.requireWorkspaceAdmin.mockRejectedValueOnce(
      new scopeMock.ForbiddenError("Workspace admins only"),
    );
    const r = await bindSeoProperty(form("GA4", "123"));
    expect(r).toEqual({ ok: false, error: "Workspace admins only" });
    expect(h.load).not.toHaveBeenCalled();
    expect(h.db.seoIntegration.updateMany).not.toHaveBeenCalled();
  });

  it("binds the pending row of the property the sign-in was scoped to", async () => {
    await bindSeoProperty(form("GSC", "123", "prop-2"));
    expect(h.load).toHaveBeenCalledWith("org1", "GSC", "prop-2");
  });

  it("refuses a second submission once the row is already bound", async () => {
    h.db.seoIntegration.updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await bindSeoProperty(form("GA4", "123"));
    expect(r.ok).toBe(false);
    expect(h.db.auditEvent.create).not.toHaveBeenCalled();
    expect(h.sync).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the save fails", async () => {
    h.db.seoIntegration.updateMany.mockRejectedValueOnce(new Error("db down"));
    const r = await bindSeoProperty(form("GA4", "123"));
    expect(r).toEqual({ ok: false, error: "Couldn't save that property. Try again." });
    expect(h.sync).not.toHaveBeenCalled();
  });
});
