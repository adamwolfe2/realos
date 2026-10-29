import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Invariant (F-062): every lead-notify runs to completion or logs its
// failure. A bare `void notify(...)` can be frozen when the serverless
// function returns, so the operator silently misses the lead.

const LEAD_NOTIFY_FILES = [
  "app/api/public/leads/route.ts",
  "app/api/public/chatbot/chat/route.ts",
  "app/api/public/chatbot/lead/route.ts",
  "app/api/public/popup/lead/route.ts",
  "app/api/public/tours/route.ts",
  "app/api/ingest/lead/route.ts",
  "app/api/ingest/chatbot/route.ts",
  "app/api/tenant/leads/route.ts",
  "lib/actions/manual-leads.ts",
];

describe("lead-notify source guard", () => {
  it.each(LEAD_NOTIFY_FILES)("%s has no fire-and-forget notify", (file) => {
    const src = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(src).not.toMatch(
      /void\s+(notify\w+|sendProspectProfileForConversation|Promise\.allSettled)\(/,
    );
    // A bare statement call (no await / return / runAfter) is fire-and-forget too.
    expect(src).not.toMatch(
      /[;{}]\s*\n\s*(notify\w+|sendProspectProfileForConversation)\(/,
    );
  });
});

const h = vi.hoisted(() => ({
  after: vi.fn(),
  sentry: vi.fn(),
  notifyLeadCaptured: vi.fn(),
  notifyTourScheduled: vi.fn(),
  findOldestLeadByEmail: vi.fn(),
  prisma: {
    property: { findFirst: vi.fn() },
    lead: { create: vi.fn(), update: vi.fn() },
    tour: { create: vi.fn() },
  },
}));

vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: h.after,
}));
vi.mock("@/lib/sentry", () => ({ captureWithContext: h.sentry }));
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/leads/find-by-email", () => ({
  findOldestLeadByEmail: h.findOldestLeadByEmail,
}));
vi.mock("@/lib/rate-limit", () => ({
  publicSignupLimiter: {},
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  getIp: () => "1.2.3.4",
  WIDGET_FALLBACK: { publicSignup: {} },
}));
vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/notifications/create", () => ({
  notifyTourScheduled: h.notifyTourScheduled,
}));
vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: h.notifyLeadCaptured,
}));

import { POST } from "@/app/api/public/tours/route";
import { NextRequest } from "next/server";

function tourRequest() {
  return new NextRequest("https://app.test/api/public/tours", {
    method: "POST",
    body: JSON.stringify({
      orgId: "org_1",
      propertyId: "prop_1",
      email: "pat@example.com",
      firstName: "Pat",
    }),
  });
}

describe("public tours route registers notify with after()", () => {
  let callbacks: Array<() => Promise<void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = [];
    h.after.mockImplementation((cb: () => Promise<void>) => {
      callbacks.push(cb);
    });
    h.prisma.property.findFirst.mockResolvedValue({
      id: "prop_1",
      orgId: "org_1",
      org: { orgType: "CLIENT" },
    });
    h.findOldestLeadByEmail.mockResolvedValue(null);
    h.prisma.lead.create.mockResolvedValue({ id: "lead_1" });
    h.prisma.tour.create.mockResolvedValue({
      id: "tour_1",
      scheduledAt: null,
      tourType: "in_person",
    });
    h.notifyTourScheduled.mockResolvedValue(undefined);
    h.notifyLeadCaptured.mockResolvedValue(undefined);
  });

  it("responds 201 before notify runs, then notify runs from the after() callback", async () => {
    const res = await POST(tourRequest());
    expect(res.status).toBe(201);
    expect(h.notifyLeadCaptured).not.toHaveBeenCalled();
    expect(h.notifyTourScheduled).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(2);

    for (const cb of callbacks) await cb();
    expect(h.notifyTourScheduled).toHaveBeenCalledTimes(1);
    expect(h.notifyLeadCaptured).toHaveBeenCalledTimes(1);
    expect(h.notifyLeadCaptured.mock.calls[0][0]).toMatchObject({
      orgId: "org_1",
      leadId: "lead_1",
      channel: "TOUR",
    });
  });

  it("skips the operator email for an existing lead but still rings the tour bell", async () => {
    h.findOldestLeadByEmail.mockResolvedValue({ id: "lead_1" });
    h.prisma.lead.update.mockResolvedValue({ id: "lead_1" });

    const res = await POST(tourRequest());
    expect(res.status).toBe(201);
    expect(callbacks).toHaveLength(1);
    for (const cb of callbacks) await cb();
    expect(h.notifyTourScheduled).toHaveBeenCalledTimes(1);
    expect(h.notifyLeadCaptured).not.toHaveBeenCalled();
  });

  it("logs and reports a notify failure without throwing", async () => {
    const err = new Error("resend down");
    h.notifyLeadCaptured.mockRejectedValue(err);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(tourRequest());
    expect(res.status).toBe(201);
    for (const cb of callbacks) await expect(cb()).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledWith("[after:tours.notify] failed:", err);
    expect(h.sentry).toHaveBeenCalledWith(err, { after: "tours.notify" });
    logged.mockRestore();
  });

  it("never throws when reporting the failure itself fails", async () => {
    h.notifyLeadCaptured.mockRejectedValue(new Error("resend down"));
    h.sentry.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(tourRequest());
    expect(res.status).toBe(201);
    for (const cb of callbacks) await expect(cb()).resolves.toBeUndefined();
    logged.mockRestore();
  });
});
