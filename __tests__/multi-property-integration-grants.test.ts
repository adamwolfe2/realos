import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property grants on integration and vault mutations. A seat restricted
// to property A (allowedPropertyIds = ["prop-a"]) could before:
//   - connect / disconnect property B's GA4/GSC row (connectSeo/disconnectSeo
//     never checked the grant on leasestackPropertyId),
//   - connect / disconnect / rebind org-wide connections that feed B
//     (AppFolio, Funnel, Google/Meta ad accounts, org-wide GA4/GSC row),
//   - rotate or delete an org-wide vault credential (only creation of
//     org-wide credentials was blocked).
// After: all refused; unrestricted seats unchanged.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  scope: {} as Record<string, unknown>,
  db: {
    property: { findFirst: vi.fn() },
    seoIntegration: { findFirst: vi.fn(), delete: vi.fn() },
    appFolioIntegration: { findUnique: vi.fn(), delete: vi.fn() },
    funnelIntegration: { findUnique: vi.fn(), delete: vi.fn() },
    credentialEntry: { findFirst: vi.fn(), update: vi.fn() },
    organization: { findUnique: vi.fn(async () => ({ moduleVault: true })) },
    auditEvent: { create: vi.fn(async () => ({})) },
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {}
  const get = async () => h.scope;
  return {
    ForbiddenError,
    requireScope: get,
    requireWorkspaceAdmin: get,
    requireWritableWorkspace: get,
    auditPayload: (_s: unknown, d: unknown) => d,
    tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
    propertyInScope: (
      s: { allowedPropertyIds: string[] | null },
      id: string | null,
    ) => !id || !s.allowedPropertyIds || s.allowedPropertyIds.includes(id),
  };
});
vi.mock("@/lib/integrations/seo-sync", () => ({
  runSeoSync: vi.fn(async () => ({ ok: true })),
  PENDING_OAUTH_BIND: "PENDING_OAUTH_BIND",
}));

const { connectSeo, disconnectSeo } = await import("@/lib/actions/seo-connect");
const { disconnectAppfolio } = await import("@/lib/actions/appfolio-connect");
const { disconnectFunnel } = await import("@/lib/actions/funnel-connect");
const { updateCredential, deleteCredential } = await import("@/lib/actions/vault");
const { integrationScopeError } = await import("@/lib/connect/scope-guard");

const restrictedToA = {
  orgId: "org-1",
  userId: "u1",
  role: "CLIENT_ADMIN",
  allowedPropertyIds: ["prop-a"],
};
const unrestricted = { ...restrictedToA, allowedPropertyIds: null };

const seoForm = (propertyId?: string) => {
  const fd = new FormData();
  fd.set("provider", "GA4");
  fd.set("propertyIdentifier", "123456");
  if (propertyId) fd.set("leasestackPropertyId", propertyId);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
  h.scope = restrictedToA;
  h.db.seoIntegration.findFirst.mockResolvedValue({ id: "seo-row" });
  h.db.appFolioIntegration.findUnique.mockResolvedValue({ id: "af" });
  h.db.funnelIntegration.findUnique.mockResolvedValue({ id: "fn" });
});

describe("integrationScopeError", () => {
  it("lets unrestricted seats touch anything", () => {
    expect(integrationScopeError({ allowedPropertyIds: null }, null)).toBeNull();
    expect(integrationScopeError({ allowedPropertyIds: null }, "prop-b")).toBeNull();
  });
  it("limits a restricted seat to its own properties, never org-wide", () => {
    expect(integrationScopeError(restrictedToA, "prop-a")).toBeNull();
    expect(integrationScopeError(restrictedToA, "prop-b")).not.toBeNull();
    expect(integrationScopeError(restrictedToA, null)).not.toBeNull();
  });
});

describe("GA4/GSC connect + disconnect respect the property grant", () => {
  it("restricted-to-A cannot connect GA4 for property B", async () => {
    const r = await connectSeo(seoForm("prop-b"));
    expect(r.ok).toBe(false);
    expect(h.db.property.findFirst).not.toHaveBeenCalled();
  });
  it("restricted-to-A cannot connect the org-wide GA4 row", async () => {
    const r = await connectSeo(seoForm());
    expect(r.ok).toBe(false);
  });
  it("restricted-to-A cannot disconnect property B's GA4", async () => {
    const r = await disconnectSeo(seoForm("prop-b"));
    expect(r.ok).toBe(false);
    expect(h.db.seoIntegration.delete).not.toHaveBeenCalled();
  });
  it("restricted-to-A can disconnect its own property's GA4", async () => {
    const r = await disconnectSeo(seoForm("prop-a"));
    expect(r.ok).toBe(true);
    expect(h.db.seoIntegration.delete).toHaveBeenCalledTimes(1);
  });
  it("an unrestricted seat can still disconnect the org-wide row", async () => {
    h.scope = unrestricted;
    const r = await disconnectSeo(seoForm());
    expect(r.ok).toBe(true);
    expect(h.db.seoIntegration.delete).toHaveBeenCalledTimes(1);
  });
});

describe("org-wide connections are refused to restricted seats", () => {
  it("restricted-to-A cannot disconnect AppFolio or Funnel (they feed B too)", async () => {
    expect((await disconnectAppfolio()).ok).toBe(false);
    expect((await disconnectFunnel()).ok).toBe(false);
    expect(h.db.appFolioIntegration.delete).not.toHaveBeenCalled();
    expect(h.db.funnelIntegration.delete).not.toHaveBeenCalled();
  });
});

describe("vault writes on org-wide credentials", () => {
  it("restricted-to-A cannot rotate or delete a credential outside its properties", async () => {
    h.db.credentialEntry.findFirst.mockResolvedValue(null);
    expect((await updateCredential("cred-org", { password: "x" })).ok).toBe(false);
    expect((await deleteCredential("cred-org")).ok).toBe(false);
    for (const call of h.db.credentialEntry.findFirst.mock.calls) {
      // Write gate excludes org-wide (propertyId: null) rows for this seat.
      expect((call as any[])[0].where.propertyId).toEqual({ in: ["prop-a"] });
    }
    expect(h.db.credentialEntry.update).not.toHaveBeenCalled();
  });
  it("an unrestricted seat's write gate is unchanged", async () => {
    h.scope = unrestricted;
    h.db.credentialEntry.findFirst.mockResolvedValue(null);
    await deleteCredential("cred-org");
    const where = (h.db.credentialEntry.findFirst.mock.calls[0] as any[])[0].where;
    expect(where.propertyId).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });
});
