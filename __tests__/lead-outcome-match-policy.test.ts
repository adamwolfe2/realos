import { describe, expect, it } from "vitest";
import {
  evaluateResidentLeadMatch,
  normalizeEmail,
  normalizedNameVariants,
} from "@/lib/leads/outcome-match-policy";
import type {
  LeadMatchCandidate,
  ResidentMatchInput,
} from "@/lib/leads/lead-lease-link";

const candidate = (
  id: string,
  over: Partial<LeadMatchCandidate> = {},
): LeadMatchCandidate => ({
  id,
  email: null,
  phone: null,
  firstName: null,
  lastName: null,
  propertyId: null,
  ...over,
});

const resident = (
  over: Partial<ResidentMatchInput> = {},
): ResidentMatchInput => ({
  email: null,
  phone: null,
  firstName: null,
  lastName: null,
  propertyId: "prop_a",
  ...over,
});

describe("outcome match normalization", () => {
  it("normalizes email without hiding an actual address typo", () => {
    expect(normalizeEmail(" Ada@Example.COM ")).toBe("ada@example.com");
    expect(normalizeEmail("ada+lease@example.com")).toBe(
      "ada+lease@example.com",
    );
    expect(normalizeEmail("not-an-email")).toBeNull();
  });

  it("recognizes reversed names, punctuation, unicode, and common nicknames", () => {
    expect(normalizedNameVariants("José", "O'Connor")).toContain(
      "jose oconnor",
    );
    expect(normalizedNameVariants("O'Connor", "José")).toContain(
      "jose oconnor",
    );
    expect(normalizedNameVariants("Bob", "Smith")).toContain("robert smith");
  });
});

describe("evaluateResidentLeadMatch", () => {
  it("auto-matches corroborated phone and email with full confidence", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("lead_1", {
          email: "ada@example.com",
          phone: "+1 (405) 555-0100",
          firstName: "Ada",
          lastName: "Lovelace",
          propertyId: "prop_a",
        }),
      ],
      resident({
        email: "ADA@example.com",
        phone: "405.555.0100",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    );

    expect(result).toMatchObject({
      status: "matched",
      leadId: "lead_1",
      confidence: 100,
      method: "phone_email",
    });
  });

  it("preserves the existing unique normalized-email automatic match", () => {
    const result = evaluateResidentLeadMatch(
      [candidate("lead_1", { email: "Ada@Example.com" })],
      resident({ email: "ada@example.com" }),
    );

    expect(result).toMatchObject({
      status: "matched",
      leadId: "lead_1",
      confidence: 95,
      method: "normalized_email",
    });
  });

  it("requires property compatibility for a phone-only automatic match", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("wrong_property", {
          phone: "4055550100",
          propertyId: "prop_b",
        }),
      ],
      resident({ phone: "4055550100", propertyId: "prop_a" }),
    );

    expect(result).toMatchObject({ status: "unmatched", leadId: null });
  });

  it("never auto-links a fuzzy email typo even when the name corroborates", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("lead_1", {
          email: "ada.lovelace@example.com",
          firstName: "Ada",
          lastName: "Lovelace",
          propertyId: "prop_a",
        }),
      ],
      resident({
        email: "ada.lovelcae@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
      }),
    );

    expect(result).toMatchObject({
      status: "review",
      leadId: "lead_1",
      method: "fuzzy_composite",
    });
    expect(result.confidence).toBeLessThan(92);
  });

  it("turns a nickname/name-only candidate into review, never proof", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("lead_1", {
          firstName: "Robert",
          lastName: "Smith",
          propertyId: "prop_a",
        }),
      ],
      resident({ firstName: "Bob", lastName: "Smith" }),
    );

    expect(result).toMatchObject({
      status: "review",
      leadId: "lead_1",
      method: "name_only",
    });
  });

  it("aborts when different high-confidence identifiers point at different leads", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("email_lead", { email: "ada@example.com" }),
        candidate("phone_lead", {
          phone: "4055550100",
          propertyId: "prop_a",
        }),
      ],
      resident({ email: "ada@example.com", phone: "4055550100" }),
    );

    expect(result).toMatchObject({ status: "ambiguous", leadId: null });
    expect(result.candidates.map((row) => row.leadId)).toEqual([
      "email_lead",
      "phone_lead",
    ]);
  });

  it("aborts duplicate exact identifiers instead of choosing by array order", () => {
    const result = evaluateResidentLeadMatch(
      [
        candidate("lead_1", { email: "shared@example.com" }),
        candidate("lead_2", { email: "shared@example.com" }),
      ],
      resident({ email: "shared@example.com" }),
    );

    expect(result).toMatchObject({ status: "ambiguous", leadId: null });
  });

  it("returns an auditable unmatched decision when identity data is insufficient", () => {
    const result = evaluateResidentLeadMatch(
      [candidate("lead_1", { firstName: "Ada", lastName: "Lovelace" })],
      resident({ firstName: "A" }),
    );

    expect(result).toEqual({
      status: "unmatched",
      leadId: null,
      confidence: 0,
      method: "none",
      candidates: [],
      reasons: ["No safe identity candidate"],
    });
  });
});
