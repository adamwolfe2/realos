/**
 * AEO prompt generator.
 *
 * Given a property's location + type, produce 4-6 realistic prompts a
 * prospective renter might type into ChatGPT / Perplexity / Claude / Gemini.
 *
 * Strategy:
 *  - Vary by propertyType (RESIDENTIAL vs COMMERCIAL).
 *  - Vary by residentialSubtype — student housing, multifamily, senior,
 *    short-term, etc. — each pulls slightly different prompt templates
 *    matching how real renters phrase the question.
 *  - Always include at least one "neighborhood-only" prompt and one
 *    "city-only" prompt so we capture both narrow + broad AI-search
 *    visibility.
 *  - Skip generation if we don't have a city. We never invent geography.
 *
 * Returned prompts are user-style natural-language strings — no system-
 * prompt scaffolding. The engine clients wrap them in the per-engine
 * request envelope.
 */

import "server-only";
import type {
  PropertyType,
  ResidentialSubtype,
  CommercialSubtype,
} from "@prisma/client";

export interface PromptSeed {
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  propertyType: PropertyType;
  residentialSubtype: ResidentialSubtype | null;
  commercialSubtype: CommercialSubtype | null;
  /** Optional anchor — a nearby university for STUDENT_HOUSING. */
  nearbyUniversity?: string | null;
  /**
   * The property's brand name (e.g. "Telegraph Commons"). When supplied,
   * generatePrompts emits 2 BRANDED prompts in addition to the discovery
   * ones — questions that explicitly name the property so we can measure
   * "do the AI engines know who you are when prompted directly?" rather
   * than only "do they pick you off a blank competitive set?" Branded
   * scoring is the defensive moat; discovery scoring is the growth gap.
   * Both surface separately in the AI Search Visibility UI.
   */
  propertyName?: string | null;
}

/**
 * Generate 4-6 user-style prompts for the given property seed.
 * Empty array if we don't have enough geographic signal.
 */
export function generatePrompts(seed: PromptSeed): string[] {
  const city = seed.city?.trim();
  if (!city) return [];

  const location = locationPhrase(seed);
  const broadLocation = seed.state
    ? `${city}, ${seed.state}`
    : city;
  const audience = audiencePhrase(seed);

  const out: string[] = [];

  // BRANDED prompts first. When the seed carries propertyName, lead with
  // 2 prompts that explicitly name the property — these are how a real
  // prospect researches a shortlisted building ("is X a good place to
  // live", "what do students say about X"). AI engines have public
  // data on most named properties via reviews, Reddit threads, social
  // posts, so citation rate on branded prompts is meaningfully > 0
  // even for small properties that lose every discovery query. The
  // resulting score reflects BOTH the defensive moat (branded) and
  // the growth gap (discovery), which is the honest dashboard story.
  const brand = seed.propertyName?.trim();
  if (brand) {
    out.push(`Tell me about ${brand} in ${broadLocation}. Is it a good place to live?`);
    out.push(
      `What do residents say about ${brand}? Any common complaints or things to know before signing a lease?`,
    );
  }

  if (seed.propertyType === "COMMERCIAL") {
    out.push(...generateCommercialPrompts(seed, location, broadLocation));
  } else {
    out.push(
      ...generateResidentialPrompts(seed, location, broadLocation, audience),
    );
  }

  // De-dupe + cap at 6 (was 6 pre-branded, stays 6 — the 2 branded
  // ones replace 2 of the lower-value discovery variants, not extend
  // the budget).
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of out) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }
  return deduped.slice(0, 6);
}

function locationPhrase(seed: PromptSeed): string {
  const city = seed.city ?? "";
  const neighborhood = seed.neighborhood?.trim();
  if (neighborhood) {
    return seed.state
      ? `${neighborhood}, ${city}, ${seed.state}`
      : `${neighborhood}, ${city}`;
  }
  return seed.state ? `${city}, ${seed.state}` : city;
}

function audiencePhrase(seed: PromptSeed): string {
  switch (seed.residentialSubtype) {
    case "STUDENT_HOUSING":
      return "college students";
    case "SENIOR_LIVING":
      return "older adults";
    case "CO_LIVING":
      return "young professionals looking for a roommate-style setup";
    case "SHORT_TERM_RENTAL":
      return "short-term and corporate stays";
    case "SINGLE_FAMILY_RENTAL":
      return "families";
    case "MULTIFAMILY":
    default:
      return "young professionals and families";
  }
}

function generateResidentialPrompts(
  seed: PromptSeed,
  location: string,
  broadLocation: string,
  audience: string,
): string[] {
  const subtype = seed.residentialSubtype;
  const prompts: string[] = [];

  // Always include the two canonical prompts — broad + narrow.
  prompts.push(
    `What are the best apartments in ${location} for ${audience}?`,
  );
  prompts.push(
    `I'm moving to ${broadLocation} for work. Where should I live, especially near ${seed.neighborhood ?? "downtown"}?`,
  );
  prompts.push(
    `Compare apartments in ${location} — what should I know before I sign a lease?`,
  );

  if (subtype === "STUDENT_HOUSING") {
    const uni = seed.nearbyUniversity ?? `the local university`;
    prompts.push(`Best student housing near ${uni} in ${broadLocation}.`);
    prompts.push(
      `Where do most students live off-campus near ${uni}?`,
    );
  } else if (subtype === "SENIOR_LIVING") {
    prompts.push(
      `Independent senior living options in ${broadLocation} — what should we tour?`,
    );
    prompts.push(
      `Best 55+ communities near ${seed.neighborhood ?? broadLocation}.`,
    );
  } else if (subtype === "SHORT_TERM_RENTAL") {
    prompts.push(
      `Where can I find a furnished short-term rental in ${location}?`,
    );
    prompts.push(
      `Corporate housing options in ${broadLocation} for a 3-month stay.`,
    );
  } else if (subtype === "CO_LIVING") {
    prompts.push(
      `Co-living spaces in ${location} — pros, cons, and recommendations.`,
    );
  } else if (subtype === "SINGLE_FAMILY_RENTAL") {
    prompts.push(
      `Single-family rental homes in ${location} for a family of four.`,
    );
  } else {
    // MULTIFAMILY / null
    prompts.push(
      `Pet-friendly apartments in ${location} under market rent — what are the top picks?`,
    );
  }

  return prompts;
}

function generateCommercialPrompts(
  seed: PromptSeed,
  location: string,
  broadLocation: string,
): string[] {
  const subtype = seed.commercialSubtype;
  const prompts: string[] = [
    `Best office space available in ${location}.`,
    `Where should a growing team lease commercial space in ${broadLocation}?`,
  ];

  switch (subtype) {
    case "RETAIL":
      prompts.push(`Top retail spaces for lease in ${location}.`);
      prompts.push(
        `High-foot-traffic retail locations in ${broadLocation} — what are operators recommending?`,
      );
      break;
    case "INDUSTRIAL":
      prompts.push(
        `Industrial / warehouse space available in ${broadLocation}.`,
      );
      prompts.push(`Best logistics-friendly properties in ${location}.`);
      break;
    case "MEDICAL_OFFICE":
      prompts.push(`Medical office space for lease in ${location}.`);
      prompts.push(
        `Best buildings for a medical practice in ${broadLocation}.`,
      );
      break;
    case "FLEX_SPACE":
      prompts.push(`Flex / hybrid space available in ${location}.`);
      break;
    case "MIXED_USE":
      prompts.push(`Mixed-use buildings in ${location} with retail downstairs.`);
      break;
    case "OFFICE":
    default:
      prompts.push(`Class-A office buildings in ${broadLocation}.`);
      prompts.push(`Coworking and small-team offices in ${location}.`);
  }

  return prompts;
}
