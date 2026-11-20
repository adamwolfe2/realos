import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { assertOrgWideAccess, ForbiddenError } from "@/lib/tenancy/scope";

// Org-level controls (company settings, API keys, white-label, lead routing,
// AppFolio/CRM connections, report cadence) are closed to property-restricted
// seats. requireOrgWideAdmin = requireWorkspaceAdmin + this assertion.
describe("assertOrgWideAccess", () => {
  it("lets an unrestricted seat through", () => {
    expect(() => assertOrgWideAccess({ allowedPropertyIds: null })).not.toThrow();
  });

  it("refuses a property-restricted seat", () => {
    expect(() => assertOrgWideAccess({ allowedPropertyIds: ["prop-a"] })).toThrow(ForbiddenError);
  });

  it("refuses a seat whose grant list is empty (restricted to nothing)", () => {
    expect(() => assertOrgWideAccess({ allowedPropertyIds: [] })).toThrow(ForbiddenError);
  });
});
