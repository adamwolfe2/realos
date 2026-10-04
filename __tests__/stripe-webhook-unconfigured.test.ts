import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// F-023: when Stripe isn't configured, production must 503 (so Stripe
// retries) and alert; dev/preview keep the quiet 200.

const captureWithContext = vi.fn();

vi.mock("@/lib/sentry", () => ({ captureWithContext }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({
  webhookLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getIp: () => "127.0.0.1",
  rateLimited: vi.fn(),
}));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => false,
  parseWebhookEvent: vi.fn(),
  getStripeClient: vi.fn(),
}));
vi.mock("@/lib/proposals/provision", () => ({ runProvisioningForProposal: vi.fn() }));

async function post() {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  return POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    }),
  );
}

describe("Stripe webhook when Stripe is not configured", () => {
  beforeEach(() => {
    captureWithContext.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 503 and alerts on Vercel production so Stripe retries", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await post();
    expect(res.status).toBe(503);
    expect(captureWithContext).toHaveBeenCalledTimes(1);
  });

  it("returns 503 on a non-Vercel production deploy (NODE_ENV=production)", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await post();
    expect(res.status).toBe(503);
    expect(captureWithContext).toHaveBeenCalledTimes(1);
  });

  it("returns 200 on a Vercel preview even though NODE_ENV=production", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NODE_ENV", "production");
    const res = await post();
    expect(res.status).toBe(200);
    expect(captureWithContext).not.toHaveBeenCalled();
  });

  it("returns 200 in local dev without alerting", async () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "development");
    const res = await post();
    expect(res.status).toBe(200);
    expect(captureWithContext).not.toHaveBeenCalled();
  });
});
