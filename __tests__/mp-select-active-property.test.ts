import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Regression (multi-property): selectActiveProperty spread the restricted
// user's `id: { in: allowed }` gate AFTER `id: rawValue`, overwriting the
// picked id. A user allowed on A and B who picked B got a cookie for
// whichever allowed property findFirst returned first (often A).
// Two-property org: prop-a, prop-b. Third property prop-c is outside the
// user's grant.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  findFirst: vi.fn(),
  setActivePropertyId: vi.fn(async () => {}),
  requireScope: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { property: { findFirst: h.findFirst } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/portal/active-property", () => ({
  setActivePropertyId: h.setActivePropertyId,
}));
vi.mock("@/lib/tenancy/scope", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tenancy/scope")>(
    "@/lib/tenancy/scope",
  );
  return { ...actual, requireScope: () => h.requireScope() };
});

import { selectActiveProperty } from "@/lib/actions/active-property";

const restricted = { orgId: "org-1", allowedPropertyIds: ["prop-a", "prop-b"] };

beforeEach(() => {
  vi.clearAllMocks();
  // Behaves like the DB: return the first row matching the where's id.
  h.findFirst.mockImplementation(async ({ where }: { where: { id: unknown } }) => {
    const rows = ["prop-a", "prop-b", "prop-c"];
    const id = where.id;
    if (typeof id === "string") return rows.includes(id) ? { id } : null;
    const list = (id as { in: string[] }).in;
    return list.length ? { id: list[0] } : null;
  });
});

describe("selectActiveProperty — restricted user, two allowed properties", () => {
  it("persists the property the user picked, not an arbitrary allowed one", async () => {
    h.requireScope.mockResolvedValue(restricted);
    await selectActiveProperty("prop-b");
    expect(h.setActivePropertyId).toHaveBeenCalledWith("prop-b");
    expect(h.findFirst.mock.calls[0][0].where.id).toBe("prop-b");
  });

  it("falls back to All for a property outside the grant, without a lookup", async () => {
    h.requireScope.mockResolvedValue(restricted);
    await selectActiveProperty("prop-c");
    expect(h.setActivePropertyId).toHaveBeenCalledWith(null);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("unrestricted user can pick any marketable property in the org", async () => {
    h.requireScope.mockResolvedValue({ orgId: "org-1", allowedPropertyIds: null });
    await selectActiveProperty("prop-c");
    expect(h.setActivePropertyId).toHaveBeenCalledWith("prop-c");
    expect(h.findFirst.mock.calls[0][0].where.orgId).toBe("org-1");
  });
});
