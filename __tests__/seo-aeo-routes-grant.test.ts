import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression (multi-property grants). Org o1 owns properties A and B; the
// caller is restricted to A unless a test says otherwise.
//  - POST /api/portal/seo/aeo/onpage-audit trusted a client propertyId: it
//    could tag an audit with B (or another org's property).
//  - POST /api/portal/seo/neighborhoods/[id]/scan scanned a page anchored on
//    B for a user granted only A.
//  - POST /api/portal/seo/aeo/scan scanned (and spent on) every property in
//    the org for a user granted only A.
//  - connectSeo/disconnectSeo let a restricted admin change B's or the
//    org-wide Google connection.

let scope: { orgId: string; role: string; allowedPropertyIds: string[] | null };

const db = {
  property: {
    findFirst: vi.fn(async ({ where }: { where: { id: string; orgId: string } }) =>
      where.orgId === "o1" && ["A", "B"].includes(where.id) ? { id: where.id } : null,
    ),
  },
  neighborhoodPage: { findFirst: vi.fn() },
  aeoCitationCheck: { count: vi.fn(async () => 0) },
  seoIntegration: { findFirst: vi.fn(async () => null) },
};
vi.mock("@/lib/db", () => ({ prisma: db }));

vi.mock("@/lib/tenancy/scope", async (orig) => {
  const real = await orig<typeof import("@/lib/tenancy/scope")>();
  return {
    ...real,
    requireScope: async () => scope,
    requireWritableWorkspace: async () => scope,
    requireWorkspaceAdmin: async () => scope,
  };
});

const runOnPageAudit = vi.fn(async () => ({ ok: false, error: "stop" }));
vi.mock("@/lib/aeo/run-onpage-audit", () => ({ runOnPageAudit }));
vi.mock("@/lib/proposals/org-addons", () => ({
  orgHasActiveAddon: async () => true,
  ADDON_AEO_BOOST: "aeo_boost",
}));
const runAeoScan = vi.fn(async () => ({ rowsWritten: 0 }));
const runNeighborhoodScan = vi.fn(async () => ({}));
vi.mock("@/lib/aeo/orchestrate", () => ({ runAeoScan, runNeighborhoodScan }));
vi.mock("@/lib/aeo/engines", () => ({ getEnabledEngines: () => [{ engine: "CLAUDE" }] }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/integrations/seo-sync", () => ({ runSeoSync: vi.fn() }));
vi.mock("@/lib/integrations/gsc", () => ({
  parseServiceAccountJson: vi.fn(),
  testGscConnection: vi.fn(),
}));
vi.mock("@/lib/integrations/ga4", () => ({ testGa4Connection: vi.fn() }));

const onpage = await import("@/app/api/portal/seo/aeo/onpage-audit/route");
const nbScan = await import("@/app/api/portal/seo/neighborhoods/[id]/scan/route");
const aeoScan = await import("@/app/api/portal/seo/aeo/scan/route");
const { connectSeo, disconnectSeo } = await import("@/lib/actions/seo-connect");

const post = (body: unknown) =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  scope = { orgId: "o1", role: "CLIENT_ADMIN", allowedPropertyIds: ["A"] };
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "{}";
});

describe("onpage-audit propertyId", () => {
  it("rejects a property outside the caller's grant", async () => {
    const res = await onpage.POST(post({ url: "https://beta.test", propertyId: "B" }));
    expect(res.status).toBe(404);
    expect(runOnPageAudit).not.toHaveBeenCalled();
  });
  it("rejects another org's property id", async () => {
    scope = { ...scope, allowedPropertyIds: null };
    const res = await onpage.POST(post({ url: "https://x.test", propertyId: "OTHER" }));
    expect(res.status).toBe(404);
  });
  it("passes a granted property through", async () => {
    await onpage.POST(post({ url: "https://alpha.test", propertyId: "A" }));
    expect(runOnPageAudit).toHaveBeenCalledWith(expect.objectContaining({ propertyId: "A" }));
  });
});

describe("neighborhood scan", () => {
  it("only finds pages anchored on a granted property", async () => {
    db.neighborhoodPage.findFirst.mockResolvedValueOnce(null);
    await nbScan.POST({} as never, { params: Promise.resolve({ id: "page-b" }) });
    const where = (db.neighborhoodPage.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.propertyId).toEqual({ in: ["A"] });
  });
});

describe("portal AEO scan", () => {
  it("limits a restricted user's scan to their grant", async () => {
    await aeoScan.POST(new Request("http://x/api/portal/seo/aeo/scan", { method: "POST" }) as never);
    expect(runAeoScan).toHaveBeenCalledWith(expect.objectContaining({ propertyIds: ["A"] }));
  });
  it("scans every property for an unrestricted user", async () => {
    scope = { ...scope, allowedPropertyIds: null };
    await aeoScan.POST(new Request("http://x/api/portal/seo/aeo/scan", { method: "POST" }) as never);
    expect(runAeoScan.mock.calls[0]).toEqual([expect.not.objectContaining({ propertyIds: expect.anything() })]);
  });
});

describe("SEO connect/disconnect grant", () => {
  const fd = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  it("connect refuses a property outside the grant", async () => {
    const r = await connectSeo(fd({ provider: "GSC", propertyIdentifier: "sc-domain:b.test", leasestackPropertyId: "B" }));
    expect(r).toEqual({ ok: false, error: "That property is outside your access." });
  });
  it("connect refuses the org-wide row for a restricted admin", async () => {
    const r = await connectSeo(fd({ provider: "GSC", propertyIdentifier: "sc-domain:a.test" }));
    expect(r.ok).toBe(false);
  });
  it("connect refuses an unknown property instead of falling back to org-wide", async () => {
    scope = { ...scope, allowedPropertyIds: null };
    const r = await connectSeo(fd({ provider: "GSC", propertyIdentifier: "sc-domain:x.test", leasestackPropertyId: "OTHER" }));
    expect(r).toEqual({ ok: false, error: "Property not found in your workspace." });
  });
  it("disconnect refuses a property outside the grant", async () => {
    const r = await disconnectSeo(fd({ provider: "GA4", leasestackPropertyId: "B" }));
    expect(r.ok).toBe(false);
    expect(db.seoIntegration.findFirst).not.toHaveBeenCalled();
  });
});
