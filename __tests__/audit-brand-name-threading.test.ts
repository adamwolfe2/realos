import { describe, it, expect } from "vitest";
import { resolveProspectBrandName } from "@/lib/signals/compute";
import { brandNameFromDomain } from "@/lib/audit/reputation-prospect";

// Regression guard (Adam 2026-08-19): an audit created with brandName
// "Warwick" asked every AI engine about "Leasestack" instead, because the
// prospect scan derived the brand from the domain and ignored what was
// typed into the form. The report then rendered "Warwick" over answers
// about a different company. This name feeds the engine prompts, the
// reputation mention scan, and the Google AI Overview query.
describe("resolveProspectBrandName", () => {
  it("uses the typed property name over the domain", () => {
    expect(resolveProspectBrandName("Warwick", "leasestack.co")).toBe("Warwick");
  });

  it("keeps the typed name even when it looks nothing like the domain", () => {
    expect(
      resolveProspectBrandName("The Standard at Berkeley", "livehigby.com"),
    ).toBe("The Standard at Berkeley");
  });

  it("falls back to the domain when nothing was supplied", () => {
    for (const empty of [null, undefined, "", "   "]) {
      expect(resolveProspectBrandName(empty, "thewarwickhillcrest.com")).toBe(
        brandNameFromDomain("thewarwickhillcrest.com"),
      );
    }
  });

  it("never returns an empty string — an empty query scans nothing", () => {
    for (const input of [null, "", "  ", "Warwick"]) {
      expect(
        resolveProspectBrandName(input, "leasestack.co").trim().length,
      ).toBeGreaterThan(0);
    }
  });

  it("trims incidental whitespace from the typed name", () => {
    expect(resolveProspectBrandName("  Warwick  ", "leasestack.co")).toBe(
      "Warwick",
    );
  });
});
