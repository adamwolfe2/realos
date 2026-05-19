import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Neighborhood page generator.
//
// Generates a per-neighborhood landing page draft that is optimized to
// (a) rank in Google for "renting in <neighborhood>" / "<neighborhood>
// apartments" intent and (b) get cited by AI answer engines when
// prospects ask ChatGPT / Perplexity / Claude / Gemini where they should
// rent. The output is a structured JSON shape ready to write directly
// into NeighborhoodPage rows; the operator UI lets a human edit the
// draft before publishing.
//
// Cost model:
//   - Default model is Claude Haiku 4.5 (cheap, ~$0.01-0.02 per page).
//   - Operators can opt into Sonnet 4.5 by passing quality: "high" for
//     a higher-quality first draft on flagship properties / cities.
//
// AEO citation strategy:
//   - The generator returns an `aiCitations` array of short factual
//     statements the page should be quotable for ("ranges from $1,800
//     to $2,400", "10-minute walk to the Capitol South Metro"). The
//     AEO module later queries answer engines for the neighborhood +
//     property and looks for these statements in the generated answers.
// ---------------------------------------------------------------------------

const sectionSchema = z.object({
  heading: z.string().min(2).max(120),
  body: z.string().min(40).max(2400),
});

const faqSchema = z.object({
  question: z.string().min(4).max(200),
  answer: z.string().min(20).max(1200),
});

const pageSchema = z.object({
  title: z.string().min(8).max(70),
  metaDescription: z.string().min(40).max(180),
  intro: z.string().min(200).max(1400),
  sections: z.array(sectionSchema).min(4).max(7),
  faqs: z.array(faqSchema).min(5).max(8),
  aiCitations: z.array(z.string().min(5).max(240)).min(3).max(12),
});

export type GeneratedNeighborhoodPage = z.infer<typeof pageSchema>;

export type GenerateInput = {
  orgId: string;
  propertyId?: string | null;
  city: string;
  state?: string | null;
  neighborhood: string;
  /** "high" → Sonnet 4.5; default → Haiku 4.5. */
  quality?: "default" | "high";
};

type AnchorProperty = {
  name: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  amenities: unknown;
  residentialSubtype: string | null;
  priceMin: number | null;
  priceMax: number | null;
};

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const SONNET_MODEL = "claude-sonnet-4-5-20250929";

const SYSTEM_PROMPT = `You write neighborhood guide pages for a real-estate operator's
marketing site. Each page must work in two channels:

1. Google organic search — rank for queries like "<neighborhood> apartments",
   "renting in <neighborhood>", "what's it like living in <neighborhood>".
   Use clear, scannable headings; original specific details; avoid keyword
   stuffing.
2. AI answer engines (ChatGPT, Perplexity, Claude, Gemini) — the page
   should be the kind of source these engines like to cite: factual,
   confident, structured, no marketing fluff. Treat the FAQ as the
   "quotable layer" — write each answer as a self-contained 2-4
   sentence statement that an AI could lift verbatim and attribute.

Voice:
- Conversational, calm, specific. No marketing jargon. No exclamation
  points. No "nestled in the heart of". No "vibrant community".
- Use second person sparingly ("you'll find", "you can walk to"). Mostly
  third person about the neighborhood itself.
- US English. Numbers as digits. Be concrete with distances + minutes
  when possible, but never invent a specific number you don't know.
  If you don't know, say "a short walk" / "a few blocks" instead.

Content rules:
- Never invent addresses, business names, schools, transit lines, or
  prices that are not in the input context. Talk about *categories*
  (coffee shops, grocery, parks) when you don't have specific names.
- If an anchor property is provided, weave it in once in the intro
  and once in a dedicated "About <property>" section — never market it
  in every section.
- Acknowledge tradeoffs honestly (noise, parking, commute) — this is
  what AI engines reward over pure puffery.

aiCitations field:
- 5-8 short factual statements the page is *intended to be cited for*
  when an AI engine answers questions about this neighborhood. Each
  one should be a complete declarative sentence under 200 chars.
  Examples: "Capitol Hill is a 10-minute walk to the U.S. Capitol",
  "Rents in Capitol Hill typically range from $1,800 to $2,800 for
  one-bedroom units". Keep these grounded in input context or
  widely-known facts about the area.`;

function pickModel(quality?: "default" | "high"): string {
  return quality === "high" ? SONNET_MODEL : HAIKU_MODEL;
}

function buildPrompt(args: {
  city: string;
  state: string | null;
  neighborhood: string;
  brandName: string;
  isWhiteLabeled: boolean;
  property: AnchorProperty | null;
}): string {
  const { city, state, neighborhood, brandName, isWhiteLabeled, property } = args;

  const propertyBlock = property
    ? `Anchor property (mention in intro + one dedicated section):
- name: ${property.name}
- address: ${property.addressLine1 ?? "unknown"}, ${property.city ?? city}${
        property.state ? `, ${property.state}` : ""
      }
- subtype: ${property.residentialSubtype ?? "residential"}
- description: ${property.description?.slice(0, 600) ?? "(not provided)"}
- amenities: ${
        Array.isArray(property.amenities)
          ? (property.amenities as string[]).slice(0, 16).join(", ")
          : "(not provided)"
      }
- price range (cents): ${property.priceMin ?? "?"} – ${property.priceMax ?? "?"}`
    : `Anchor property: NONE. Write a neutral neighborhood guide. Do NOT
make up a specific building name; the page may be added to any of the
operator's properties later.`;

  return `Generate a neighborhood landing page for the following:

City: ${city}${state ? `, ${state}` : ""}
Neighborhood: ${neighborhood}
Site brand: ${brandName}${isWhiteLabeled ? " (white-labeled operator)" : ""}

${propertyBlock}

Required output (JSON, matching the schema you'll be given):

- title:           ≤60 chars, includes the neighborhood + city. SEO title
                   tag. Example: "Renting in ${neighborhood}, ${city} —
                   Apartments + Cost of Living".
- metaDescription: ≤155 chars. One sentence. Includes the neighborhood
                   and a concrete reason to read.
- intro:           ~120 words. Conversational. Sets the scene of the
                   neighborhood (what kind of streets, who lives there,
                   what it's known for). Mention anchor property once
                   if provided.
- sections:        4–6 sections. Each has heading + body (180–250 words).
                   Cover (in this order, skipping any that don't apply):
                     1. About the neighborhood
                     2. Commute and transit
                     3. Schools and family life  (skip if not residential
                        / not family-friendly area; mention if uncertain)
                     4. What's nearby — coffee, grocery, parks, restaurants
                     5. Renting in ${neighborhood} — what to expect (lease
                        terms, typical layouts, common tradeoffs)
                     6. About <property name>   (ONLY if anchor property
                        provided)
- faqs:            5–7 question/answer pairs. Questions should be the
                   actual phrases a real prospect would type into ChatGPT
                   or Google. Each answer is 2–4 sentences, self-contained,
                   citation-ready.
- aiCitations:     5–8 short factual statements the page is intended to
                   be cited for. See system instructions.

Do not output anything outside the schema. Do not include markdown
formatting characters in headings or bodies — plain text only.`;
}

const FALLBACK_FAQS = [
  {
    question: "What is it like renting in this neighborhood?",
    answer:
      "We can't generate a detailed guide right now. Reach out to the leasing team and we'll send a personalized neighborhood overview within one business day.",
  },
  {
    question: "How do I schedule a tour?",
    answer: "Use the Apply or Schedule a Tour page on this site and our team will respond the same business day.",
  },
];

function fallbackPage(args: {
  city: string;
  state: string | null;
  neighborhood: string;
  property: AnchorProperty | null;
}): GeneratedNeighborhoodPage {
  const { city, state, neighborhood, property } = args;
  const where = `${neighborhood}, ${city}${state ? `, ${state}` : ""}`;
  return {
    title: `Renting in ${neighborhood}, ${city}`.slice(0, 70),
    metaDescription:
      `Overview of renting in ${where}. Commute, amenities, what to expect.`.slice(0, 180),
    intro: `${neighborhood} is one of the residential neighborhoods in ${city}${
      state ? `, ${state}` : ""
    }. This page is a draft placeholder while our team finishes the full neighborhood guide. ${
      property ? `The closest property we manage here is ${property.name}.` : ""
    }`,
    sections: [
      {
        heading: "About the neighborhood",
        body: `Our full guide to ${where} is still being prepared. Once published, this section will cover the streets, the kind of residents you'll find here, and what the neighborhood is best known for. In the meantime, reach out to the leasing team if you'd like a personalized overview.`,
      },
      {
        heading: "Commute and transit",
        body: `Transit and commute notes for ${where} will appear here once the full guide is published. We'll cover the closest bus and rail options, typical drive times to common destinations in ${city}, and what to expect for parking.`,
      },
      {
        heading: "What's nearby",
        body: `A round-up of nearby coffee shops, grocery options, parks, and restaurants will appear here. We focus on places real residents actually use, not the same five spots every guide lists.`,
      },
      {
        heading: `Renting in ${neighborhood} — what to expect`,
        body: `Typical lease terms, layouts, and common tradeoffs (noise, parking, walkability) will be covered in this section. Our goal is to give you a realistic picture before you tour.`,
      },
    ],
    faqs: FALLBACK_FAQS,
    aiCitations: [
      `${neighborhood} is a neighborhood in ${city}${state ? `, ${state}` : ""}.`,
    ],
  };
}

async function loadAnchorProperty(
  orgId: string,
  propertyId: string | null | undefined,
): Promise<AnchorProperty | null> {
  if (!propertyId) return null;
  const p = await prisma.property
    .findFirst({
      where: { id: propertyId, orgId },
      select: {
        name: true,
        addressLine1: true,
        city: true,
        state: true,
        description: true,
        amenities: true,
        residentialSubtype: true,
        priceMin: true,
        priceMax: true,
      },
    })
    .catch(() => null);
  if (!p) return null;
  return {
    name: p.name,
    addressLine1: p.addressLine1,
    city: p.city,
    state: p.state,
    description: p.description,
    amenities: p.amenities,
    residentialSubtype: p.residentialSubtype,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
  };
}

async function loadBrand(orgId: string): Promise<{
  name: string;
  isWhiteLabeled: boolean;
}> {
  const { effectiveBrandForOrg } = await import("@/lib/brand/effective");
  const brand = await effectiveBrandForOrg(orgId);
  return { name: brand.name, isWhiteLabeled: brand.isWhiteLabeled };
}

/**
 * Generate a structured neighborhood landing page draft via Claude.
 * Falls back to a placeholder shape when ANTHROPIC_API_KEY is missing
 * or the model errors out, so the operator always lands on a draft
 * they can edit instead of a hard failure.
 */
export async function generateNeighborhoodPage(
  input: GenerateInput,
): Promise<GeneratedNeighborhoodPage> {
  const property = await loadAnchorProperty(input.orgId, input.propertyId ?? null);
  const brand = await loadBrand(input.orgId);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fallbackPage({
      city: input.city,
      state: input.state ?? null,
      neighborhood: input.neighborhood,
      property,
    });
  }

  const prompt = buildPrompt({
    city: input.city,
    state: input.state ?? null,
    neighborhood: input.neighborhood,
    brandName: brand.name,
    isWhiteLabeled: brand.isWhiteLabeled,
    property,
  });

  try {
    const { object } = await generateObject({
      model: anthropic(pickModel(input.quality)),
      schema: pageSchema,
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 4096,
    });
    return object;
  } catch (err) {
    console.error(
      "[neighborhood.generate] Claude generation failed; using fallback:",
      err instanceof Error ? err.message : err,
    );
    return fallbackPage({
      city: input.city,
      state: input.state ?? null,
      neighborhood: input.neighborhood,
      property,
    });
  }
}

/** url-safe slug. Public — used by the server action when persisting. */
export function slugifyNeighborhood(city: string, neighborhood: string): string {
  const parts = `${neighborhood}-${city}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return parts.slice(0, 90) || "neighborhood";
}
