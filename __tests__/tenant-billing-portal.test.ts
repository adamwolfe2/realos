import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Coverage gap: POST /api/tenant/billing (Stripe Customer Portal link) had
// zero test coverage. Covers: auth required, Stripe-not-configured 503,
// no-stripe-customer 404, and the success path always keys the Stripe
// customer lookup off scope.orgId (never a caller-supplied id — the route
// takes no request body/params, so this also documents there's no IDOR
// surface here to regress into later).
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();
const mockIsStripeConfigured = vi.fn();
const mockCreatePortalSession = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireScope: () => mockRequireScope(),
  };
});

vi.mock("@/lib/stripe/config", () => ({
  isStripeConfigured: () => mockIsStripeConfigured(),
  getStripeClient: () => ({
    billingPortal: { sessions: { create: mockCreatePortalSession } },
  }),
}));

import { POST } from "@/app/api/tenant/billing/route";
import { ForbiddenError } from "@/lib/tenancy/scope";
import { UserRole } from "@prisma/client";

const ownerScope = {
  orgId: "org_1",
  role: UserRole.CLIENT_OWNER,
  isAgency: false,
  isImpersonating: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma = createMockPrisma();
  mockIsStripeConfigured.mockReturnValue(true);
});

describe("POST /api/tenant/billing", () => {
  it("requires auth — a ForbiddenError from requireScope surfaces its status", async () => {
    mockRequireScope.mockRejectedValue(new ForbiddenError("Not authenticated"));
    const res = (await POST()) as Response;
    expect(res.status).toBe(403);
  });

  it("returns 503 when Stripe isn't configured", async () => {
    mockRequireScope.mockResolvedValue(ownerScope);
    mockIsStripeConfigured.mockReturnValue(false);
    const res = (await POST()) as Response;
    expect(res.status).toBe(503);
  });

  it("returns 404 when the org has no Stripe customer on file", async () => {
    mockRequireScope.mockResolvedValue(ownerScope);
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      stripeCustomerId: null,
    });
    const res = (await POST()) as Response;
    expect(res.status).toBe(404);
  });

  it("looks up the Stripe customer keyed on scope.orgId, never a caller input", async () => {
    mockRequireScope.mockResolvedValue({
      ...ownerScope,
      orgId: "org_caller_scope",
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_caller_scope",
      stripeCustomerId: "cus_123",
    });
    mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session" });

    const res = (await POST()) as Response;
    const json = await res.json();

    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "org_caller_scope" } }),
    );
    expect(res.status).toBe(200);
    expect(json.url).toBe("https://billing.stripe.com/session");
  });

  it("returns 500 (not a raw error message) when Stripe itself throws", async () => {
    mockRequireScope.mockResolvedValue(ownerScope);
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: "org_1",
      stripeCustomerId: "cus_123",
    });
    mockCreatePortalSession.mockRejectedValue(new Error("stripe blew up: secret leaked xyz"));

    const res = (await POST()) as Response;
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).not.toContain("secret leaked");
  });

  it("denies a client admin before creating a portal session", async () => {
    mockRequireScope.mockResolvedValue({
      ...ownerScope,
      role: UserRole.CLIENT_ADMIN,
    });

    const res = (await POST()) as Response;

    expect(res.status).toBe(403);
    expect(mockCreatePortalSession).not.toHaveBeenCalled();
  });
});
