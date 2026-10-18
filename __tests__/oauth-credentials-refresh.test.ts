import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  refreshGoogle: vi.fn(),
  refreshMeta: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: { oAuthConnection: { findFirst: m.findFirst, update: m.update } },
}));
vi.mock("@/lib/crypto", () => ({
  encrypt: (s: string) => `enc:${s}`,
  decrypt: (s: string) => s.replace(/^enc:/, ""),
}));
vi.mock("@/lib/oauth/google", () => ({ refreshAccessToken: m.refreshGoogle }));
vi.mock("@/lib/oauth/meta", () => ({ refreshAccessToken: m.refreshMeta }));

const { getOAuthCredentials } = await import("@/lib/integrations/oauth-credentials");
const { OAuthRefreshError } = await import("@/lib/oauth/types");

const DAY = 86_400_000;
function row(provider: string, expiresInMs: number) {
  return {
    id: "c1",
    orgId: "o1",
    provider,
    accessToken: "enc:old",
    refreshToken: provider === "meta_ads" ? null : "enc:rt",
    expiresAt: new Date(Date.now() + expiresInMs),
    scope: null,
    externalAccountId: null,
    metadata: null,
  };
}
const fresh = { accessToken: "new", refreshToken: null, expiresAt: new Date(Date.now() + 60 * DAY), scope: null };

describe("getOAuthCredentials refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.update.mockImplementation(async ({ data }) => ({ ...row("x", 0), ...data }));
  });

  it("re-extends a Meta token days before it expires", async () => {
    m.findFirst.mockResolvedValue(row("meta_ads", 3 * DAY));
    m.refreshMeta.mockResolvedValue(fresh);
    const c = await getOAuthCredentials("o1", "meta_ads");
    expect(m.refreshMeta).toHaveBeenCalledTimes(1);
    expect(c?.accessToken).toBe("new");
  });

  it("does not refresh a Google token with plenty of time left", async () => {
    m.findFirst.mockResolvedValue(row("google_ga4", 30 * 60_000));
    const c = await getOAuthCredentials("o1", "google_ga4");
    expect(m.refreshGoogle).not.toHaveBeenCalled();
    expect(c?.accessToken).toBe("old");
  });

  it("keeps using a still-valid token when re-extension hits an outage", async () => {
    m.findFirst.mockResolvedValue(row("meta_ads", 3 * DAY));
    m.refreshMeta.mockRejectedValue(new OAuthRefreshError("503", false));
    const c = await getOAuthCredentials("o1", "meta_ads");
    expect(c?.accessToken).toBe("old");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("does not mark needs_reauth on a transient failure of an expired token", async () => {
    m.findFirst.mockResolvedValue(row("google_ga4", -1000));
    m.refreshGoogle.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getOAuthCredentials("o1", "google_ga4")).rejects.toThrow();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("marks needs_reauth when the provider rejects the grant", async () => {
    m.findFirst.mockResolvedValue(row("google_ga4", -1000));
    m.refreshGoogle.mockRejectedValue(new OAuthRefreshError("invalid_grant", true));
    await expect(getOAuthCredentials("o1", "google_ga4")).rejects.toThrow();
    expect(m.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "needs_reauth" } });
  });
});
