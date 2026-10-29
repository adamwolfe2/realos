import { afterEach, describe, expect, it, vi } from "vitest";

// Provider error bodies decide whether a tenant must reconnect.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/crypto", () => ({ decrypt: (s: string) => s }));
process.env.META_APP_ID = "app";
process.env.META_APP_SECRET = "secret";
process.env.GOOGLE_OAUTH_CLIENT_ID = "cid";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "csecret";

const meta = await import("@/lib/oauth/meta");
const google = await import("@/lib/oauth/google");

const conn = {
  id: "c1", orgId: "o1", provider: "meta_ads", accessToken: "t",
  refreshToken: "rt", expiresAt: null, scope: null, externalAccountId: null,
} as never;

function respond(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("refresh error classification", () => {
  it("Meta rate limit (400, code 4) is transient", async () => {
    respond(400, { error: { code: 4, message: "Application request limit reached" } });
    await expect(meta.refreshAccessToken(conn)).rejects.toMatchObject({ permanent: false });
  });

  it("Meta expired/revoked token (code 190) is permanent", async () => {
    respond(400, { error: { code: 190, message: "Error validating access token" } });
    await expect(meta.refreshAccessToken(conn)).rejects.toMatchObject({ permanent: true });
  });

  it("Google invalid_grant is permanent", async () => {
    respond(400, { error: "invalid_grant" });
    await expect(google.refreshAccessToken(conn)).rejects.toMatchObject({ permanent: true });
  });

  it("Google invalid_client (our config) is not permanent", async () => {
    respond(401, { error: "invalid_client" });
    await expect(google.refreshAccessToken(conn)).rejects.toMatchObject({ permanent: false });
  });
});
