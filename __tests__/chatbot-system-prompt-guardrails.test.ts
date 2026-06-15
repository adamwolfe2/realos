import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  type ChatbotTenant,
} from "@/lib/chatbot/build-system-prompt";

// ---------------------------------------------------------------------------
// Guardrails against the Telegraph Commons chatbot bug: the bot reported a
// "triple" as 200 sq ft (smaller than a 420 sq ft "double"). Root cause was
// listings that carried a square footage but NO unitType/bedrooms label, so
// the anonymous "Unit: …, 420 sq ft" rows reached the prompt and the LLM
// invented which size mapped to which room type. These tests lock in:
//   1) anonymous (unlabeled) listings are NOT surfaced to the model, and
//   2) the content rules forbid inventing unit dimensions/types.
// ---------------------------------------------------------------------------

type ListingSeed = {
  unitType: string | null;
  bedrooms: number | null;
  bathrooms?: number | null;
  squareFeet: number | null;
  priceCents?: number | null;
  unitNumber?: string | null;
  isAvailable?: boolean;
};

function makeOrg(listings: ListingSeed[]): ChatbotTenant {
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
        listings,
      },
    ],
  } as unknown as ChatbotTenant;
}

describe("buildSystemPrompt unit-data guardrails", () => {
  it("omits anonymous (no type, no bedrooms) listings even when they have a size", () => {
    const prompt = buildSystemPrompt(
      makeOrg([
        { unitType: null, bedrooms: null, squareFeet: 420, isAvailable: true },
        { unitType: null, bedrooms: null, squareFeet: 200, isAvailable: true },
      ]),
    );

    expect(prompt).not.toContain("420 sq ft");
    expect(prompt).not.toContain("200 sq ft");
    expect(prompt).not.toContain("AVAILABLE UNITS RIGHT NOW");
    // Falls back to the honest "no live unit list" message.
    expect(prompt).toContain("don't have a current unit list loaded");
  });

  it("surfaces listings that carry a real label (unit type or bedrooms)", () => {
    const prompt = buildSystemPrompt(
      makeOrg([
        {
          unitType: "Shared 3-Bedroom Suite",
          bedrooms: 3,
          squareFeet: 500,
          priceCents: 150000,
          isAvailable: true,
        },
      ]),
    );

    expect(prompt).toContain("AVAILABLE UNITS RIGHT NOW");
    expect(prompt).toContain("Shared 3-Bedroom Suite");
    expect(prompt).toContain("500 sq ft");
  });

  it("includes a content rule forbidding invented unit dimensions/types", () => {
    const prompt = buildSystemPrompt(makeOrg([]));
    expect(prompt).toContain("square footage");
    expect(prompt).toMatch(/do not map a size to a room type/i);
  });
});
