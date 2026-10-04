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
const auditCreate = vi.fn();
const processStripeEventOnce = vi.fn();

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
vi.mock("@/lib/proposals/idempotency", () => ({ processStripeEventOnce }));

// Default fence: first delivery, runs the handler against a fake tx.
function fenceProcesses() {
  processStripeEventOnce.mockImplementation(async (_args, handler) => {
    await handler({ auditEvent: { create: auditCreate } });
    return { status: "processed" };
  });
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
    send.mockResolvedValue({ data: { id: "em_1" }, error: null });
    fenceProcesses();
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(auditCreate).not.toHaveBeenCalled();
    expect(processStripeEventOnce).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: "evt_d1", orgId: null }),
      expect.any(Function),
    );
  });

  it("linked org: writes the audit row and emails ops once", async () => {
    retrieveCharge.mockResolvedValue({ id: "ch_1", customer: "cus_org" });
    findUnique.mockResolvedValue({ id: "org_1" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data.orgId).toBe("org_1");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("redelivered event (fence skipped) sends no second email", async () => {
    retrieveCharge.mockResolvedValue({ id: "ch_1", customer: "cus_org" });
    findUnique.mockResolvedValue({ id: "org_1" });
    processStripeEventOnce.mockResolvedValue({ status: "skipped" });
    const res = await post();
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });

  it("charge lookup failure returns 500 so Stripe retries, with no email", async () => {
    retrieveCharge.mockRejectedValue(new Error("stripe down"));
    const res = await post();
    expect(res.status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  it("a Resend error is reported but still acks the event", async () => {
    retrieveCharge.mockResolvedValue({ id: "ch_1", customer: "cus_org" });
    findUnique.mockResolvedValue(null);
    send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    const res = await post();
    expect(res.status).toBe(200);
    expect(captureWithContext).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("domain not verified") }),
      expect.objectContaining({ handler: "handleDisputeCreated.notify", disputeId: "dp_1" }),
    );
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
    const res = await post();
    expect(res.status).toBe(200);
    expect(captureWithContext).not.toHaveBeenCalled();
  });
});
