import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// F-022: the trial-reminders cron is the single sender of the T-3 email.
// A platform-subscription trial_will_end must send nothing from the webhook;
// a proposal subscription keeps its existing log + Sentry warning path.

const captureWithContext = vi.fn();
const parseWebhookEvent = vi.fn();
const getResend = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/sentry", () => ({ captureWithContext }));
vi.mock("@/lib/db", () => ({ prisma: { organization: { findUnique } } }));
vi.mock("@/lib/email/shared", () => ({ getResend, BRAND_EMAIL: "x@y.z" }));
vi.mock("@/lib/rate-limit", () => ({
  webhookLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getIp: () => "127.0.0.1",
  rateLimited: vi.fn(),
}));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  parseWebhookEvent,
  getStripeClient: vi.fn(),
}));
vi.mock("@/lib/proposals/provision", () => ({ runProvisioningForProposal: vi.fn() }));

function trialWillEnd(metadata: Record<string, string>) {
  return {
    id: "evt_1",
    type: "customer.subscription.trial_will_end",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_shared",
        metadata,
        trial_end: 1_900_000_000,
      },
    },
  };
}

async function post() {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  return POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=x" },
    }),
  );
}

describe("customer.subscription.trial_will_end", () => {
  beforeEach(() => {
    captureWithContext.mockClear();
    getResend.mockClear();
    findUnique.mockReset();
    findUnique.mockResolvedValue({ id: "org_1", name: "Org", primaryContactEmail: "a@b.c" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("platform subscription: sends no email and does not look up the org", async () => {
    parseWebhookEvent.mockResolvedValue(trialWillEnd({ org_id: "org_1" }));
    const res = await post();
    expect(res.status).toBe(200);
    expect(getResend).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(captureWithContext).not.toHaveBeenCalled();
  });

  it("proposal subscription on the same customer keeps the proposal path", async () => {
    parseWebhookEvent.mockResolvedValue(trialWillEnd({ proposalId: "prop_1" }));
    const res = await post();
    expect(res.status).toBe(200);
    expect(getResend).not.toHaveBeenCalled();
    expect(captureWithContext).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ handler: "handleProposalTrialWillEnd", proposalId: "prop_1" }),
    );
  });
});
