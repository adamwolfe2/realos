import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadSource, LeadStatus } from "@prisma/client";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";
import type { MappedLead } from "@/lib/integrations/appfolio";

let mockPrisma: MockPrisma;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

import { upsertAppfolioLead } from "@/lib/integrations/appfolio-sync";

/**
 * Regression: a guest_card lead must NOT create a second Lead row when the
 * applications phase already created one (externalId `application:<id>`) for
 * the same prospect (same org + property + email). The guest_card must ADOPT
 * the application-created lead instead. P1-7 from the launch-readiness audit.
 */
function guestCard(over: Partial<MappedLead> = {}): MappedLead {
  return {
    externalId: "guest_card:gc-1",
    email: "Yunji@Choi.com",
    firstName: "Yunji",
    lastName: "Choi",
    phone: null,
    source: LeadSource.OTHER,
    sourceDetail: "AppFolio guest_card",
    status: LeadStatus.NEW,
    desiredMoveIn: null,
    budgetMaxCents: null,
    preferredUnitType: null,
    notes: null,
    propertyIds: ["af-1"],
    unitIds: [],
    createdAt: new Date("2026-06-01T00:00:00Z"),
    raw: {},
    ...over,
  };
}

describe("upsertAppfolioLead — application/guest_card dedup", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it("adopts the application-created lead instead of creating a duplicate", async () => {
    // No existing guest_card-keyed lead.
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    // An application-created lead exists for the same org + property + email.
    mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-app" });
    mockPrisma.lead.update.mockResolvedValue({ id: "lead-app" });

    await upsertAppfolioLead("org-1", guestCard(), "prop-1");

    // Never created a second row.
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();

    // Looked for an application:* lead scoped to org + property + email.
    const findFirstArg = mockPrisma.lead.findFirst.mock.calls[0][0];
    expect(findFirstArg.where.orgId).toBe("org-1");
    expect(findFirstArg.where.propertyId).toBe("prop-1");
    expect(findFirstArg.where.externalId).toEqual({ startsWith: "application:" });
    expect(findFirstArg.where.email).toEqual({
      equals: "yunji@choi.com",
      mode: "insensitive",
    });

    // Updated THAT lead by its primary id, adopting the guest_card identity.
    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "lead-app" });
    expect(updateArg.data.externalId).toBe("guest_card:gc-1");
    expect(updateArg.data.email).toBe("Yunji@Choi.com");
  });

  it("creates a new lead when no application lead exists for the prospect", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.lead.findFirst.mockResolvedValue(null);
    mockPrisma.lead.create.mockResolvedValue({ id: "lead-new" });

    await upsertAppfolioLead("org-1", guestCard(), "prop-1");

    expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrisma.lead.create.mock.calls[0][0];
    expect(createArg.data.externalId).toBe("guest_card:gc-1");
  });

  it("updates in place when the guest_card lead already exists (idempotent re-sync)", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue({ id: "lead-gc" });
    mockPrisma.lead.update.mockResolvedValue({ id: "lead-gc" });

    await upsertAppfolioLead("org-1", guestCard(), "prop-1");

    // Existing-row path: no dedup lookup, no create.
    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.lead.update).toHaveBeenCalledTimes(1);
  });

  it("skips the dedup lookup when the lead has no email (can't safely match)", async () => {
    mockPrisma.lead.findUnique.mockResolvedValue(null);
    mockPrisma.lead.create.mockResolvedValue({ id: "lead-new" });

    await upsertAppfolioLead("org-1", guestCard({ email: null }), "prop-1");

    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).toHaveBeenCalledTimes(1);
  });
});
