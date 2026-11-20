// A seat restricted to property A must not reach org-level surfaces:
// Marketplace module switches, the ad-account lists on the org's login, the
// legacy OAuth start routes (no property = org-level connection), and the
// org-wide Integrations pages. Org-wide seats are unaffected.
import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  scope: {} as Record<string, unknown>,
  orgUpdate: vi.fn(),
  auditCreate: vi.fn(),
  getAuthUrl: vi.fn(async () => "https://accounts.example/auth"),
  listCustomers: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  const assertOrgWideAccess = (s: { allowedPropertyIds: string[] | null }) => {
    if (s.allowedPropertyIds !== null) throw new ForbiddenError("restricted");
  };
  return {
    ForbiddenError,
    assertOrgWideAccess,
    requireScope: async () => h.scope,
    requireWritableWorkspace: async () => h.scope,
    requireWorkspaceAdmin: async () => h.scope,
    auditPayload: (_s: unknown, r: unknown) => r,
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { update: h.orgUpdate, findUnique: vi.fn(async () => null) },
    auditEvent: { create: h.auditCreate, findFirst: vi.fn(async () => null) },
    oAuthConnection: { findFirst: vi.fn(async () => null) },
  },
}));
// Only the consent-URL builders are mocked; surface validation stays real.
vi.mock("@/lib/oauth/meta", () => ({ getAuthUrl: h.getAuthUrl }));
vi.mock("@/lib/oauth/google", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getAuthUrl: h.getAuthUrl,
}));

const { POST: toggle } = await import("@/app/api/portal/marketplace/toggle/route");
const { POST: interest } = await import("@/app/api/portal/marketplace/interest/route");
const { GET: googleCustomers } = await import(
  "@/app/api/portal/google-ads/accessible-customers/route"
);
const { GET: metaAccounts } = await import(
  "@/app/api/portal/meta-ads/accessible-accounts/route"
);
const { GET: googleConnect } = await import("@/app/api/oauth/google/connect/route");
const { GET: metaConnect } = await import("@/app/api/oauth/meta/connect/route");

const post = (body: unknown) =>
  new NextRequest("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const get = (qs: string) => new NextRequest(`http://x/api${qs}`);

beforeEach(() => {
  for (const m of [h.orgUpdate, h.auditCreate, h.getAuthUrl, h.listCustomers]) m.mockClear();
  h.scope = {
    orgId: "org-1",
    userId: "u1",
    orgType: "CLIENT",
    role: "CLIENT_ADMIN",
    allowedPropertyIds: ["prop-a"],
  };
});

describe("restricted seat is refused org-level surfaces", () => {
  it("marketplace toggle: refused, nothing written", async () => {
    const res = await toggle(post({ moduleKey: "moduleChatbot", enabled: true }));
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(h.orgUpdate).not.toHaveBeenCalled();
  });

  it("marketplace interest: refused, nothing written", async () => {
    const res = await interest(post({ moduleKey: "moduleChatbot", intent: "activate" }));
    expect(res.status).toBeGreaterThanOrEqual(401);
    expect(res.status).toBeLessThan(500);
    expect(h.auditCreate).not.toHaveBeenCalled();
  });

  it("ad-account lists: refused", async () => {
    expect((await googleCustomers()).status).toBeLessThan(500);
    expect((await googleCustomers()).status).toBeGreaterThanOrEqual(401);
    expect((await metaAccounts()).status).toBeGreaterThanOrEqual(401);
    expect((await metaAccounts()).status).toBeLessThan(500);
  });

  it("legacy OAuth start routes: 403, no consent URL built", async () => {
    expect((await googleConnect(get("?surface=google_ads"))).status).toBe(403);
    expect((await googleConnect(get("?surface=ga4"))).status).toBe(403);
    expect((await metaConnect(get("?surface=meta_ads"))).status).toBe(403);
    expect(h.getAuthUrl).not.toHaveBeenCalled();
  });
});

describe("org-wide seat is unaffected", () => {
  it("legacy OAuth start still redirects to consent", async () => {
    h.scope = { ...h.scope, allowedPropertyIds: null };
    const res = await metaConnect(get("?surface=meta_ads"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(h.getAuthUrl).toHaveBeenCalledTimes(1);
  });
});

describe("org-level pages are hidden from restricted seats", () => {
  // Server components; structural guard like mp-restricted-chrome.test.ts.
  it.each([
    "app/portal/marketplace/page.tsx",
    "app/portal/integrations/page.tsx",
    "app/portal/settings/integrations/page.tsx",
  ])("%s calls notFound() for a restricted seat", (file) => {
    expect(fs.readFileSync(file, "utf8")).toContain(
      "if (scope.allowedPropertyIds !== null) notFound();",
    );
  });
});
