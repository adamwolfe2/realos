import { describe, it, expect, vi, beforeEach } from "vitest";

describe("lib/env.ts — validateEnv", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports validateEnv function", async () => {
    const mod = await import("@/lib/env");
    expect(typeof mod.validateEnv).toBe("function");
  });

  it("warns on missing env vars in dev mode but does not throw", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // Clear required vars
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
      CRON_SECRET: process.env.CRON_SECRET,
    };
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.CRON_SECRET;

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const mod = await import("@/lib/env");
    // Should not throw in dev
    expect(() => mod.validateEnv()).not.toThrow();

    consoleSpy.mockRestore();
    Object.assign(process.env, saved);
    vi.unstubAllEnvs();
  });
});
