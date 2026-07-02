import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// S4 regression tests: property-scope bypass via URL injection.
//
// Pure-function unit tests on lib/tenancy/property-filter — no DB or auth
// needed. Each test verifies that a scope with allowedPropertyIds=[A] cannot
// be widened by passing extra ids via the URL (?properties=A,B) or other
// vectors.
// ---------------------------------------------------------------------------

import {
  parsePropertyFilterUrlOnly,
  effectivePropertyIds,
  propertyWhereFragment,
  propertyOrOrgLevelWhereFragment,
  isAccessDenied,
} from "@/lib/tenancy/property-filter";

type ScopeWithGate = { allowedPropertyIds: string[] | null };

// ---------------------------------------------------------------------------
// parsePropertyFilterUrlOnly — pure URL parsing
// ---------------------------------------------------------------------------

describe("parsePropertyFilterUrlOnly", () => {
  it("returns null when no params provided", () => {
    expect(parsePropertyFilterUrlOnly({})).toBeNull();
  });

  it("parses a single property via ?properties=", () => {
    expect(parsePropertyFilterUrlOnly({ properties: "prop-A" })).toEqual([
      "prop-A",
    ]);
  });

  it("parses multiple properties via ?properties=A,B,C", () => {
    expect(
      parsePropertyFilterUrlOnly({ properties: "prop-A,prop-B,prop-C" }),
    ).toEqual(["prop-A", "prop-B", "prop-C"]);
  });

  it("trims whitespace around ids", () => {
    expect(parsePropertyFilterUrlOnly({ properties: " prop-A , prop-B " })).toEqual([
      "prop-A",
      "prop-B",
    ]);
  });

  it("parses a legacy single ?property= param", () => {
    expect(parsePropertyFilterUrlOnly({ property: "prop-A" })).toEqual([
      "prop-A",
    ]);
  });

  it("prefers ?properties over ?property when both present", () => {
    expect(
      parsePropertyFilterUrlOnly({ properties: "prop-A", property: "prop-B" }),
    ).toEqual(["prop-A"]);
  });

  it("returns null for empty ?properties string", () => {
    expect(parsePropertyFilterUrlOnly({ properties: ",,," })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// effectivePropertyIds — gate intersection
// ---------------------------------------------------------------------------

describe("effectivePropertyIds — scope gate intersection", () => {
  it("unrestricted scope + no selection → null (no filter = full portfolio)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(effectivePropertyIds(scope, null)).toBeNull();
  });

  it("unrestricted scope + selection → passes selection through unchanged", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(effectivePropertyIds(scope, ["prop-A", "prop-B"])).toEqual([
      "prop-A",
      "prop-B",
    ]);
  });

  it("restricted scope + no selection → returns the full allowed set", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(effectivePropertyIds(scope, null)).toEqual(["prop-A"]);
  });

  it("restricted scope + selection WITHIN allowed → returns intersection", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A", "prop-B"] };
    expect(effectivePropertyIds(scope, ["prop-A"])).toEqual(["prop-A"]);
  });

  it("S4-CORE: restricted scope [A] + selection [A,B] → returns only [A] (B is rejected)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    const result = effectivePropertyIds(scope, ["prop-A", "prop-B"]);
    expect(result).toEqual(["prop-A"]);
    expect(result).not.toContain("prop-B");
  });

  it("S4-CORE: restricted scope [A] + selection [B] → returns [] (no overlap)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(effectivePropertyIds(scope, ["prop-B"])).toEqual([]);
  });

  it("restricted scope + selection with all forbidden ids → returns []", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(effectivePropertyIds(scope, ["prop-X", "prop-Y"])).toEqual([]);
  });

  it("restricted scope + empty array selection → returns [] (no overlap, intersection is empty)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    // In practice parsePropertyFilterUrlOnly never returns [] — it returns null.
    // But if [] were somehow passed in, the intersection of [] ∩ allowed = [].
    expect(effectivePropertyIds(scope, [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// propertyWhereFragment — Prisma where builder with access gate
// ---------------------------------------------------------------------------

describe("propertyWhereFragment — Prisma where fragment with gate", () => {
  it("unrestricted scope + null selection → empty object (no filter)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(propertyWhereFragment(scope, null)).toEqual({});
  });

  it("unrestricted scope + selection → { propertyId: { in: [...] } }", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(propertyWhereFragment(scope, ["prop-A", "prop-B"])).toEqual({
      propertyId: { in: ["prop-A", "prop-B"] },
    });
  });

  it("unrestricted scope + single selection → { propertyId: id }", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(propertyWhereFragment(scope, ["prop-A"])).toEqual({
      propertyId: "prop-A",
    });
  });

  it("S4-CORE: restricted [A] + selection [A,B] → only { propertyId: 'A' } (B dropped)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    const fragment = propertyWhereFragment(scope, ["prop-A", "prop-B"]);
    // Should only contain prop-A, not prop-B
    expect(fragment).toEqual({ propertyId: "prop-A" });
  });

  it("S4-CORE: restricted [A] + selection [B] → sentinel (deny, no leak)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    const fragment = propertyWhereFragment(scope, ["prop-B"]);
    // Should be the sentinel that matches no rows
    expect(fragment).toEqual({ propertyId: "__no_property_access__" });
  });

  it("restricted scope + null selection → { propertyId: allowedId } (full allowed set)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(propertyWhereFragment(scope, null)).toEqual({
      propertyId: "prop-A",
    });
  });

  it("restricted scope + multi allowed + selection of subset → intersection", () => {
    const scope: ScopeWithGate = {
      allowedPropertyIds: ["prop-A", "prop-B", "prop-C"],
    };
    const fragment = propertyWhereFragment(scope, ["prop-A", "prop-C"]);
    expect(fragment).toEqual({ propertyId: { in: ["prop-A", "prop-C"] } });
  });

  it("uses custom field name when specified", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(propertyWhereFragment(scope, ["prop-A"], "id")).toEqual({
      id: "prop-A",
    });
  });
});

// ---------------------------------------------------------------------------
// propertyOrOrgLevelWhereFragment — OR-widening with org-level null rows
// ---------------------------------------------------------------------------

describe("propertyOrOrgLevelWhereFragment", () => {
  it("no filter → empty object (passthrough)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(propertyOrOrgLevelWhereFragment(scope, null)).toEqual({});
  });

  it("single property → OR [ property match, null ]", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    const result = propertyOrOrgLevelWhereFragment(scope, ["prop-A"]);
    expect(result).toEqual({
      OR: [{ propertyId: "prop-A" }, { propertyId: null }],
    });
  });

  it("sentinel is preserved when scope denies access (no org-level widening on deny)", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    const result = propertyOrOrgLevelWhereFragment(scope, ["prop-B"]);
    // Sentinel must not be OR-widened — that would let a denied request see org-level rows
    expect(result).toEqual({ propertyId: "__no_property_access__" });
  });
});

// ---------------------------------------------------------------------------
// isAccessDenied — UI banner helper
// ---------------------------------------------------------------------------

describe("isAccessDenied", () => {
  it("unrestricted scope is never denied", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: null };
    expect(isAccessDenied(scope, ["prop-X"])).toBe(false);
  });

  it("restricted scope + no selection → not denied", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(isAccessDenied(scope, null)).toBe(false);
  });

  it("restricted scope + allowed selection → not denied", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A", "prop-B"] };
    expect(isAccessDenied(scope, ["prop-A"])).toBe(false);
  });

  it("restricted scope + fully forbidden selection → denied", () => {
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(isAccessDenied(scope, ["prop-X", "prop-Y"])).toBe(true);
  });

  it("restricted scope [A] + mixed selection [A, X] → NOT denied (partial match)", () => {
    // Mixed selection: some allowed, some not — partial data, not full denial
    const scope: ScopeWithGate = { allowedPropertyIds: ["prop-A"] };
    expect(isAccessDenied(scope, ["prop-A", "prop-X"])).toBe(false);
  });
});
