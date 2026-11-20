import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Multi-property: deleting or archiving one building of several.
// Before: deleteProperty hard-deleted any property, cascading its leases,
// residents, tours, applications and SEO data and orphaning its leads and
// chats to org level; and archiving/excluding/deleting the property the
// acting user had selected left their switcher cookie pointing at it.
// After: hard delete is refused once the property has leads, leases,
// residents or conversations (archive/exclude instead; empty properties
// still delete), and the acting user's cookie is cleared.
// ---------------------------------------------------------------------------

const count = () => vi.fn(async () => 0);
const h = vi.hoisted(() => ({
  db: {} as Record<string, Record<string, ReturnType<typeof vi.fn>>>,
  active: null as string | null,
  setActive: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_t, k) => h.db[k as string] }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/integrations/appfolio-backfill", () => ({
  requestAppfolioBackfill: vi.fn(),
}));
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: async () => h.active,
  setActivePropertyId: h.setActive,
}));
const scope = {
  userId: "u1",
  orgId: "org-1",
  role: "AGENCY_OWNER",
  isAgency: true,
  allowedPropertyIds: null,
};
vi.mock("@/lib/tenancy/scope", () => ({
  ForbiddenError: class extends Error {},
  requireAgency: async () => scope,
  requireWorkspaceAdmin: async () => scope,
  requireWritableWorkspace: async () => scope,
  auditPayload: (_s: unknown, d: object) => d,
  propertyInScope: () => true,
}));

const { deleteProperty, setPropertyLifecycle } = await import(
  "@/lib/actions/properties"
);

beforeEach(() => {
  h.active = null;
  h.setActive.mockClear();
  h.db = {
    property: {
      findUnique: vi.fn(async () => ({
        id: "prop-b",
        orgId: "org-1",
        name: "Building B",
        lifecycle: "ACTIVE",
      })),
      delete: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
    },
    lead: { count: count() },
    lease: { count: count() },
    resident: { count: count() },
    chatbotConversation: { count: count() },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
});

describe("deleteProperty", () => {
  it("refuses to hard-delete a property that has leads and leases", async () => {
    h.db.lead.count.mockResolvedValue(12);
    h.db.lease.count.mockResolvedValue(1);
    const r = await deleteProperty({ propertyId: "prop-b" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("12 leads");
      expect(r.error).toContain("1 lease");
      expect(r.error).toMatch(/Archive or exclude/);
    }
    expect(h.db.property.delete).not.toHaveBeenCalled();
  });

  it("refuses when only chat conversations exist", async () => {
    h.db.chatbotConversation.count.mockResolvedValue(3);
    const r = await deleteProperty({ propertyId: "prop-b" });
    expect(r.ok).toBe(false);
    expect(h.db.property.delete).not.toHaveBeenCalled();
  });

  it("still deletes an empty property and clears the caller's switcher", async () => {
    h.active = "prop-b";
    const r = await deleteProperty({ propertyId: "prop-b" });
    expect(r).toEqual({ ok: true });
    expect(h.db.property.delete).toHaveBeenCalledWith({ where: { id: "prop-b" } });
    expect(h.setActive).toHaveBeenCalledWith(null);
  });
});

describe("setPropertyLifecycle and the active-property cookie", () => {
  it("archiving the selected property clears the caller's switcher", async () => {
    h.active = "prop-b";
    expect((await setPropertyLifecycle({ propertyId: "prop-b", action: "archive" })).ok).toBe(true);
    expect(h.setActive).toHaveBeenCalledWith(null);
  });

  it("archiving a different property leaves the selection alone", async () => {
    h.active = "prop-a";
    await setPropertyLifecycle({ propertyId: "prop-b", action: "exclude" });
    expect(h.setActive).not.toHaveBeenCalled();
  });

  it("activating the selected property keeps it selected", async () => {
    h.active = "prop-b";
    await setPropertyLifecycle({ propertyId: "prop-b", action: "activate" });
    expect(h.setActive).not.toHaveBeenCalled();
  });
});
