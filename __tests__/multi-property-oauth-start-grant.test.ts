import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: the OAuth start route already refused a ?propertyId= outside
// the caller's grant, but a seat restricted to property A could still start
// an org-wide GA4/GSC connection (no propertyId) or an ad-account connection
// (always org-level), both of which feed property B. After: 403.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  scope: {} as Record<string, unknown>,
  property: { findFirst: vi.fn(async () => ({ id: "prop-a" })) },
}));

vi.mock("@/lib/db", () => ({ prisma: { property: h.property } }));
vi.mock("@/lib/integrations/oauth-config", () => ({
  isOAuthEnabled: () => true,
  isProviderConfigured: () => true,
  providerReadinessReason: () => null,
  getProviderConfig: () => ({
    authorizationUrl: "https://accounts.example/auth",
    clientId: "client",
    scopes: ["s"],
  }),
}));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  return {
    ForbiddenError,
    requireWorkspaceAdmin: async () => h.scope,
    propertyInScope: (
      s: { allowedPropertyIds: string[] | null },
      id: string | null,
    ) => !id || !s.allowedPropertyIds || s.allowedPropertyIds.includes(id),
  };
});

const { handleOAuthStart } = await import("@/lib/integrations/oauth-handler");

const req = (qs = "") =>
  ({ url: `https://app.example/api/oauth/x/start${qs}`, nextUrl: new URL(`https://app.example/api/oauth/x/start${qs}`) }) as never;

beforeEach(() => {
  h.scope = {
    orgId: "org-1",
    orgType: "CLIENT",
    role: "CLIENT_ADMIN",
    allowedPropertyIds: ["prop-a"],
  };
});

describe("OAuth start for a seat restricted to property A", () => {
  it("refuses an org-wide GA4 connection", async () => {
    const res = await handleOAuthStart(req(), "google_ga4");
    expect(res.status).toBe(403);
  });
  it("refuses an ad-account connection (org-level)", async () => {
    const res = await handleOAuthStart(req("?propertyId=prop-a"), "google_ads");
    expect(res.status).toBe(403);
  });
  it("refuses property B", async () => {
    const res = await handleOAuthStart(req("?propertyId=prop-b"), "google_ga4");
    expect(res.status).toBe(403);
  });
});
