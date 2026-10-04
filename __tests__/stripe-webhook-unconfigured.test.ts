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

function req() {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "{}",
  });
}

describe("Stripe webhook when Stripe is not configured", () => {
  const original = process.env.VERCEL_ENV;
  beforeEach(() => {
    captureWithContext.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.VERCEL_ENV = original;
    vi.restoreAllMocks();
  });

  it("returns 503 and alerts in production so Stripe retries", async () => {
    process.env.VERCEL_ENV = "production";
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(captureWithContext).toHaveBeenCalledTimes(1);
  });

  it("returns 200 in preview/dev without alerting", async () => {
    process.env.VERCEL_ENV = "preview";
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(captureWithContext).not.toHaveBeenCalled();
  });
});
