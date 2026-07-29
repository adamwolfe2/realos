import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  type ChatbotTenant,
} from "@/lib/chatbot/build-system-prompt";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";

// ---------------------------------------------------------------------------
// Capture-rate slice A (2026-07-29). Measured against prod for SG Real Estate:
// 123 engaged conversations, capture rate 1.9% at 1 user turn (1 of 54), 21%
// at 2-3 turns, and 100% at 4+. Every losing transcript ended its first reply
// with a bare "what's the best email" — a toll charged before any value was
// delivered. The prompt now spends the first reply buying a second turn.
// These tests lock in the timing, not the wording.
// ---------------------------------------------------------------------------

function makeOrg(): ChatbotTenant {
  return {
    name: "Test Realty",
    primaryContactName: null,
    tenantSiteConfig: {
      chatbotPersonaName: "Riley",
      chatbotKnowledgeBase: null,
      phoneNumber: null,
      contactEmail: null,
      primaryCtaUrl: null,
      primaryCtaText: null,
    },
    properties: [
      {
        name: "Test Property",
        addressLine1: null,
        city: null,
        state: null,
        postalCode: null,
        residentialSubtype: "STUDENT",
        propertyType: "RESIDENTIAL",
        totalUnits: null,
        yearBuilt: null,
        listings: [],
      },
    ],
  } as unknown as ChatbotTenant;
}

describe("buildSystemPrompt — contact-ask timing", () => {
  it("forbids the contact ask on the visitor's first turn", () => {
    const prompt = buildSystemPrompt(makeOrg(), undefined, {
      userTurnCount: 1,
    });

    expect(prompt).toContain("DO NOT ask for their email");
    // The old always-ask script must not also be present — both blocks in one
    // prompt would hand the model contradictory orders.
    expect(prompt).not.toContain("EVERY reply must end with a contact-capture");
  });

  it("allows the ask from the second turn onward", () => {
    const prompt = buildSystemPrompt(makeOrg(), undefined, {
      userTurnCount: 2,
    });

    expect(prompt).toContain("earned the right to ask");
    expect(prompt).not.toContain("DO NOT ask for their email");
  });

  it("requires a named deliverable on the ask rather than a bare request", () => {
    const prompt = buildSystemPrompt(makeOrg(), undefined, {
      userTurnCount: 3,
    });

    expect(prompt).toContain("must always name the deliverable");
  });

  it("defaults to allowing the ask when turn count is not supplied", () => {
    // Callers that don't track depth must not accidentally get a bot that
    // never captures anything.
    const prompt = buildSystemPrompt(makeOrg());

    expect(prompt).not.toContain("DO NOT ask for their email");
    expect(prompt).toContain("earned the right to ask");
  });

  it("keeps qualifying mode when contact info is already known, even on turn 1", () => {
    // A pre-chat capture form means we already have the address; the first
    // turn should qualify, not go silent.
    const prompt = buildSystemPrompt(
      makeOrg(),
      { email: "someone@example.com" },
      { userTurnCount: 1 },
    );

    expect(prompt).toContain("ALREADY captured");
    expect(prompt).not.toContain("DO NOT ask for their email");
  });
});

describe("extractLeadCapture — name sanitizing", () => {
  const userSays = (content: string) => extractLeadCapture([{ role: "user", content }]);

  it("does not read 'Interested' as a name", () => {
    // This is the live bug: "I'm Interested in a single" produced the name
    // "Interested", which reaches the operator's lead email as "Hi Interested".
    expect(userSays("I'm Interested in a single for Aug 15").name).toBeUndefined();
  });

  it("does not read other common non-name continuations as a name", () => {
    expect(userSays("I'm Looking for a room").name).toBeUndefined();
    expect(userSays("I'm Currently a student").name).toBeUndefined();
    expect(userSays("this is Great thanks").name).toBeUndefined();
  });

  it("still captures a real self-introduction", () => {
    const r = userSays("Hi, my name is Priya Raman and I need a single");
    expect(r.name).toBe("Priya Raman");
    expect(r.firstName).toBe("Priya");
    expect(r.lastName).toBe("Raman");
  });

  it("keeps the given name and drops a non-surname trailing word", () => {
    const r = userSays("I'm Marcus Looking for a triple");
    expect(r.firstName).toBe("Marcus");
    expect(r.lastName).toBeUndefined();
  });

  it("still extracts email and phone independently of the name", () => {
    const r = userSays("I'm Interested — reach me at sam@example.com or 510-462-5442");
    expect(r.email).toBe("sam@example.com");
    expect(r.phone).toBe("510-462-5442");
    expect(r.name).toBeUndefined();
  });
});
