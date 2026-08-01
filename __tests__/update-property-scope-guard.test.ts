import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// Regression: updateProperty (lib/actions/properties.ts) checked only org
// ownership, never propertyInScope/allowedPropertyIds — a property-restricted
// operator could rewrite any sibling property in their org via the directly
// -callable server action. Fixed by adding a propertyInScope guard that
// returns the same "Property not found" shape as the missing-row branch.
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

const { updateProperty } = await import("@/lib/actions/properties");
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

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireWritableWorkspace.mockReset();
  mockRevalidatePath.mockReset();
  mockRequireWritableWorkspace.mockResolvedValue(restrictedScope());
  mockPrisma.auditEvent.create.mockResolvedValue({});
});

describe("updateProperty — property-scope guard", () => {
  it("rejects a restricted scope targeting a sibling property in the same org", async () => {
    mockPrisma.property.findUnique.mockResolvedValue({
      id: "prop-b",
      orgId: "org-1",
      slug: "prop-b-slug",
    });

    const result = await updateProperty({
      propertyId: "prop-b",
      name: "Renamed",
      slug: "prop-b-slug",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Property not found");
    expect(mockPrisma.property.update).not.toHaveBeenCalled();
  });

  it("allows a restricted scope targeting a property it is granted", async () => {
    mockPrisma.property.findUnique.mockResolvedValue({
      id: "prop-a",
      orgId: "org-1",
      slug: "prop-a-slug",
    });
    mockPrisma.property.findFirst.mockResolvedValue(null);
    mockPrisma.property.update.mockResolvedValue({});

    const result = await updateProperty({
      propertyId: "prop-a",
      name: "Renamed",
      slug: "prop-a-slug",
    });

    expect(result.ok).toBe(true);
    expect(mockPrisma.property.update).toHaveBeenCalledTimes(1);
  });
});
