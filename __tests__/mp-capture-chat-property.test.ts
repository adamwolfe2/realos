import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  type ChatbotTenant,
} from "@/lib/chatbot/build-system-prompt";
import { resolvePropertyForChatPage } from "@/lib/chatbot/property-attribution";

// ---------------------------------------------------------------------------
// Multi-property capture: one org, two ACTIVE properties, each on its own
// website. The chatbot must never answer with the other building's units and
// must attribute the chat to the building whose site it is mounted on.
// ---------------------------------------------------------------------------

function listing(unitType: string, priceCents: number) {
  return {
    unitType,
    bedrooms: 1,
    bathrooms: 1,
    squareFeet: 400,
    priceCents,
    unitNumber: null,
    isAvailable: true,
  };
}

function twoPropertyOrg(): ChatbotTenant {
  const base = {
    addressLine1: null,
    city: null,
    state: null,
    postalCode: null,
    residentialSubtype: "STUDENT",
    propertyType: "RESIDENTIAL",
    totalUnits: null,
    yearBuilt: null,
  };
  return {
    name: "SG Realty",
    primaryContactName: null,
    tenantSiteConfig: {
      chatbotPersonaName: "Riley",
      chatbotKnowledgeBase: null,
      phoneNumber: null,
      contactEmail: null,
      primaryCtaUrl: null,
      primaryCtaText: null,
    },
    // properties[0] is the most-recently-updated building (B here).
    properties: [
      { ...base, id: "prop_b", name: "Building Bravo", listings: [listing("Penthouse Bravo", 450000)] },
      { ...base, id: "prop_a", name: "Building Alpha", listings: [listing("Studio Alpha", 90000)] },
    ],
  } as unknown as ChatbotTenant;
}

describe("buildSystemPrompt with an unresolved property (multi-property org)", () => {
  it("does not fall back to properties[0] when the caller passes property: null", () => {
    const prompt = buildSystemPrompt(twoPropertyOrg(), undefined, {
      property: null,
    });
    expect(prompt).not.toContain("Building Bravo");
    expect(prompt).not.toContain("Penthouse Bravo");
    // Honest deflection instead of another building's inventory.
    expect(prompt).toContain("LIVE AVAILABILITY");
  });

  it("uses the resolved property when one is passed", () => {
    const org = twoPropertyOrg();
    const prompt = buildSystemPrompt(org, undefined, {
      property: org.properties[1],
    });
    expect(prompt).toContain("Building Alpha");
    expect(prompt).toContain("Studio Alpha");
    expect(prompt).not.toContain("Building Bravo");
  });

  it("keeps the legacy first-property behavior when no override is given", () => {
    const prompt = buildSystemPrompt(twoPropertyOrg());
    expect(prompt).toContain("Building Bravo");
  });
});

describe("resolvePropertyForChatPage on per-property domains", () => {
  const props = [
    { id: "prop_lair", slug: "the-lair", name: "The Lair", websiteUrl: "https://lair.example.co/" },
    { id: "prop_tc", slug: "telegraph-commons", name: "Telegraph Commons", websiteUrl: "https://www.telegraphcommons.com" },
  ];

  it("matches the page host against each property's websiteUrl host", () => {
    expect(resolvePropertyForChatPage("https://lair.example.co/floor-plans", props)).toBe("prop_lair");
    // www. on either side is ignored.
    expect(resolvePropertyForChatPage("https://telegraphcommons.com/", props)).toBe("prop_tc");
  });

  it("ignores a websiteUrl host shared by several properties and falls through", () => {
    const shared = [
      { id: "a", slug: "alpha", name: "Alpha", websiteUrl: "https://portfolio.test/alpha" },
      { id: "b", slug: "bravo", name: "Bravo", websiteUrl: "https://portfolio.test/bravo" },
    ];
    expect(resolvePropertyForChatPage("https://portfolio.test/bravo/units", shared)).toBe("b");
    expect(resolvePropertyForChatPage("https://portfolio.test/", shared)).toBeNull();
  });

  it("prefers the most specific slug when several slugs appear in the URL", () => {
    const nested = [
      { id: "short", slug: "telegraph", name: "Telegraph" },
      { id: "long", slug: "telegraph-commons", name: "Telegraph Commons" },
    ];
    expect(
      resolvePropertyForChatPage("https://site.test/telegraph-commons/apply", nested),
    ).toBe("long");
  });

  it("a slug in the path beats a shared company-site host (second property added)", () => {
    // A's websiteUrl is the shared company site; B lives under a path on it
    // with no websiteUrl of its own. B's leads must stay B's.
    const shared = [
      { id: "a", slug: "telegraph-commons", name: "Telegraph Commons", websiteUrl: "https://sgre.com" },
      { id: "b", slug: "southgate-annex", name: "Southgate Annex", websiteUrl: null },
    ];
    expect(resolvePropertyForChatPage("https://sgre.com/southgate-annex/apply", shared)).toBe("b");
    expect(resolvePropertyForChatPage("https://www.sgre.com/southgateannex", shared)).toBe("b");
    // Nothing else matches: the unique host owner wins.
    expect(resolvePropertyForChatPage("https://sgre.com/contact", shared)).toBe("a");
  });

  it("matches websiteUrl values stored without a scheme, with www, slash or caps", () => {
    const bare = [
      // Slugs/names deliberately absent from the URLs: only the host can match.
      { id: "h", slug: "prop-one", name: "Alpha One", websiteUrl: "livehigby.com" },
      { id: "r", slug: "prop-two", name: "Beta Two", websiteUrl: "WWW.RiseOnDurant.com/" },
    ];
    expect(resolvePropertyForChatPage("https://www.livehigby.com/floorplans", bare)).toBe("h");
    expect(resolvePropertyForChatPage("https://riseondurant.com/", bare)).toBe("r");
  });

  it("stays null for an ambiguous page on a multi-property org", () => {
    expect(resolvePropertyForChatPage("https://unrelated.test/", props)).toBeNull();
  });
});
