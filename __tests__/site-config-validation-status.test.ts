import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression for PORTAL-SITES-D005: PATCH /api/tenant/site-config returned
// 400 for a Zod validation failure. The spec (and this endpoint's own
// convention elsewhere) calls for 422 Unprocessable Entity on validation
// errors, reserving 400 for malformed-request-shape problems.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  tenantSiteConfig: { upsert: vi.fn(async () => ({ id: "cfg_1" })) },
  auditEvent: { create: vi.fn(async () => ({})) },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    tenantSiteConfig: h.tenantSiteConfig,
    auditEvent: h.auditEvent,
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/tenancy/scope", () => ({
  requireWritableWorkspace: vi.fn(async () => ({
    userId: "user_1",
    orgId: "org_1",
  })),
  ForbiddenError: class ForbiddenError extends Error {
    status = 403;
  },
  auditPayload: (scope: { orgId: string; userId: string }, input: unknown) => ({
    orgId: scope.orgId,
    userId: scope.userId,
    ...(input as object),
  }),
}));

import type { NextRequest } from "next/server";
import { PATCH } from "@/app/api/tenant/site-config/route";

function jsonRequest(body: unknown) {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  h.tenantSiteConfig.upsert.mockClear();
});

describe("PATCH /api/tenant/site-config — validation status code", () => {
  it("returns 422 (not 400) when the body fails Zod validation", async () => {
    // contactEmail must be a valid email per the route's zod schema.
    const res = await PATCH(jsonRequest({ contactEmail: "not-an-email" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(h.tenantSiteConfig.upsert).not.toHaveBeenCalled();
  });

  it("still succeeds (200) for a valid body", async () => {
    const res = await PATCH(jsonRequest({ contactEmail: "leasing@acme.com" }));
    expect(res.status).toBe(200);
    expect(h.tenantSiteConfig.upsert).toHaveBeenCalled();
  });
});
