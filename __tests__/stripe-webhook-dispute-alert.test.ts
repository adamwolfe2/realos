import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Webhook payloads carry dispute.charge as an id string. The handler used to
// read the customer only from an expanded charge, so it found no org and
// returned before emailing ops: chargebacks went unalerted.

const captureWithContext = vi.fn();
const parseWebhookEvent = vi.fn();
const send = vi.fn().mockResolvedValue({});
const getResend = vi.fn(() => ({ emails: { send } }));
const findUnique = vi.fn();
const retrieveCharge = vi.fn();

vi.mock("@/lib/sentry", () => ({ captureWithContext }));
vi.mock("@/lib/db", () => ({ prisma: { organization: { findUnique } } }));
vi.mock("@/lib/email/shared", () => ({ getResend, BRAND_EMAIL: "ops@x.test" }));
vi.mock("@/lib/rate-limit", () => ({
  webhookLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getIp: () => "127.0.0.1",
  rateLimited: vi.fn(),
}));
vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => true,
  parseWebhookEvent,
  getStripeClient: () => ({ charges: { retrieve: retrieveCharge } }),
}));
vi.mock("@/lib/proposals/provision", () => ({ runProvisioningForProposal: vi.fn() }));

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

describe("charge.dispute.created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parseWebhookEvent.mockResolvedValue({
      id: "evt_d1",
      type: "charge.dispute.created",
      data: {
        object: { id: "dp_1", charge: "ch_1", amount: 12_500, reason: "fraudulent", status: "needs_response" },
      },
    });
  });

  it("resolves the customer from a string charge id and emails ops even with no linked org", async () => {
    retrieveCharge.mockResolvedValue({ id: "ch_1", customer: "cus_proposal_only" });
    findUnique.mockResolvedValue(null);
    const res = await post();
    expect(res.status).toBe(200);
    expect(retrieveCharge).toHaveBeenCalledWith("ch_1");
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_proposal_only" } }),
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toContain("dp_1");
    expect(send.mock.calls[0][0].text).toContain("none linked");
  });
});

describe("unlinked org alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoice.payment_failed naming an org with no linked customer alerts Sentry", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    parseWebhookEvent.mockResolvedValue({
      id: "evt_i1",
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_1",
          customer: "cus_orphan",
          metadata: {},
          parent: { type: "subscription_details", subscription_details: { metadata: { org_id: "org_9" } } },
        },
      },
    });
    findUnique.mockResolvedValue(null);
    await post();
    expect(captureWithContext).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ handler: "handleInvoicePaymentFailed", orgId: "org_9", invoiceId: "in_1" }),
    );
  });

  it("stays silent for a customer with no org_id (proposal or marketplace)", async () => {
    parseWebhookEvent.mockResolvedValue({
      id: "evt_i2",
      type: "invoice.payment_failed",
      data: { object: { id: "in_2", customer: "cus_proposal", metadata: {} } },
    });
    findUnique.mockResolvedValue(null);
    await post();
    expect(captureWithContext).not.toHaveBeenCalled();
  });
});
