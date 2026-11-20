import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Popup editor actions on a multi-property org. A user granted only property
// A must not attach a popup to B, nor edit/pause/delete B's popups. The org
// check alone (orgId) let them, because both buildings share one org.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  scope: null as unknown,
  popupCampaign: {
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  property: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    popupCampaign: h.popupCampaign,
    property: h.property,
    auditEvent: h.auditEvent,
  },
}));
vi.mock("@/lib/tenancy/scope", async (orig) => ({
  // Real propertyInScope: the grant rule under test is not mocked.
  ...(await orig<typeof import("@/lib/tenancy/scope")>()),
  requireWritableWorkspace: vi.fn(async () => h.scope),
  auditPayload: vi.fn((_s: unknown, p: object) => p),
}));

const actions = await import("@/lib/actions/popup-actions");

const VALID = {
  name: "Spring special",
  headline: "Spring special",
  body: "Two weeks free",
  ctaText: "Claim",
  ctaUrl: "/apply",
};

const RESTRICTED_TO_A = { orgId: "org_1", allowedPropertyIds: ["prop_a"], role: "CLIENT_ADMIN" };
const UNRESTRICTED = { orgId: "org_1", allowedPropertyIds: null, role: "CLIENT_ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  h.scope = RESTRICTED_TO_A;
  h.property.findFirst.mockImplementation(async ({ where }: { where: { id: string } }) =>
    ["prop_a", "prop_b"].includes(where.id) ? { id: where.id } : null,
  );
  h.popupCampaign.create.mockResolvedValue({ id: "pop_new" });
  h.popupCampaign.updateMany.mockResolvedValue({ count: 1 });
  h.popupCampaign.deleteMany.mockResolvedValue({ count: 1 });
  h.popupCampaign.findFirst.mockResolvedValue({
    name: "B popup",
    status: "ACTIVE",
    propertyId: "prop_b",
  });
});

describe("popup actions honour the property grant", () => {
  it("createPopup refuses a property outside the user's grant", async () => {
    const res = await actions.createPopup({ ...VALID, propertyId: "prop_b" });
    expect(res.ok).toBe(false);
    expect(h.popupCampaign.create).not.toHaveBeenCalled();
  });

  it("createPopup allows a property inside the grant", async () => {
    const res = await actions.createPopup({ ...VALID, propertyId: "prop_a" });
    expect(res.ok).toBe(true);
  });

  it("updatePopup refuses to edit a popup bound to another property", async () => {
    const res = await actions.updatePopup("pop_b", { ...VALID, propertyId: "prop_a" });
    expect(res.ok).toBe(false);
    expect(h.popupCampaign.updateMany).not.toHaveBeenCalled();
  });

  it("updatePopup refuses to move an in-grant popup to another property", async () => {
    h.popupCampaign.findFirst.mockResolvedValue({ name: "A", status: "ACTIVE", propertyId: "prop_a" });
    const res = await actions.updatePopup("pop_a", { ...VALID, propertyId: "prop_b" });
    expect(res.ok).toBe(false);
    expect(h.popupCampaign.updateMany).not.toHaveBeenCalled();
  });

  it("setPopupStatus refuses another property's popup", async () => {
    const res = await actions.setPopupStatus("pop_b", "PAUSED");
    expect(res.ok).toBe(false);
    expect(h.popupCampaign.updateMany).not.toHaveBeenCalled();
  });

  it("deletePopup refuses another property's popup", async () => {
    const res = await actions.deletePopup("pop_b");
    expect(res.ok).toBe(false);
    expect(h.popupCampaign.deleteMany).not.toHaveBeenCalled();
  });

  it("an unrestricted user can still edit any property's popup", async () => {
    h.scope = UNRESTRICTED;
    const res = await actions.updatePopup("pop_b", { ...VALID, propertyId: "prop_b" });
    expect(res.ok).toBe(true);
    expect(h.popupCampaign.updateMany).toHaveBeenCalled();
  });
});
