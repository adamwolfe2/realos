import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression tests for P0-2: the Cal.com webhook must authenticate on an
// unguessable per-org TOKEN (not the org id, which was publicly leaked by the
// chatbot config endpoint and allowed cross-tenant booking injection). Every
// Lead/Tour write must be scoped to the org resolved FROM the token.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
    create: vi.fn(async () => ({})),
  });
  return {
    db: {
      organization: model(),
      property: model(),
      lead: model(),
      tour: model(),
    },
    notify: vi.fn(async () => {}),
  };
});

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: h.notify,
}));

import {
  CAL_TOKEN_RE,
  getOrCreateCalWebhookToken,
  buildCalWebhookUrl,
  processCalBooking,
  isHandledTrigger,
} from "@/lib/integrations/cal-webhook";

// vi.fn() types .mock.calls as empty tuples, so direct [0][0] indexing trips
// strict tsc (TS2493). This reads a recorded call argument as `any`.
const callArg = (fn: any, call = 0, arg = 0): any => fn.mock.calls[call][arg];

beforeEach(() => {
  for (const m of Object.values(h.db)) {
    for (const fn of Object.values(m)) (fn as ReturnType<typeof vi.fn>).mockReset?.();
  }
  h.notify.mockReset();
  // sensible defaults
  h.db.property.findFirst.mockResolvedValue({ id: "prop_1" });
  h.db.lead.findFirst.mockResolvedValue(null);
  h.db.lead.create.mockResolvedValue({ id: "lead_new", source: "REFERRAL" });
  h.db.tour.findFirst.mockResolvedValue(null);
  h.db.tour.create.mockResolvedValue({ id: "tour_new" });
});

describe("Cal webhook token format (P0-2 path auth)", () => {
  it("accepts a 32-char lowercase hex token", () => {
    expect(CAL_TOKEN_RE.test("a".repeat(32))).toBe(true);
    expect(CAL_TOKEN_RE.test("0123456789abcdef0123456789abcdef")).toBe(true);
  });
  it("rejects org cuids and malformed tokens (no probe reaches the DB)", () => {
    expect(CAL_TOKEN_RE.test("cltabc123def456ghi789jkl0")).toBe(false); // cuid
    expect(CAL_TOKEN_RE.test("A".repeat(32))).toBe(false); // uppercase
    expect(CAL_TOKEN_RE.test("a".repeat(31))).toBe(false); // too short
    expect(CAL_TOKEN_RE.test("a".repeat(33))).toBe(false); // too long
    expect(CAL_TOKEN_RE.test("../../etc")).toBe(false);
  });
  it("buildCalWebhookUrl puts the token in the path", () => {
    const url = buildCalWebhookUrl("a".repeat(32));
    expect(url).toMatch(/\/api\/webhooks\/cal\/a{32}$/);
  });
});

describe("getOrCreateCalWebhookToken (lazy, idempotent, race-safe)", () => {
  it("returns the existing token without writing", async () => {
    h.db.organization.findUnique.mockResolvedValueOnce({
      calWebhookToken: "f".repeat(32),
    });
    const t = await getOrCreateCalWebhookToken("org_1");
    expect(t).toBe("f".repeat(32));
    expect(h.db.organization.updateMany).not.toHaveBeenCalled();
  });

  it("mints a token (guarded on calWebhookToken: null) when absent", async () => {
    h.db.organization.findUnique
      .mockResolvedValueOnce({ calWebhookToken: null }) // initial read
      .mockResolvedValueOnce({ calWebhookToken: "b".repeat(32) }); // settled read
    const t = await getOrCreateCalWebhookToken("org_1");
    expect(t).toBe("b".repeat(32));
    const call = callArg(h.db.organization.updateMany);
    expect(call.where).toEqual({ id: "org_1", calWebhookToken: null });
    expect(call.data.calWebhookToken).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("processCalBooking scopes everything to the resolved org", () => {
  it("BOOKING_CREATED creates a Lead + Tour scoped to the org from the token", async () => {
    const res = await processCalBooking({
      orgId: "org_victim_resolved_from_token",
      trigger: "BOOKING_CREATED",
      payload: {
        uid: "cal_abc",
        startTime: "2026-07-01T15:00:00Z",
        attendees: [{ email: "Prospect@Example.com", name: "Sam Lee" }],
        eventType: { slug: "tour" },
      },
    });
    expect(res).toMatchObject({ ok: true, action: "created", leadId: "lead_new" });

    // Lead created under the resolved org — never a client-supplied id.
    expect(callArg(h.db.lead.create).data.orgId).toBe(
      "org_victim_resolved_from_token",
    );
    // Email normalized to lowercase.
    expect(callArg(h.db.lead.create).data.email).toBe("prospect@example.com");
    // Tour scoped to the org's default ACTIVE property.
    expect(callArg(h.db.property.findFirst).where).toMatchObject({
      orgId: "org_victim_resolved_from_token",
      lifecycle: "ACTIVE",
    });
    expect(callArg(h.db.tour.create).data.propertyId).toBe("prop_1");
  });

  it("ignores unhandled triggers with a 200-style ack (no DB writes)", async () => {
    const res = await processCalBooking({
      orgId: "org_1",
      trigger: "MEETING_ENDED",
      payload: { uid: "x", attendees: [{ email: "a@b.com" }] },
    });
    expect(res).toEqual({ ok: true, action: "ignored", trigger: "MEETING_ENDED" });
    expect(h.db.lead.create).not.toHaveBeenCalled();
    expect(h.db.tour.create).not.toHaveBeenCalled();
  });

  it("rejects payloads missing uid or attendee email", async () => {
    const res = await processCalBooking({
      orgId: "org_1",
      trigger: "BOOKING_CREATED",
      payload: { attendees: [{ name: "No Email" }] },
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
    expect(h.db.lead.create).not.toHaveBeenCalled();
  });

  it("isHandledTrigger only allows the three booking triggers", () => {
    expect(isHandledTrigger("BOOKING_CREATED")).toBe(true);
    expect(isHandledTrigger("BOOKING_RESCHEDULED")).toBe(true);
    expect(isHandledTrigger("BOOKING_CANCELLED")).toBe(true);
    expect(isHandledTrigger("BOOKING_REQUESTED")).toBe(false);
  });
});
