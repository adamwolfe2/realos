import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Coverage gap: POST /api/public/leads is unauthenticated, high blast
// radius (any tenant marketing site form posts here), and had zero test
// coverage. Covers: rate limiting, zod validation, the origin guard (the
// thing standing between "any chatbot config leaks orgId" and "an attacker
// forges leads / spams a tenant's Resend templates against an arbitrary
// org"), unknown-tenant handling, the property-belongs-to-org check
// (cross-tenant propertyId can't be attached to a lead), and the success
// path returning 201 + leadId.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  allowed: true,
  org: null as Record<string, unknown> | null,
  property: null as Record<string, unknown> | null,
  lead: { create: vi.fn(), findFirst: vi.fn() },
  visitor: { updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    organization: { findUnique: vi.fn(async () => h.org) },
    property: {
      findFirst: vi.fn(async () => h.property),
    },
    lead: h.lead,
    visitor: h.visitor,
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  publicSignupLimiter: null,
  WIDGET_FALLBACK: { publicSignup: { limit: 5, windowMs: 60_000 } },
  checkRateLimit: vi.fn(async () => ({ allowed: h.allowed })),
  getIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/tenancy/origin-guard", () => ({
  requireMatchingOrigin: vi.fn(async () => ({ ok: true, hostname: "test" })),
  chatbotOriginBypassEnabled: vi.fn(() => false),
}));

vi.mock("@/lib/email/lead-emails", () => ({
  sendLeadAutoReplyEmail: vi.fn(async () => ({ ok: true })),
  notifyTenantOfLeadEmail: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/integrations/slack", () => ({
  notifyNewIntake: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/notifications/create", () => ({
  notifyLeadCreated: vi.fn(async () => {}),
}));

vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: vi.fn(async () => {}),
}));

const { POST } = await import("@/app/api/public/leads/route");
const { requireMatchingOrigin } = await import("@/lib/tenancy/origin-guard");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/public/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const VALID_BODY = {
  orgId: "org_1",
  source: "FORM",
  email: "renter@example.com",
  firstName: "Jamie",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.allowed = true;
  h.org = {
    id: "org_1",
    name: "Telegraph Commons",
    orgType: "CLIENT",
    primaryContactEmail: null,
    tenantSiteConfig: null,
  };
  h.property = null;
  h.lead.create.mockResolvedValue({ id: "lead_1" });
  vi.mocked(requireMatchingOrigin).mockResolvedValue({
    ok: true,
    hostname: "test",
  } as never);
});

describe("POST /api/public/leads", () => {
  it("rate-limits before touching validation or the DB", async () => {
    h.allowed = false;
    const res = (await POST(makeRequest(VALID_BODY))) as Response;
    expect(res.status).toBe(429);
    expect(h.lead.create).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON bodies", async () => {
    const req = new NextRequest("http://localhost/api/public/leads", {
      method: "POST",
      body: "{not json",
      headers: { "content-type": "application/json" },
    });
    const res = (await POST(req)) as Response;
    expect(res.status).toBe(400);
  });

  it("rejects a body that fails zod validation (missing required source)", async () => {
    const res = (await POST(makeRequest({ orgId: "org_1" }))) as Response;
    expect(res.status).toBe(400);
    expect(h.lead.create).not.toHaveBeenCalled();
  });

  it("rejects when the origin guard fails — an attacker forging a lead against another tenant's orgId", async () => {
    vi.mocked(requireMatchingOrigin).mockResolvedValue({
      ok: false,
      error: "Origin mismatch",
      status: 403,
    } as never);
    const res = (await POST(makeRequest(VALID_BODY))) as Response;
    expect(res.status).toBe(403);
    expect(h.lead.create).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown tenant", async () => {
    h.org = null;
    const res = (await POST(makeRequest(VALID_BODY))) as Response;
    expect(res.status).toBe(404);
  });

  it("returns 404 for a non-CLIENT org (e.g. an agency orgId)", async () => {
    h.org = { ...h.org, orgType: "AGENCY" };
    const res = (await POST(makeRequest(VALID_BODY))) as Response;
    expect(res.status).toBe(404);
  });

  it("rejects a propertyId that doesn't belong to the org", async () => {
    h.property = null; // findFirst({ id, orgId }) found nothing
    const res = (await POST(
      makeRequest({ ...VALID_BODY, propertyId: "prop_other_org" }),
    )) as Response;
    expect(res.status).toBe(400);
    expect(h.lead.create).not.toHaveBeenCalled();
  });

  it("creates the lead and returns 201 + leadId on a valid request", async () => {
    const res = (await POST(makeRequest(VALID_BODY))) as Response;
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ ok: true, leadId: "lead_1" });
    expect(h.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org_1", email: "renter@example.com" }),
      }),
    );
  });
});
