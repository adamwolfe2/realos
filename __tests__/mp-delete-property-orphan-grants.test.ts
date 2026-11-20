import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Per-property users: UserPropertyAccess cascades on Property delete, and
// zero grant rows means UNRESTRICTED. Deleting property C when a teammate's
// only grant is C used to turn that teammate into an org-wide user (sees
// A and B). deleteProperty now refuses and names the teammates.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  db: {
    property: {
      findUnique: vi.fn(async () => ({ id: "prop-c", orgId: "org-1", name: "C" })),
      delete: vi.fn(async () => ({})),
    },
    user: { findMany: vi.fn(async (_a?: any): Promise<any> => []) },
    // deleteProperty also refuses when the property has activity; this file
    // tests the grant guard, so the property is empty.
    lead: { count: vi.fn(async () => 0) },
    lease: { count: vi.fn(async () => 0) },
    resident: { count: vi.fn(async () => 0) },
    chatbotConversation: { count: vi.fn(async () => 0) },
    auditEvent: { create: vi.fn(async () => ({})) },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: h.db }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId: async () => null,
  setActivePropertyId: vi.fn(async () => undefined),
}));
vi.mock("@/lib/integrations/appfolio-backfill", () => ({ requestAppfolioBackfill: vi.fn() }));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return {
    ...actual,
    requireAgency: async () => ({ userId: "agent", orgId: "agency", isAgency: true }),
  };
});

const { deleteProperty } = await import("@/lib/actions/properties");

beforeEach(() => vi.clearAllMocks());

describe("deleteProperty — orphaned grants", () => {
  it("refuses when a teammate's only grant is the property being deleted", async () => {
    h.db.user.findMany.mockResolvedValue([{ email: "only-c@client.test" }]);
    const r = await deleteProperty({ propertyId: "prop-c" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("only-c@client.test");
    expect(h.db.property.delete).not.toHaveBeenCalled();
    // The lookup targets users whose grants are ALL on this property.
    const where = h.db.user.findMany.mock.calls[0][0].where;
    expect(where.propertyAccess).toEqual({
      some: { propertyId: "prop-c" },
      every: { propertyId: "prop-c" },
    });
  });

  it("deletes when every teammate keeps at least one other grant", async () => {
    h.db.user.findMany.mockResolvedValue([]);
    const r = await deleteProperty({ propertyId: "prop-c" });
    expect(r.ok).toBe(true);
    expect(h.db.property.delete).toHaveBeenCalled();
  });
});
