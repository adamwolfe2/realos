import { describe, it, expect, vi, beforeEach } from "vitest";
import { LeadSource, VisitorIdentificationStatus } from "@prisma/client";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

const notifyLeadCaptured = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/notifications/lead-notify", () => ({
  notifyLeadCaptured: (...args: unknown[]) => notifyLeadCaptured(...args),
}));

import { ensureLeadFromVisitor } from "@/lib/visitors/ensure-lead-from-visitor";

function visitor(over: Record<string, unknown> = {}) {
  return {
    id: "vis-1",
    orgId: "org-1",
    propertyId: "prop-1",
    email: "Jane@Example.com",
    firstName: "Jane",
    lastName: "Doe",
    phone: null,
    enrichedData: { PERSONAL_CITY: "Berkeley", PERSONAL_STATE: "CA" },
    ...over,
  };
}

describe("ensureLeadFromVisitor", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    notifyLeadCaptured.mockClear();
  });

  it("returns null and touches nothing when the visitor has no email", async () => {
    const result = await ensureLeadFromVisitor(visitor({ email: null }));
    expect(result).toBeNull();
    expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
  });

  it("creates a PIXEL_OUTREACH lead linked to the visitor and flips visitor status", async () => {
    mockPrisma.lead.findFirst.mockResolvedValue(null);
    mockPrisma.lead.create.mockResolvedValue({ id: "lead-new" });
    mockPrisma.visitor.update.mockResolvedValue({ id: "vis-1" });

    const result = await ensureLeadFromVisitor(visitor());

    expect(result).toEqual({ leadId: "lead-new", created: true });

    const createArg = mockPrisma.lead.create.mock.calls[0][0];
    expect(createArg.data.source).toBe(LeadSource.PIXEL_OUTREACH);
    expect(createArg.data.visitorId).toBe("vis-1");
    expect(createArg.data.orgId).toBe("org-1");
    expect(createArg.data.propertyId).toBe("prop-1");
    // Email is persisted lowercased for consistent downstream matching.
    expect(createArg.data.email).toBe("jane@example.com");

    // Visitor flipped to MATCHED_TO_LEAD.
    const visUpdate = mockPrisma.visitor.update.mock.calls[0][0];
    expect(visUpdate.data.status).toBe(
      VisitorIdentificationStatus.MATCHED_TO_LEAD,
    );
    expect(notifyLeadCaptured).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: returns the existing lead (no create) when one is tied to the visitor", async () => {
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: "lead-existing",
      visitorId: "vis-1",
    });

    const result = await ensureLeadFromVisitor(visitor());

    expect(result).toEqual({ leadId: "lead-existing", created: false });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    expect(notifyLeadCaptured).not.toHaveBeenCalled();
  });

  it("matches an existing lead case-insensitively by email and backfills the visitor link", async () => {
    // An email-matched lead exists (e.g. a chatbot lead) but has no visitorId.
    mockPrisma.lead.findFirst.mockResolvedValue({
      id: "lead-chatbot",
      visitorId: null,
    });
    mockPrisma.lead.update.mockResolvedValue({ id: "lead-chatbot" });

    const result = await ensureLeadFromVisitor(visitor());

    expect(result).toEqual({ leadId: "lead-chatbot", created: false });
    expect(mockPrisma.lead.create).not.toHaveBeenCalled();

    // Idempotency lookup used a case-insensitive email match.
    const findArg = mockPrisma.lead.findFirst.mock.calls[0][0];
    const emailClause = findArg.where.OR.find(
      (c: Record<string, unknown>) => "email" in c,
    );
    expect(emailClause.email).toEqual({
      equals: "jane@example.com",
      mode: "insensitive",
    });

    // Backfilled the visitor link onto the pre-existing lead.
    const updateArg = mockPrisma.lead.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "lead-chatbot" });
    expect(updateArg.data.visitorId).toBe("vis-1");
  });
});
