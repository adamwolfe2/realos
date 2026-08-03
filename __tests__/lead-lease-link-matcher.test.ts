import { describe, it, expect } from "vitest";
import {
  buildLeadMatchIndex,
  matchResidentToLead,
  phoneKey,
  nameKey,
  LEAD_STATUSES_BELOW_SIGNED,
} from "@/lib/leads/lead-lease-link";

// ---------------------------------------------------------------------------
// Lead↔Resident auto-match rules (2026-08-02 proof chain). Invariant under
// test: a tier only links when it names EXACTLY ONE lead; ambiguity at any
// tier aborts the whole match (false links are worse than missing links).
// ---------------------------------------------------------------------------

const lead = (
  id: string,
  over: Partial<{
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    propertyId: string | null;
  }> = {},
) => ({
  id,
  email: null,
  phone: null,
  firstName: null,
  lastName: null,
  propertyId: null,
  ...over,
});

describe("phoneKey", () => {
  it("normalizes formatting and country code onto the last 10 digits", () => {
    expect(phoneKey("+1 (405) 555-0100")).toBe("4055550100");
    expect(phoneKey("405.555.0100")).toBe("4055550100");
    expect(phoneKey("14055550100")).toBe("4055550100");
  });
  it("rejects partial numbers instead of colliding on suffixes", () => {
    expect(phoneKey("555-0100")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe("nameKey", () => {
  it("normalizes case and whitespace", () => {
    expect(nameKey("  Ada ", "LOVELACE")).toBe("ada lovelace");
    expect(nameKey("Mary  Jane", "Watson")).toBe("mary jane watson");
  });
  it("requires both parts with 2+ chars", () => {
    expect(nameKey("J", "Smith")).toBeNull();
    expect(nameKey("Ada", "")).toBeNull();
    expect(nameKey(null, "Smith")).toBeNull();
  });
});

describe("matchResidentToLead", () => {
  it("matches by email first, case-insensitively", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { email: "Ada@Example.com" }),
      lead("l2", { phone: "4055550100" }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: "ada@example.com",
        phone: "4055550100", // would match l2, but email tier wins
        firstName: null,
        lastName: null,
      }),
    ).toEqual({ leadId: "l1", via: "email" });
  });

  it("falls through email → phone → name when earlier tiers have no candidate", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { phone: "+1 405 555 0100", propertyId: "p1" }),
      lead("l2", { firstName: "Ada", lastName: "Lovelace", propertyId: "p1" }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: "nobody@example.com",
        phone: "(405) 555-0100",
        firstName: null,
        lastName: null,
        propertyId: "p1",
      }),
    ).toEqual({ leadId: "l1", via: "phone" });
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: null,
        firstName: "ADA",
        lastName: "lovelace",
        propertyId: "p1",
      }),
    ).toEqual({ leadId: "l2", via: "name" });
  });

  it("ambiguity at a tier ABORTS the match — it never falls through to a weaker tier", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { email: "shared@example.com", phone: "4055550100" }),
      lead("l2", { email: "shared@example.com" }),
    ]);
    // email is ambiguous (2 leads); phone would name l1 uniquely, but the
    // rule is abort-on-ambiguity, not fall-through.
    expect(
      matchResidentToLead(idx, {
        email: "shared@example.com",
        phone: "4055550100",
        firstName: null,
        lastName: null,
      }),
    ).toBeNull();
  });

  it("ambiguous names never match", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { firstName: "John", lastName: "Smith", propertyId: "p1" }),
      lead("l2", { firstName: "john", lastName: "smith", propertyId: "p1" }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: null,
        firstName: "John",
        lastName: "Smith",
        propertyId: "p1",
      }),
    ).toBeNull();
  });

  it("weak tiers require the SAME building — a Property A lead never proves a Property B lease", () => {
    const idx = buildLeadMatchIndex([
      lead("l-phone", { phone: "4055550100", propertyId: "prop_a" }),
      lead("l-name", {
        firstName: "John",
        lastName: "Smith",
        propertyId: "prop_a",
      }),
    ]);
    // Unique across the org, but captured for a different building.
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: "405.555.0100",
        firstName: null,
        lastName: null,
        propertyId: "prop_b",
      }),
    ).toBeNull();
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: null,
        firstName: "John",
        lastName: "Smith",
        propertyId: "prop_b",
      }),
    ).toBeNull();
    // Same building → allowed.
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: "405.555.0100",
        firstName: null,
        lastName: null,
        propertyId: "prop_a",
      }),
    ).toEqual({ leadId: "l-phone", via: "phone" });
  });

  it("an org-wide capture (lead propertyId null) still qualifies on weak tiers", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { phone: "4055550100", propertyId: null }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: "4055550100",
        firstName: null,
        lastName: null,
        propertyId: "prop_b",
      }),
    ).toEqual({ leadId: "l1", via: "phone" });
  });

  it("email stands alone — a globally unique identifier needs no building corroboration", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { email: "ada@example.com", propertyId: "prop_a" }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: "ada@example.com",
        phone: null,
        firstName: null,
        lastName: null,
        propertyId: "prop_b",
      }),
    ).toEqual({ leadId: "l1", via: "email" });
  });

  it("skips weak tiers entirely when the resident has no building", () => {
    const idx = buildLeadMatchIndex([
      lead("l1", { phone: "4055550100", propertyId: "prop_a" }),
    ]);
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: "4055550100",
        firstName: null,
        lastName: null,
      }),
    ).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const idx = buildLeadMatchIndex([lead("l1", { email: "a@b.com" })]);
    expect(
      matchResidentToLead(idx, {
        email: null,
        phone: null,
        firstName: null,
        lastName: null,
      }),
    ).toBeNull();
  });
});

describe("LEAD_STATUSES_BELOW_SIGNED", () => {
  it("never includes terminal or already-signed states (a link must not resurrect LOST/UNQUALIFIED or re-stamp SIGNED)", () => {
    expect(LEAD_STATUSES_BELOW_SIGNED).not.toContain("SIGNED");
    expect(LEAD_STATUSES_BELOW_SIGNED).not.toContain("LOST");
    expect(LEAD_STATUSES_BELOW_SIGNED).not.toContain("UNQUALIFIED");
  });
});
