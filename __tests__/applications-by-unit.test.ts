import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockPrisma, type MockPrisma } from "./helpers/mock-prisma";

let mockPrisma: MockPrisma;
vi.mock("@/lib/db", () => ({
  get prisma() {
    return mockPrisma;
  },
}));

import { getApplicationsByUnit } from "@/lib/applications/queries";

function row(over: Record<string, unknown>) {
  return {
    id: "app",
    status: "SUBMITTED",
    applicantRole: "PRIMARY",
    applicationGroupId: null,
    unitName: null,
    unitExternalId: null,
    desiredMoveIn: null,
    receivedAt: new Date("2026-06-01T00:00:00Z"),
    appliedAt: null,
    decidedAt: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    screeningStatus: null,
    property: { id: "p1", name: "Telegraph Commons" },
    lead: {
      id: "lead",
      firstName: "First",
      lastName: "Last",
      email: "x@y.com",
      phone: null,
    },
    ...over,
  };
}

describe("getApplicationsByUnit", () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  it("passes the tenant + property scope straight through to prisma", async () => {
    mockPrisma.application.findMany.mockResolvedValue([]);
    const leadWhere = { orgId: "org-1" };
    const propertyClause = { propertyId: { in: ["p1"] } };

    await getApplicationsByUnit(leadWhere as never, propertyClause as never);

    const arg = mockPrisma.application.findMany.mock.calls[0][0];
    expect(arg.where.lead).toEqual(leadWhere);
    expect(arg.where.propertyId).toEqual({ in: ["p1"] });
    // never widens beyond the supplied scope
    expect(arg.where).toHaveProperty("createdAt");
  });

  it("groups by unit and folds a co-signer under the primary applicant", async () => {
    mockPrisma.application.findMany.mockResolvedValue([
      row({
        id: "a1",
        unitExternalId: "u203a",
        unitName: "203 - A",
        applicationGroupId: "g1",
        applicantRole: "PRIMARY",
        status: "SUBMITTED",
        lead: { id: "l1", firstName: "Yunji", lastName: "Choi", email: "y@c.com", phone: null },
      }),
      row({
        id: "b1",
        unitExternalId: "u208",
        unitName: "208",
        applicationGroupId: "g2",
        applicantRole: "PRIMARY",
        status: "UNDER_REVIEW",
        receivedAt: new Date("2026-05-29T14:44:00Z"),
        createdAt: new Date("2026-05-29T14:44:00Z"),
        lead: { id: "l2", firstName: "Shawn", lastName: "Savage", email: "s@s.com", phone: null },
      }),
      row({
        id: "c1",
        unitExternalId: "u208",
        unitName: "208",
        applicationGroupId: "g2",
        applicantRole: "CO_SIGNER",
        status: "UNDER_REVIEW",
        receivedAt: new Date("2026-05-29T15:20:00Z"),
        createdAt: new Date("2026-05-29T15:20:00Z"),
        lead: { id: "l3", firstName: "Travis", lastName: "Bristol", email: "t@b.com", phone: null },
      }),
    ]);

    const units = await getApplicationsByUnit({} as never, {} as never);

    const u208 = units.find((u) => u.unitName === "208")!;
    expect(u208).toBeDefined();
    expect(u208.applicantCount).toBe(2);
    expect(u208.groups).toHaveLength(1);

    const group = u208.groups[0];
    expect(group.applicants).toHaveLength(2);
    // primary first, co-signer second
    expect(group.applicants[0].isPrimary).toBe(true);
    expect(group.applicants[0].name).toBe("Shawn Savage");
    expect(group.applicants[1].role).toBe("CO_SIGNER");
    expect(group.applicants[1].name).toBe("Travis Bristol");
    // group rollup reflects the primary applicant
    expect(group.primaryName).toBe("Shawn Savage");
    expect(group.status).toBe("UNDER_REVIEW");
  });

  it("does not collapse identical unit ids across different properties", async () => {
    mockPrisma.application.findMany.mockResolvedValue([
      row({
        id: "a",
        unitExternalId: "u1",
        unitName: "Unit 1",
        property: { id: "p1", name: "Prop One" },
        applicationGroupId: "ga",
      }),
      row({
        id: "b",
        unitExternalId: "u1",
        unitName: "Unit 1",
        property: { id: "p2", name: "Prop Two" },
        applicationGroupId: "gb",
      }),
    ]);

    const units = await getApplicationsByUnit({} as never, {} as never);
    expect(units).toHaveLength(2);
    expect(new Set(units.map((u) => u.propertyId))).toEqual(
      new Set(["p1", "p2"]),
    );
  });

  it("labels applications with no unit as Unassigned", async () => {
    mockPrisma.application.findMany.mockResolvedValue([
      row({ id: "a", unitExternalId: null, unitName: null, applicationGroupId: "g" }),
    ]);
    const units = await getApplicationsByUnit({} as never, {} as never);
    expect(units[0].unitName).toBe("Unassigned unit");
  });
});
