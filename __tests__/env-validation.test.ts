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

const sentry = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock("@/lib/sentry", () => ({ captureWithContext: sentry.capture }));

describe("lib/env.ts — silent-failure secrets", () => {
  beforeEach(() => {
    vi.resetModules();
    sentry.capture.mockClear();
  });

  it("in production: one console.error + Sentry capture naming the missing secrets, no throw", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    vi.stubEnv("CURSIVE_WEBHOOK_SECRET", "x");
    vi.stubEnv("CRON_SECRET", "x");
    vi.stubEnv("ENCRYPTION_KEY", "x");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("@/lib/env");
    expect(() => mod.validateEnv()).not.toThrow();

    const lines = err.mock.calls.map((c) => String(c[0])).filter((l) => l.includes("Missing secrets"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("STRIPE_WEBHOOK_SECRET, RESEND_WEBHOOK_SECRET");
    expect(sentry.capture).toHaveBeenCalledTimes(1);
    expect(sentry.capture.mock.calls[0][1]).toEqual({
      missingEnv: ["STRIPE_WEBHOOK_SECRET", "RESEND_WEBHOOK_SECRET"],
    });

    err.mockRestore();
    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("outside production: warn only, no Sentry", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("@/lib/env");
    mod.validateEnv();

    expect(warn.mock.calls.some((c) => String(c[0]).includes("RESEND_WEBHOOK_SECRET"))).toBe(true);
    expect(sentry.capture).not.toHaveBeenCalled();

    warn.mockRestore();
    vi.unstubAllEnvs();
  });
});

describe("customer-facing email link base", () => {
  it("unsubscribe URL falls back to the brand URL, never localhost, when NEXT_PUBLIC_APP_URL is unset", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("UNSUB_SECRET", "test-unsub-secret");
    const { buildUnsubUrl } = await import("@/lib/email/lead-sequences");
    const url = buildUnsubUrl("lead_1");
    expect(url.startsWith("https://leasestack.co/unsub?lead=lead_1&token=")).toBe(true);
    vi.unstubAllEnvs();
  });
});
