import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

// ---------------------------------------------------------------------------
// S1 regression tests: invite route must reject LEASING_AGENT / CLIENT_VIEWER
// invites that don't include propertyIds, and must create UserPropertyAccess
// rows when propertyIds are provided.
// ---------------------------------------------------------------------------

let mockPrisma: MockPrisma;
const mockRequireScope = vi.fn();
const mockClerkClient = vi.fn();
const mockSendTeammateInviteEmail = vi.fn();

vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

class ForbiddenErrorStub extends Error {
  status = 403;
}

vi.mock("@/lib/tenancy/scope", () => ({
  requireScope: () => mockRequireScope(),
  ForbiddenError: ForbiddenErrorStub,
  auditPayload: (
    scope: Record<string, unknown>,
    rest: Record<string, unknown>,
  ) => ({ ...scope, ...rest }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: () => mockClerkClient(),
}));

vi.mock("@/lib/email/onboarding-emails", () => ({
  sendTeammateInviteEmail: (...args: unknown[]) =>
    mockSendTeammateInviteEmail(...args),
}));

const { POST } = await import(
  "@/app/api/admin/clients/invite/route"
);
const { UserRole, OrgType } = await import("@prisma/client");

// A valid agency scope used for most tests.
const agencyScope = {
  userId: "agency-user-1",
  clerkUserId: "clerk_agency-user-1",
  orgId: "agency-org",
  actualOrgId: "agency-org",
  orgType: OrgType.AGENCY,
  actualOrgType: OrgType.AGENCY,
  role: UserRole.AGENCY_ADMIN,
  email: "admin@agency.test",
  isAgency: true,
  isAlPartner: false,
  isImpersonating: false,
  allowedPropertyIds: null,
};

// A valid client org record.
const clientOrg = {
  id: "client-org-1",
  name: "Test Property Group",
  orgType: OrgType.CLIENT,
};

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/clients/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockPrisma = createMockPrisma();
  mockRequireScope.mockReset();
  mockClerkClient.mockReset();
  mockSendTeammateInviteEmail.mockReset();

  // Default happy-path setup
  mockRequireScope.mockResolvedValue(agencyScope);
  mockPrisma.organization.findUnique.mockResolvedValue(clientOrg);
  mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
  mockPrisma.user.findFirst = vi.fn().mockResolvedValue(null);

  // Caller lookup: agency admin
  // The invite route calls prisma.user.findUnique({ where: { clerkUserId } })
  // to get the caller's role. We make it return the agency caller.
  mockPrisma.user.findUnique.mockImplementation(
    (args: { where?: { clerkUserId?: string; email?: string } }) => {
      if (args?.where?.clerkUserId === "clerk_agency-user-1") {
        return Promise.resolve({
          role: UserRole.AGENCY_ADMIN,
          orgId: "agency-org",
          firstName: "Test",
          lastName: "Admin",
          email: "admin@agency.test",
        });
      }
      // No existing user by email
      return Promise.resolve(null);
    },
  );

  mockPrisma.user.create.mockResolvedValue({ id: "new-user-1" });
  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: MockPrisma) => Promise<void>) => fn(mockPrisma),
  );
  mockPrisma.userPropertyAccess = {
    deleteMany: vi.fn().mockResolvedValue({}),
    createMany: vi.fn().mockResolvedValue({}),
  } as unknown as MockPrisma["userPropertyAccess"];
  mockPrisma.auditEvent.create.mockResolvedValue({});

  mockClerkClient.mockResolvedValue({
    invitations: {
      createInvitation: vi.fn().mockResolvedValue({ url: "https://clerk.test/accept" }),
    },
  });

  mockSendTeammateInviteEmail.mockResolvedValue({ ok: true });
});

// ---------------------------------------------------------------------------
// S1 — property required for LEASING_AGENT / CLIENT_VIEWER
// ---------------------------------------------------------------------------

describe("S1: invite route — property assignment required for scoped roles", () => {
  it("rejects LEASING_AGENT invite without propertyIds (missing)", async () => {
    const req = makeRequest({
      email: "agent@tenant.test",
      role: "LEASING_AGENT",
      organizationId: "client-org-1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property assignment required/i);
  });

  it("rejects LEASING_AGENT invite without propertyIds (empty array)", async () => {
    const req = makeRequest({
      email: "agent@tenant.test",
      role: "LEASING_AGENT",
      organizationId: "client-org-1",
      propertyIds: [],
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property assignment required/i);
  });

  it("rejects CLIENT_VIEWER invite without propertyIds (missing)", async () => {
    const req = makeRequest({
      email: "viewer@tenant.test",
      role: "CLIENT_VIEWER",
      organizationId: "client-org-1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property assignment required/i);
  });

  it("rejects CLIENT_VIEWER invite with empty propertyIds array", async () => {
    const req = makeRequest({
      email: "viewer@tenant.test",
      role: "CLIENT_VIEWER",
      organizationId: "client-org-1",
      propertyIds: [],
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/property assignment required/i);
  });

  it("allows LEASING_AGENT invite WITH propertyIds and creates UserPropertyAccess rows", async () => {
    // The property validation query (findMany by id in ...) must return the property.
    mockPrisma.property = {
      findMany: vi.fn().mockResolvedValue([{ id: "prop-1" }]),
    } as unknown as MockPrisma["property"];

    const req = makeRequest({
      email: "agent@tenant.test",
      role: "LEASING_AGENT",
      organizationId: "client-org-1",
      propertyIds: ["prop-1"],
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    // The transaction should have created a UserPropertyAccess row.
    expect(mockPrisma.userPropertyAccess.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ propertyId: "prop-1" }),
      ],
    });
  });

  it("allows CLIENT_VIEWER invite WITH propertyIds and creates UserPropertyAccess rows", async () => {
    mockPrisma.property = {
      findMany: vi.fn().mockResolvedValue([{ id: "prop-A" }, { id: "prop-B" }]),
    } as unknown as MockPrisma["property"];

    const req = makeRequest({
      email: "viewer@tenant.test",
      role: "CLIENT_VIEWER",
      organizationId: "client-org-1",
      propertyIds: ["prop-A", "prop-B"],
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.userPropertyAccess.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ propertyId: "prop-A" }),
        expect.objectContaining({ propertyId: "prop-B" }),
      ]),
    });
  });

  it("does NOT require propertyIds for CLIENT_ADMIN invite (other roles are unrestricted)", async () => {
    const req = makeRequest({
      email: "cadmin@tenant.test",
      role: "CLIENT_ADMIN",
      organizationId: "client-org-1",
    });

    const res = await POST(req);
    const json = await res.json();

    // Should not 400 on missing propertyIds — only LEASING_AGENT/CLIENT_VIEWER need them
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("does NOT require propertyIds for CLIENT_OWNER invite", async () => {
    const req = makeRequest({
      email: "cowner@tenant.test",
      role: "CLIENT_OWNER",
      organizationId: "client-org-1",
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
