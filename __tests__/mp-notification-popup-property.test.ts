// Multi-property: the bell is per seat and popup events carry their building.
//  - notification helpers stamp propertyId
//  - a property-restricted seat reads and acts only on its own buildings'
//    notifications (never org-level rows); org-wide seats see everything
//  - popup events are stamped; a restricted seat can't test-fire another
//    building's campaign
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  scope: vi.fn(),
  nCreate: vi.fn(),
  nFindMany: vi.fn(),
  nFindFirst: vi.fn(),
  nCount: vi.fn(),
  nUpdateMany: vi.fn(),
  campaignFindFirst: vi.fn(),
  campaignUpdate: vi.fn(),
  eventCreate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tenancy/scope", () => {
  class ForbiddenError extends Error {}
  return {
    requireScope: () => h.scope(),
    requireWritableWorkspace: () => h.scope(),
    propertyInScope: (
      s: { allowedPropertyIds: string[] | null },
      id: string | null,
    ) => !id || !s.allowedPropertyIds || s.allowedPropertyIds.includes(id),
    ForbiddenError,
  };
});
vi.mock("@/lib/db", () => {
  const prisma = {
    notification: {
      create: h.nCreate,
      findMany: h.nFindMany,
      findFirst: h.nFindFirst,
      count: h.nCount,
      updateMany: h.nUpdateMany,
    },
    popupCampaign: { findFirst: h.campaignFindFirst, update: h.campaignUpdate },
    popupEvent: { create: h.eventCreate },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { prisma };
});

const { notifyLeadCreated, notifyNewInsight, notifyIntegrationError } =
  await import("@/lib/notifications/create");
const { markAllRead, resolveNotification } = await import(
  "@/lib/actions/notifications"
);
const { GET: inbox } = await import("@/app/api/portal/notifications/route");
const { GET: unread } = await import(
  "@/app/api/portal/notifications/unread-count/route"
);
const { GET: recent } = await import("@/app/api/portal/notifications/recent/route");
const { recordPopupEvent } = await import("@/lib/popups/queries");
const { POST: testFire } = await import(
  "@/app/api/portal/popups/[id]/test-fire/route"
);

const restricted = { orgId: "org-1", allowedPropertyIds: ["p-mine"] };
const orgWide = { orgId: "org-1", allowedPropertyIds: null };
const MINE_ONLY = { orgId: "org-1", AND: [{ propertyId: "p-mine" }] };

beforeEach(() => {
  for (const m of Object.values(h)) m.mockReset();
  h.nFindMany.mockResolvedValue([]);
  h.nCount.mockResolvedValue(0);
  h.nUpdateMany.mockResolvedValue({ count: 0 });
});

describe("notification stamping", () => {
  it("stamps the lead's property", async () => {
    await notifyLeadCreated({
      id: "l1", orgId: "org-1", propertyId: "p-mine",
      firstName: "A", lastName: null, email: null, source: "FORM",
    });
    expect(h.nCreate.mock.calls[0][0].data.propertyId).toBe("p-mine");
  });

  it("stamps the insight's property", async () => {
    h.nFindFirst.mockResolvedValue(null); // no duplicate yet
    await notifyNewInsight({
      id: "i1", orgId: "org-1", propertyId: "p-mine",
      severity: "critical", title: "t", body: "b",
    });
    expect(h.nCreate.mock.calls[0][0].data.propertyId).toBe("p-mine");
  });

  it("leaves org-level notifications unstamped", async () => {
    await notifyIntegrationError("org-1", "AppFolio", "boom");
    expect(h.nCreate.mock.calls[0][0].data.propertyId).toBeUndefined();
  });
});

describe("notification visibility", () => {
  it("org-wide seat keeps every row in the org", async () => {
    h.scope.mockResolvedValue(orgWide);
    await unread();
    expect(h.nCount.mock.calls[0][0].where).toMatchObject({ orgId: "org-1", AND: [{}] });
  });

  it("inbox, unread count and bell all apply it", async () => {
    h.scope.mockResolvedValue(restricted);
    await inbox(new NextRequest("http://x/api/portal/notifications"));
    await unread();
    await recent();
    expect(h.nFindMany.mock.calls[0][0].where).toMatchObject(MINE_ONLY);
    expect(h.nCount.mock.calls[0][0].where).toMatchObject(MINE_ONLY);
    expect(h.nFindMany.mock.calls[1][0].where).toMatchObject(MINE_ONLY);
  });

  it("mark-all-read and resolve can't touch other buildings' rows", async () => {
    h.scope.mockResolvedValue(restricted);
    await markAllRead();
    await resolveNotification("n-other");
    expect(h.nUpdateMany.mock.calls[0][0].where).toMatchObject(MINE_ONLY);
    expect(h.nUpdateMany.mock.calls[1][0].where).toMatchObject({
      id: "n-other",
      ...MINE_ONLY,
    });
  });
});

describe("popup events", () => {
  it("recordPopupEvent stamps the property", async () => {
    h.eventCreate.mockResolvedValue({ id: "e1" });
    await recordPopupEvent({
      orgId: "org-1", campaignId: "c1", propertyId: "p-mine", type: "SHOWN",
    });
    expect(h.eventCreate.mock.calls[0][0].data.propertyId).toBe("p-mine");
  });

  it("restricted seat can't test-fire another building's campaign", async () => {
    h.scope.mockResolvedValue(restricted);
    h.campaignFindFirst.mockResolvedValue({ id: "c2", headline: "x", propertyId: "p-other" });
    const res = await testFire(new NextRequest("http://x", { method: "POST" }), {
      params: Promise.resolve({ id: "c2" }),
    });
    expect(res.status).toBe(404);
    expect(h.eventCreate).not.toHaveBeenCalled();
  });

  it("test-fire on an in-grant campaign stamps its property", async () => {
    h.scope.mockResolvedValue(restricted);
    h.campaignFindFirst.mockResolvedValue({ id: "c1", headline: "x", propertyId: "p-mine" });
    h.eventCreate.mockResolvedValue({ id: "e1", type: "SHOWN", occurredAt: new Date() });
    h.campaignUpdate.mockResolvedValue({});
    await testFire(new NextRequest("http://x", { method: "POST" }), {
      params: Promise.resolve({ id: "c1" }),
    });
    expect(h.eventCreate.mock.calls[0][0].data.propertyId).toBe("p-mine");
  });
});
