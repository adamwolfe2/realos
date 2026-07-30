import { describe, it, expect, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for RISK-008: getSecret() used to fall back
// SITE_ENGINE_SECRET || NEXTAUTH_SECRET || CLERK_SECRET_KEY. Locally (and in
// some deploys) only CLERK_SECRET_KEY is set, so the live Clerk auth secret
// was silently signing/verifying public /sites/status HMAC tokens. Dropping
// the fallback means a deploy missing SITE_ENGINE_SECRET fails loudly
// instead of borrowing an unrelated service's secret.
// ---------------------------------------------------------------------------

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  delete process.env.SITE_ENGINE_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  delete process.env.CLERK_SECRET_KEY;
}

beforeEach(() => {
  resetEnv();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("status-token getSecret()", () => {
  it("throws instead of signing with CLERK_SECRET_KEY when SITE_ENGINE_SECRET is unset", async () => {
    process.env.CLERK_SECRET_KEY = "sk_live_clerk_super_secret";
    const { issueStatusToken } = await import("@/lib/site-engine/status-token");
    expect(() => issueStatusToken("some-slug")).toThrow(/SITE_ENGINE_SECRET/);
  });

  it("throws instead of signing with NEXTAUTH_SECRET when SITE_ENGINE_SECRET is unset", async () => {
    process.env.NEXTAUTH_SECRET = "nextauth-secret-value";
    const { issueStatusToken } = await import("@/lib/site-engine/status-token");
    expect(() => issueStatusToken("some-slug")).toThrow(/SITE_ENGINE_SECRET/);
  });

  it("signs and verifies successfully once SITE_ENGINE_SECRET is configured", async () => {
    process.env.SITE_ENGINE_SECRET = "dedicated-site-engine-secret";
    process.env.CLERK_SECRET_KEY = "sk_live_clerk_super_secret";
    const { issueStatusToken, verifyStatusToken } = await import(
      "@/lib/site-engine/status-token"
    );
    const { token } = issueStatusToken("some-slug");
    expect(verifyStatusToken("some-slug", token)).toBe(true);
  });

  it("a token signed under CLERK_SECRET_KEY as a stand-in secret does not verify under a real SITE_ENGINE_SECRET (proves the two are independent)", async () => {
    // Simulates the pre-fix world signing with Clerk's secret, then the
    // post-fix world verifying with a real dedicated secret — they must
    // never be interchangeable.
    process.env.SITE_ENGINE_SECRET = "sk_live_clerk_super_secret";
    const { issueStatusToken } = await import("@/lib/site-engine/status-token");
    const { token } = issueStatusToken("some-slug");

    process.env.SITE_ENGINE_SECRET = "dedicated-site-engine-secret";
    const mod = await import("@/lib/site-engine/status-token");
    expect(mod.verifyStatusToken("some-slug", token)).toBe(false);
  });
});
