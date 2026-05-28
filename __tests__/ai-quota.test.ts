import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// Per-org daily AI quota backstop. See lib/ai/quota.ts. These tests cover
// the FAIL-OPEN behavior (Redis unavailable) and the basic increment +
// limit-exceeded path using a fake Redis. The real Upstash client is not
// hit — we mock the `Redis` constructor so tests stay offline.
// ---------------------------------------------------------------------------

const incrMock = vi.fn();
const expireMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    incr = incrMock;
    expire = expireMock;
  },
}));

import { checkAiQuota, __resetForTest } from "@/lib/ai/quota";

describe("checkAiQuota", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    incrMock.mockReset();
    expireMock.mockReset();
    __resetForTest();
    delete process.env.AI_DAILY_QUOTA_PER_ORG;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    __resetForTest();
  });

  it("fails OPEN with default quota when Upstash is not configured", async () => {
    const result = await checkAiQuota("org_unconfigured");
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(1000);
    expect(result.reason).toBe("redis_unavailable_fail_open");
  });

  it("fails OPEN if Redis throws", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    incrMock.mockRejectedValueOnce(new Error("redis blip"));
    const result = await checkAiQuota("org_blip");
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("redis_unavailable_fail_open");
  });

  it("allows requests under the quota and sets TTL", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    process.env.AI_DAILY_QUOTA_PER_ORG = "100";
    incrMock.mockResolvedValueOnce(1);
    expireMock.mockResolvedValueOnce(1);

    const result = await checkAiQuota("org_a");

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
    expect(result.limit).toBe(100);
    expect(incrMock).toHaveBeenCalledOnce();
    expect(expireMock).toHaveBeenCalledWith(expect.any(String), 60 * 60 * 36);
  });

  it("blocks once count exceeds the configured cap", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    process.env.AI_DAILY_QUOTA_PER_ORG = "5";
    incrMock.mockResolvedValueOnce(6);
    expireMock.mockResolvedValueOnce(1);

    const result = await checkAiQuota("org_overcap");

    expect(result.allowed).toBe(false);
    expect(result.count).toBe(6);
    expect(result.limit).toBe(5);
    expect(result.reason).toBe("quota_exceeded");
  });

  it("falls back to default when AI_DAILY_QUOTA_PER_ORG is invalid", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    process.env.AI_DAILY_QUOTA_PER_ORG = "not-a-number";
    incrMock.mockResolvedValueOnce(1);
    expireMock.mockResolvedValueOnce(1);

    const result = await checkAiQuota("org_invalid");

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(1000);
  });
});
