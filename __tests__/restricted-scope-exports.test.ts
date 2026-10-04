import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// F-018: property-restricted users must not read tours, ad spend or popup
// events outside their grant through these org-only routes.

const mocks = vi.hoisted(() => ({
  requireScope: vi.fn(),
  tourFindFirst: vi.fn(),
  popupFindFirst: vi.fn(),
  popupEventFindMany: vi.fn(),
  adDailyFindMany: vi.fn(),
}));

vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {
    status = 403;
  }
  return {
    requireScope: () => mocks.requireScope(),
    tenantWhere: (s: { orgId: string }) => ({ orgId: s.orgId }),
    propertyInScope: (
      s: { allowedPropertyIds: string[] | null },
      id: string | null,
    ) => !id || !s.allowedPropertyIds || s.allowedPropertyIds.includes(id),
    auditPayload: (_s: unknown, r: unknown) => r,
    ForbiddenError,
  };
});
vi.mock("@/lib/db", () => ({
  prisma: {
    tour: { findFirst: (...a: unknown[]) => mocks.tourFindFirst(...a) },
    popupCampaign: { findFirst: (...a: unknown[]) => mocks.popupFindFirst(...a) },
    popupEvent: { findMany: (...a: unknown[]) => mocks.popupEventFindMany(...a) },
    adMetricDaily: { findMany: (...a: unknown[]) => mocks.adDailyFindMany(...a) },
    auditEvent: { create: vi.fn() },
  },
}));

const { GET: toursIcs } = await import("@/app/api/tenant/tours/[id]/ics/route");
const { GET: popupEvents } = await import(
  "@/app/api/portal/popups/[id]/recent-events/route"
);
const { GET: adExport } = await import("@/app/api/tenant/ad-metrics/export/route");

const restricted = {
  orgId: "org-1",
  role: "LEASING_AGENT",
  allowedPropertyIds: ["p-mine"],
};
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireScope.mockResolvedValue(restricted);
});

describe("restricted scope on org-only routes (F-018)", () => {
  it("restricted agent gets 404 on an out-of-scope tour ICS", async () => {
    // Emulate the DB: the tour lives at p-other, so a property-gated where
    // matches nothing.
    mocks.tourFindFirst.mockImplementation(
      (args: { where: { propertyId?: unknown } }) =>
        Promise.resolve(
          args.where.propertyId === undefined
            ? { id: "t1", property: { name: "Other" }, lead: {} }
            : null,
        ),
    );
    const res = await toursIcs(
      new NextRequest("http://localhost/api/tenant/tours/t1/ics"),
      params("t1"),
    );
    expect(res.status).toBe(404);
    expect(mocks.tourFindFirst.mock.calls[0][0].where.propertyId).toBe("p-mine");
  });

  it("restricted user gets 404 on popup events for another property's campaign", async () => {
    mocks.popupFindFirst.mockResolvedValue({ id: "c1", propertyId: "p-other" });
    const res = await popupEvents(
      new NextRequest("http://localhost/api/portal/popups/c1/recent-events"),
      params("c1"),
    );
    expect(res.status).toBe(404);
    expect(mocks.popupEventFindMany).not.toHaveBeenCalled();
  });

  it("ad-metrics export narrows campaigns to the grant plus org-level", async () => {
    mocks.adDailyFindMany.mockResolvedValue([]);
    await adExport(new Request("http://localhost/api/tenant/ad-metrics/export"));
    expect(mocks.adDailyFindMany.mock.calls[0][0].where.campaign).toEqual({
      OR: [{ propertyId: "p-mine" }, { propertyId: null }],
    });
  });
});
