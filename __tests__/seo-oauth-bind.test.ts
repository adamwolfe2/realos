import { describe, it, expect, vi, beforeEach } from "vitest";

// GA4 / Search Console Google sign-in, step 2: the bound property must be
// one Google listed for this login. The client-submitted id alone is never
// trusted.

const h = vi.hoisted(() => ({
  db: {
    seoIntegration: { update: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
  load: vi.fn(),
  sync: vi.fn(async () => ({})),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/tenancy/scope", () => ({
  requireWorkspaceAdmin: vi.fn(async () => ({ orgId: "org1", userId: "u1" })),
  auditPayload: (_s: unknown, d: unknown) => d,
}));
vi.mock("@/lib/integrations/google-properties", () => ({
  loadPendingSeoOptions: h.load,
}));
vi.mock("@/lib/integrations/seo-sync", () => ({ runSeoSync: h.sync }));
vi.mock("@/lib/onboarding/step-detectors", () => ({
  syncOnboardingProgressInBackground: vi.fn(),
}));

const { bindSeoProperty } = await import("@/lib/actions/seo-oauth-bind");

function form(provider: string, id: string) {
  const fd = new FormData();
  fd.set("provider", provider);
  fd.set("propertyIdentifier", id);
  return fd;
}

describe("bindSeoProperty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.load.mockResolvedValue({
      row: { id: "row1" },
      options: [{ id: "123", name: "Main site", detail: null }],
    });
  });

  it("refuses a property Google did not list for this login", async () => {
    const r = await bindSeoProperty(form("GA4", "999"));
    expect(r.ok).toBe(false);
    expect(h.db.seoIntegration.update).not.toHaveBeenCalled();
  });

  it("binds a listed property to the pending row and starts a sync", async () => {
    const r = await bindSeoProperty(form("GA4", "123"));
    expect(r).toEqual({ ok: true, label: "Main site" });
    expect(h.load).toHaveBeenCalledWith("org1", "GA4");
    expect(h.db.seoIntegration.update).toHaveBeenCalledWith({
      where: { id: "row1" },
      data: { propertyIdentifier: "123", status: "IDLE" },
    });
    expect(h.sync).toHaveBeenCalledWith("org1", { fullBackfill: true });
  });

  it("fails cleanly when there is no pending sign-in", async () => {
    h.load.mockResolvedValueOnce({ row: null });
    const r = await bindSeoProperty(form("GSC", "sc-domain:x.com"));
    expect(r.ok).toBe(false);
    expect(h.db.seoIntegration.update).not.toHaveBeenCalled();
  });
});
