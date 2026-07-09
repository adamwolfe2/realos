import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";
import type { MappedResident } from "@/lib/integrations/appfolio";

let mockPrisma: MockPrisma;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

import { upsertResident } from "@/lib/integrations/appfolio-sync";

function resident(over: Partial<MappedResident> = {}): MappedResident {
  return {
    externalId: "tenant-1",
    firstName: "Jane",
    lastName: "Doe",
    email: "Jane@Example.com",
    phone: null,
    unitExternalId: null,
    propertyExternalId: null,
    unitNumber: "203",
    status: "ACTIVE",
    moveInDate: null,
    moveOutDate: null,
    noticeGivenDate: null,
    monthlyRentCents: null,
    raw: {},
    ...over,
  };
}

describe("upsertResident — lead attribution match", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockPrisma.resident.findUnique.mockResolvedValue(null);
    mockPrisma.resident.create.mockResolvedValue({ id: "res-1" });
  });

  it("matches a lead case-insensitively so mixed-case AppFolio emails attribute", async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-42" });

    await upsertResident("org-1", "prop-1", null, resident());

    // Match query is case-insensitive + org-scoped (no cross-tenant leak).
    const findArg = mockPrisma.lead.findFirst.mock.calls[0][0];
    expect(findArg.where.orgId).toBe("org-1");
    expect(findArg.where.email).toEqual({
      equals: "Jane@Example.com",
      mode: "insensitive",
    });

    // The created resident carries the matched leadId.
    const createArg = mockPrisma.resident.create.mock.calls[0][0];
    expect(createArg.data.leadId).toBe("lead-42");
  });

  it("leaves leadId null when no lead matches", async () => {
    mockPrisma.lead.findFirst.mockResolvedValue(null);

    await upsertResident("org-1", "prop-1", null, resident());

    const createArg = mockPrisma.resident.create.mock.calls[0][0];
    expect(createArg.data.leadId).toBeNull();
  });

  it("skips the lead lookup entirely when the resident has no email", async () => {
    await upsertResident("org-1", "prop-1", null, resident({ email: null }));

    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    const createArg = mockPrisma.resident.create.mock.calls[0][0];
    expect(createArg.data.leadId).toBeNull();
  });
});
