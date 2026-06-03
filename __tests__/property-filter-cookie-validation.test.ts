import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the active-property cookie helper before importing the SUT so the
// dynamic import inside parsePropertyFilter() resolves to our mocks.
const getActivePropertyId = vi.fn<() => Promise<string | null>>();
const setActivePropertyId = vi.fn<(v: string | null) => Promise<void>>();

vi.mock("@/lib/portal/active-property", () => ({
  getActivePropertyId,
  setActivePropertyId,
  ACTIVE_PROPERTY_COOKIE: "lsx_active_property",
  ALL_PROPERTIES_VALUE: "__all__",
}));

// Mock prisma so we control whether the cookie ID resolves to a
// marketable property.
const findFirst = vi.fn<
  (args: { where: unknown; select: unknown }) => Promise<{ id: string } | null>
>();
vi.mock("@/lib/db", () => ({
  prisma: {
    property: { findFirst: (args: never) => findFirst(args) },
  },
}));

// marketablePropertyWhere is a pure function — let the real impl run.

import { parsePropertyFilter } from "@/lib/tenancy/property-filter";

beforeEach(() => {
  getActivePropertyId.mockReset();
  setActivePropertyId.mockReset().mockResolvedValue(undefined);
  findFirst.mockReset();
});

describe("parsePropertyFilter — cookie validation against marketable set", () => {
  it("returns null when no URL filter and no cookie", async () => {
    getActivePropertyId.mockResolvedValue(null);
    const r = await parsePropertyFilter({}, "org_1");
    expect(r).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
    expect(setActivePropertyId).not.toHaveBeenCalled();
  });

  it("URL filter wins over cookie", async () => {
    getActivePropertyId.mockResolvedValue("from-cookie");
    const r = await parsePropertyFilter(
      { properties: "from-url-1,from-url-2" },
      "org_1",
    );
    expect(r).toEqual(["from-url-1", "from-url-2"]);
    // No cookie lookup since URL won.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns the cookie id when it resolves to a marketable property", async () => {
    getActivePropertyId.mockResolvedValue("prop_active");
    findFirst.mockResolvedValue({ id: "prop_active" });
    const r = await parsePropertyFilter({}, "org_1");
    expect(r).toEqual(["prop_active"]);
    expect(setActivePropertyId).not.toHaveBeenCalled();
  });

  it("falls through to null AND clears cookie when id is not marketable", async () => {
    getActivePropertyId.mockResolvedValue("prop_excluded");
    findFirst.mockResolvedValue(null);
    const r = await parsePropertyFilter({}, "org_1");
    expect(r).toBeNull();
    expect(setActivePropertyId).toHaveBeenCalledWith(null);
  });

  it("falls through to null when cookie id belongs to a different org", async () => {
    getActivePropertyId.mockResolvedValue("prop_other_org");
    // findFirst scoped by orgId+marketable+id returns nothing if the
    // id is from a different org.
    findFirst.mockResolvedValue(null);
    const r = await parsePropertyFilter({}, "org_1");
    expect(r).toBeNull();
    expect(setActivePropertyId).toHaveBeenCalledWith(null);
  });

  it("preserves legacy behavior when called WITHOUT orgId (no validation)", async () => {
    getActivePropertyId.mockResolvedValue("any-id");
    const r = await parsePropertyFilter({});
    expect(r).toEqual(["any-id"]);
    expect(findFirst).not.toHaveBeenCalled();
    expect(setActivePropertyId).not.toHaveBeenCalled();
  });

  it("tolerates prisma errors without throwing — falls through to portfolio view", async () => {
    getActivePropertyId.mockResolvedValue("prop_x");
    findFirst.mockRejectedValue(new Error("DB unreachable"));
    const r = await parsePropertyFilter({}, "org_1");
    // We don't return the unvalidated cookie id here because we couldn't
    // confirm it's marketable — safer to widen to portfolio than to
    // silently scope to a possibly-stale id.
    expect(r).toBeNull();
    expect(setActivePropertyId).toHaveBeenCalledWith(null);
  });

  it("tolerates a setActivePropertyId failure (best-effort clear)", async () => {
    getActivePropertyId.mockResolvedValue("prop_stale");
    findFirst.mockResolvedValue(null);
    setActivePropertyId.mockRejectedValueOnce(
      new Error("cookies() not available"),
    );
    // Should still return null without throwing.
    const r = await parsePropertyFilter({}, "org_1");
    expect(r).toBeNull();
  });
});
