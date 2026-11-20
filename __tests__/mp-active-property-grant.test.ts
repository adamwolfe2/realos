import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Per-property users: a restricted user's cookie can still name a property
// whose grant was revoked. The layout switcher dropped it (showed "All"),
// but parsePropertyFilter returned it, effectivePropertyIds intersected it
// to [], and every page rendered empty. getActivePropertyId now ignores a
// cookie outside the user's grant, so both sides resolve to "all of the
// user's properties".
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  cookie: vi.fn<() => string | undefined>(),
  scope: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => {
      const v = h.cookie();
      return v ? { value: v } : undefined;
    },
  }),
}));
vi.mock("@/lib/tenancy/scope", () => ({ getScope: () => h.scope() }));

import { getActivePropertyId } from "@/lib/portal/active-property";

beforeEach(() => vi.clearAllMocks());

describe("getActivePropertyId honours the user's property grant", () => {
  it("ignores a cookie for a property outside a restricted user's grant", async () => {
    h.cookie.mockReturnValue("prop-a");
    h.scope.mockResolvedValue({ allowedPropertyIds: ["prop-b"] });
    expect(await getActivePropertyId()).toBeNull();
  });

  it("keeps a cookie inside the grant", async () => {
    h.cookie.mockReturnValue("prop-b");
    h.scope.mockResolvedValue({ allowedPropertyIds: ["prop-b", "prop-c"] });
    expect(await getActivePropertyId()).toBe("prop-b");
  });

  it("unrestricted users keep any cookie (org + marketable checks happen later)", async () => {
    h.cookie.mockReturnValue("prop-a");
    h.scope.mockResolvedValue({ allowedPropertyIds: null });
    expect(await getActivePropertyId()).toBe("prop-a");
  });

  it("an explicit cookie store skips the scope lookup", async () => {
    const store = { get: () => ({ value: "prop-a" }) };
    expect(await getActivePropertyId(store)).toBe("prop-a");
    expect(h.scope).not.toHaveBeenCalled();
  });
});
