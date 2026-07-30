import { describe, it, expect } from "vitest";
import { matchesPropertyFilter } from "@/app/portal/vault/vault-client";

// Regression for PORTAL-PROPERTIES-D003: the "Org-wide only" filter option
// sends the sentinel "__org", which is never a real propertyId. Org-wide
// entries are the ones with propertyId === null, not propertyId === "__org".

describe("matchesPropertyFilter", () => {
  it("no filter matches everything", () => {
    expect(matchesPropertyFilter(null, "")).toBe(true);
    expect(matchesPropertyFilter("prop_1", "")).toBe(true);
  });

  it("__org matches only org-wide (propertyId === null) entries", () => {
    expect(matchesPropertyFilter(null, "__org")).toBe(true);
    expect(matchesPropertyFilter("prop_1", "__org")).toBe(false);
  });

  it("a real propertyId filters to that property only", () => {
    expect(matchesPropertyFilter("prop_1", "prop_1")).toBe(true);
    expect(matchesPropertyFilter("prop_2", "prop_1")).toBe(false);
    expect(matchesPropertyFilter(null, "prop_1")).toBe(false);
  });
});
