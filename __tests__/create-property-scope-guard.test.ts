import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: createProperty (lib/actions/properties.ts) had no property-RBAC
// gate at all — a property-restricted operator (allowedPropertyIds != null)
// could mint a brand-new property outside any grant, sibling to the
// updateProperty IDOR fixed via propertyInScope (see
// update-property-scope-guard.test.ts). There's no existing propertyId to
// check createProperty against, so restricted callers are denied outright.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireWritableWorkspace = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/lib/billing/sync-subscription-quantity", () => ({
  syncSubscriptionQuantity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/onboarding/step-detectors", () => ({
  syncOnboardingProgressInBackground: vi.fn(),
}));

class ForbiddenErrorStub extends Error {}

vi.mock("@/lib/tenancy/scope", () => ({
  requireAgency: vi.fn(),
  requireWritableWorkspace: () => mockRequireWritableWorkspace(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
  propertyInScope: (
    scope: { allowedPropertyIds: string[] | null },
    propertyId: string | null | undefined,
  ) => {
    if (!propertyId) return true;
    return (
      !scope.allowedPropertyIds || scope.allowedPropertyIds.includes(propertyId)
    );
  },
}));

const { createProperty } = await import("@/lib/actions/properties");
const { OrgType, UserRole } = await import("@prisma/client");

function restrictedScope() {
  return {
    userId: "restricted-actor",
    clerkUserId: "clerk_restricted-actor",
    orgId: "org-1",
    actualOrgId: "org-1",
    orgType: OrgType.CLIENT,
    actualOrgType: OrgType.CLIENT,
    role: UserRole.LEASING_AGENT,
    email: "actor@client.test",
    isAgency: false,
    isAlPartner: false,
    isImpersonating: false,
    allowedPropertyIds: ["prop-a"],
  };
}

function unrestrictedScope() {
  return { ...restrictedScope(), allowedPropertyIds: null };
}

const validPayload = {
  name: "New Building",
  slug: "new-building",
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireWritableWorkspace.mockReset();
  mockRevalidatePath.mockReset();
  mockPrisma.auditEvent.create.mockResolvedValue({});
});

describe("createProperty — property-scope guard", () => {
  it("rejects a property-restricted scope outright", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(restrictedScope());

    const result = await createProperty(validPayload);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Not authorized to create properties.");
    expect(mockPrisma.property.create).not.toHaveBeenCalled();
  });

  it("allows an unrestricted scope to create a property", async () => {
    mockRequireWritableWorkspace.mockResolvedValue(unrestrictedScope());
    mockPrisma.property.findFirst.mockResolvedValue(null);
    mockPrisma.property.create.mockResolvedValue({ id: "prop-new" });

    const result = await createProperty(validPayload);

    expect(result.ok).toBe(true);
    expect(mockPrisma.property.create).toHaveBeenCalledTimes(1);
  });
});
