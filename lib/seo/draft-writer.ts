import "server-only";

// ---------------------------------------------------------------------------
// SEO/AEO Content Drafter — Claude-powered.
//
// One function per ContentFormat, each returning a structured object
// (typed via Zod) plus a rendered markdown string ready for the
// operator to paste into Claude Code.
//
// Drafts get persisted to ContentDraft (status GENERATING -> generated)
// by the caller. This module is pure: input -> output, no DB writes,
// no side effects beyond the Anthropic API call.
//
// Architecture rationale (docs/SEO_AEO_AGENT_ARCHITECTURE.md):
//
//   The 6 formats cover every page-level SEO/AEO surface we'd want the
//   AI to produce for an operator:
//
//     BLOG_POST            Long-form (1,200-1,800 word) educational
//                          article ranking for a target query
//     NEIGHBORHOOD_PAGE    /n/<slug> page (intro + 4-6 sections + 5
//                          FAQs + aiCitations array for AEO grounding)
//     PROPERTY_DESCRIPTION 150-300 word listing description tuned for
//                          chatbot grounding + AI engine citation
//     META_REWRITE         Title + meta description for an existing
//                          page (used by CTR_FIX recommendations)
//     FAQ_BLOCK            5-8 schema.org FAQPage Q&A pairs for an
//                          existing page (lifts AEO citation rate)
//     AD_COPY              Google + Meta ad copy variants for the
//                          property's top-converting query (3 headlines,
//                          2 descriptions, 1 long description)
//
// Every output ships with an `estimatedScore` (0-100 composite content
// quality estimate) so the admin queue can prioritize review.
// ---------------------------------------------------------------------------

import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared input shape — every format takes the same operator context.
// ---------------------------------------------------------------------------

export type DrafterContext = {
  /** Operator's brief in their own words. */
  brief: string;
  /** Target query / intent the page should rank for. Pre-filled by the
   *  Agent when generated from a CTR_FIX or CONTENT_GAP recommendation. */
  targetQuery?: string;
  /** Property facts the draft must respect (verbatim). */
  property: {
    name: string;
    city?: string | null;
    state?: string | null;
    addressLine1?: string | null;
    propertyType?: string | null;
    residentialSubtype?: string | null;
    commercialSubtype?: string | null;
    totalUnits?: number | null;
    description?: string | null;
    /** True facts pulled from PropertyMention or operator-confirmed
     *  metadata. The model uses these for AEO citation grounding and
     *  must never invent additional facts. */
    facts?: string[];
  };
  /** Audience hint: "students", "young professionals", "active 55+", etc. */
  audience?: string;
  /** Brand voice: "warm + casual", "professional + concise", etc. */
  voice?: string;
};

const MODEL = "claude-sonnet-4-5";

// ---------------------------------------------------------------------------
// Schemas + prompts per format
// ---------------------------------------------------------------------------

const blogSchema = z.object({
  title: z.string().max(80),
  metaDescription: z.string().max(160),
  /** Hero / intro paragraph. */
  intro: z.string().min(120).max(800),
  /** Body sections — each one becomes an H2 + 2-4 paragraphs. */
  sections: z
    .array(
      z.object({
        heading: z.string().max(80),
        body: z.string().min(180).max(1400),
      }),
    )
    .min(3)
    .max(7),
  faqs: z
    .array(
      z.object({
        question: z.string().max(120),
        answer: z.string().max(400),
      }),
    )
    .min(3)
    .max(6),
  /** Closing CTA paragraph. */
  closing: z.string().max(400),
  estimatedScore: z.number().int().min(0).max(100),
});

const neighborhoodSchema = z.object({
  title: z.string().max(80),
  metaDescription: z.string().max(160),
  neighborhood: z.string(),
  intro: z.string().min(120).max(700),
  sections: z
    .array(
      z.object({
        heading: z.string().max(80),
        body: z.string().min(160).max(900),
      }),
    )
    .min(4)
    .max(6),
  faqs: z
    .array(
      z.object({
        question: z.string().max(120),
        answer: z.string().max(400),
      }),
    )
    .min(4)
    .max(6),
  /** Atomic claims an AI engine can cite. Each must be verifiable from
   *  the input facts — these get scored later via AeoCitationCheck. */
  aiCitations: z.array(z.string().max(200)).min(3).max(8),
  estimatedScore: z.number().int().min(0).max(100),
});

const metaRewriteSchema = z.object({
  /** Two title variants for A/B. */
  titles: z.array(z.string().max(60)).length(2),
  /** Two meta description variants. */
  metaDescriptions: z.array(z.string().max(160)).length(2),
  /** Why these are expected to beat the current title + meta. */
  rationale: z.string().max(400),
  estimatedScore: z.number().int().min(0).max(100),
});

const faqBlockSchema = z.object({
  faqs: z
    .array(
      z.object({
        question: z.string().max(120),
        answer: z.string().max(400),
      }),
    )
    .min(5)
    .max(8),
  /** JSON-LD ready FAQPage schema markup. */
  schemaMarkup: z.string(),
  estimatedScore: z.number().int().min(0).max(100),
});

const adCopySchema = z.object({
  /** Google Ads format: 3 headlines (30 char max), 2 descriptions (90 char). */
  google: z.object({
    headlines: z.array(z.string().max(30)).length(3),
    descriptions: z.array(z.string().max(90)).length(2),
  }),
  /** Meta Ads format: primary text (125 char), headline (40), description (30). */
  meta: z.object({
    primaryText: z.string().max(125),
    headline: z.string().max(40),
    description: z.string().max(30),
  }),
  estimatedScore: z.number().int().min(0).max(100),
});

const propertyDescriptionSchema = z.object({
  /** 150-300 words tuned for chatbot grounding + AI engine citation. */
  description: z.string().min(150).max(1800),
  /** Atomic facts the AI engines can cite. */
  aiCitations: z.array(z.string().max(200)).min(3).max(6),
  estimatedScore: z.number().int().min(0).max(100),
});

// ---------------------------------------------------------------------------
// Shared system prompt — drilled into every draft. Real-estate-specific
// rules so the model never wanders into fair-housing-protected language
// or invents amenities/prices/policies.
// ---------------------------------------------------------------------------

const BASE_SYSTEM = `You are LeaseStack's SEO/AEO content writer. Your job is to draft
SEO-optimized content for real-estate operator marketing sites that
ranks in Google AND gets cited by AI search engines (ChatGPT,
Perplexity, Claude, Gemini).

ABSOLUTE RULES (these override anything else):

- Use the property facts EXACTLY as given. Never invent prices,
  amenities, unit counts, year built, walk score, distances, or
  policies. If the operator's brief asks for a fact you don't have,
  write the copy without it (or describe it generically).
- Fair-housing compliance: NEVER mention or imply preference for any
  protected class (race, color, religion, national origin, sex,
  familial status, disability, source of income, age, marital status,
  ancestry, gender identity, sexual orientation). When describing the
  ideal resident, focus on lifestyle ("students walking to campus"),
  not protected attributes.
- US English. Sentence case for headings. No em dashes anywhere in
  the output. Use commas, periods, or colons instead.
- Outcomes language, not activity language. "Sign a 12-month lease",
  not "engage with our property". "Tour available units", not
  "explore exciting opportunities".
- No corporate filler. Ban: leverage, synergize, robust, best-in-class,
  cutting-edge, world-class, premier (acceptable for amenities only),
  unrivaled, unparalleled, redefine, revolutionize.
- Voice: warm, direct, specific. Sound like a competent neighborhood
  expert, not a real-estate brochure.
- Numbers as digits ("12 amenities" not "twelve").
- No exclamation marks. No emojis.

AEO RULES:
- AI engines cite text that reads as factual statements with concrete
  numbers, named places, and named amenities. Write atomic, citable
  claims ("Telegraph Commons sits 2 blocks from UC Berkeley campus,
  a 3-minute walk to Sproul Plaza").
- Avoid hedging ("might be", "could offer", "we believe"). State
  facts directly.

ESTIMATED SCORE:
- Return a 0-100 composite quality estimate considering: target-query
  relevance (40%), AEO citation potential (25%), factual specificity
  (20%), and copy quality (15%). Be honest. A merely-acceptable draft
  scores ~60; an excellent draft scores ~85+.`;

function formatContext(ctx: DrafterContext): string {
  const p = ctx.property;
  const lines: string[] = [];
  lines.push(`PROPERTY:`);
  lines.push(`- Name: ${p.name}`);
  if (p.addressLine1)
    lines.push(
      `- Address: ${p.addressLine1}${p.city ? `, ${p.city}` : ""}${p.state ? `, ${p.state}` : ""}`,
    );
  if (p.city) lines.push(`- City: ${p.city}`);
  if (p.totalUnits != null) lines.push(`- Total units: ${p.totalUnits}`);
  const subtype = p.residentialSubtype ?? p.commercialSubtype ?? null;
  if (subtype) lines.push(`- Subtype: ${subtype}`);
  if (p.description)
    lines.push(`- Existing description: ${p.description.slice(0, 600)}`);
  if (p.facts && p.facts.length > 0) {
    lines.push(`- Verified facts (use verbatim where applicable):`);
    p.facts.slice(0, 12).forEach((f) => lines.push(`  - ${f}`));
  }
  lines.push("");
  if (ctx.targetQuery) {
    lines.push(`TARGET QUERY: "${ctx.targetQuery}"`);
    lines.push("");
  }
  if (ctx.audience) lines.push(`AUDIENCE: ${ctx.audience}`);
  if (ctx.voice) lines.push(`VOICE: ${ctx.voice}`);
  lines.push("");
  lines.push(`BRIEF FROM OPERATOR:`);
  lines.push(ctx.brief);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Format-specific drafters
// ---------------------------------------------------------------------------

export async function draftBlogPost(ctx: DrafterContext): Promise<{
  output: z.infer<typeof blogSchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: blogSchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: BLOG_POST\nLength: 1,200-1,800 words total across intro + sections + closing. Each section is an H2 with 2-4 paragraphs. The intro hooks the target query in the first 80 characters. FAQs are schema.org FAQPage-ready.`,
    prompt: formatContext(ctx),
  });

  const md = renderBlogMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

export async function draftNeighborhoodPage(
  ctx: DrafterContext,
): Promise<{
  output: z.infer<typeof neighborhoodSchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: neighborhoodSchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: NEIGHBORHOOD_PAGE\nLands at /n/<slug> on the tenant marketing site. 4-6 sections covering location signals (transit, amenities, schools/employers, dining, lifestyle, getting around). Intro hooks "apartments in <neighborhood>" or similar. aiCitations are atomic factual claims the AI engines can quote — 3-8 short sentences, each verifiable from input facts.`,
    prompt: formatContext(ctx),
  });

  const md = renderNeighborhoodMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

export async function draftMetaRewrite(ctx: DrafterContext): Promise<{
  output: z.infer<typeof metaRewriteSchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: metaRewriteSchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: META_REWRITE\nProduce two title variants (each ≤60 chars) and two meta description variants (each ≤160 chars) for an existing page. Both titles must include the target query. Meta descriptions describe the page payoff, not the property generally. Variant 1 leads with the query; variant 2 leads with a benefit hook.`,
    prompt: formatContext(ctx),
  });

  const md = renderMetaRewriteMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

export async function draftFaqBlock(ctx: DrafterContext): Promise<{
  output: z.infer<typeof faqBlockSchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: faqBlockSchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: FAQ_BLOCK\n5-8 Q&A pairs answering the specific questions prospects ask. Each Q is conversational ("How close is Telegraph Commons to BART?"), each A is a citable answer with concrete numbers. The schemaMarkup field returns valid JSON-LD for a FAQPage, ready to drop into the page's <head>.`,
    prompt: formatContext(ctx),
  });

  const md = renderFaqMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

export async function draftAdCopy(ctx: DrafterContext): Promise<{
  output: z.infer<typeof adCopySchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: adCopySchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: AD_COPY\nGoogle Ads + Meta Ads variants for the property's top-converting query. Google: 3 headlines (≤30 chars), 2 descriptions (≤90 chars). Meta: 1 primary text (≤125 chars), 1 headline (≤40 chars), 1 description (≤30 chars). Each Google headline targets a different angle (location, amenity, offer). Meta primary text leads with the strongest benefit hook.`,
    prompt: formatContext(ctx),
  });

  const md = renderAdCopyMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

export async function draftPropertyDescription(
  ctx: DrafterContext,
): Promise<{
  output: z.infer<typeof propertyDescriptionSchema>;
  markdown: string;
  model: string;
}> {
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema: propertyDescriptionSchema,
    system: `${BASE_SYSTEM}\n\nFORMAT: PROPERTY_DESCRIPTION\n150-300 words tuned for chatbot grounding + AI engine citation. Lead with the property's strongest unique fact, then location, then amenities. The aiCitations array contains 3-6 atomic claims the chatbot can quote when prospects ask "tell me about <property>".`,
    prompt: formatContext(ctx),
  });

  const md = renderPropertyDescriptionMarkdown(object);
  return { output: object, markdown: md, model: MODEL };
}

// ---------------------------------------------------------------------------
// Markdown renderers — what the operator pastes into Claude Code
// ---------------------------------------------------------------------------

function renderBlogMarkdown(o: z.infer<typeof blogSchema>): string {
  const out: string[] = [];
  out.push(`---`);
  out.push(`title: "${o.title}"`);
  out.push(`description: "${o.metaDescription}"`);
  out.push(`---`);
  out.push("");
  out.push(`# ${o.title}`);
  out.push("");
  out.push(o.intro);
  out.push("");
  for (const s of o.sections) {
    out.push(`## ${s.heading}`);
    out.push("");
    out.push(s.body);
    out.push("");
  }
  out.push(`## Frequently asked questions`);
  out.push("");
  for (const f of o.faqs) {
    out.push(`### ${f.question}`);
    out.push("");
    out.push(f.answer);
    out.push("");
  }
  out.push(o.closing);
  out.push("");
  return out.join("\n");
}

function renderNeighborhoodMarkdown(
  o: z.infer<typeof neighborhoodSchema>,
): string {
  const out: string[] = [];
  out.push(`---`);
  out.push(`title: "${o.title}"`);
  out.push(`description: "${o.metaDescription}"`);
  out.push(`neighborhood: "${o.neighborhood}"`);
  out.push(`---`);
  out.push("");
  out.push(`# ${o.title}`);
  out.push("");
  out.push(o.intro);
  out.push("");
  for (const s of o.sections) {
    out.push(`## ${s.heading}`);
    out.push("");
    out.push(s.body);
    out.push("");
  }
  out.push(`## Frequently asked questions`);
  out.push("");
  for (const f of o.faqs) {
    out.push(`### ${f.question}`);
    out.push("");
    out.push(f.answer);
    out.push("");
  }
  out.push(`## Facts AI engines can quote`);
  out.push("");
  for (const c of o.aiCitations) out.push(`- ${c}`);
  out.push("");
  return out.join("\n");
}

function renderMetaRewriteMarkdown(
  o: z.infer<typeof metaRewriteSchema>,
): string {
  const out: string[] = [];
  out.push(`# Title + meta rewrite`);
  out.push("");
  out.push(`## Variant A — query first`);
  out.push("");
  out.push(`**Title:** ${o.titles[0]}`);
  out.push(`**Meta description:** ${o.metaDescriptions[0]}`);
  out.push("");
  out.push(`## Variant B — benefit first`);
  out.push("");
  out.push(`**Title:** ${o.titles[1]}`);
  out.push(`**Meta description:** ${o.metaDescriptions[1]}`);
  out.push("");
  out.push(`## Rationale`);
  out.push("");
  out.push(o.rationale);
  out.push("");
  return out.join("\n");
}

function renderFaqMarkdown(o: z.infer<typeof faqBlockSchema>): string {
  const out: string[] = [];
  out.push(`# Frequently asked questions`);
  out.push("");
  for (const f of o.faqs) {
    out.push(`## ${f.question}`);
    out.push("");
    out.push(f.answer);
    out.push("");
  }
  out.push(`## Schema.org FAQPage markup`);
  out.push("");
  out.push("```json");
  out.push(o.schemaMarkup);
  out.push("```");
  out.push("");
  return out.join("\n");
}

function renderAdCopyMarkdown(o: z.infer<typeof adCopySchema>): string {
  const out: string[] = [];
  out.push(`# Ad copy`);
  out.push("");
  out.push(`## Google Ads`);
  out.push("");
  out.push(`**Headlines:**`);
  for (const h of o.google.headlines) out.push(`- ${h}`);
  out.push("");
  out.push(`**Descriptions:**`);
  for (const d of o.google.descriptions) out.push(`- ${d}`);
  out.push("");
  out.push(`## Meta Ads`);
  out.push("");
  out.push(`**Primary text:** ${o.meta.primaryText}`);
  out.push(`**Headline:** ${o.meta.headline}`);
  out.push(`**Description:** ${o.meta.description}`);
  out.push("");
  return out.join("\n");
}

function renderPropertyDescriptionMarkdown(
  o: z.infer<typeof propertyDescriptionSchema>,
): string {
  const out: string[] = [];
  out.push(`# Property description`);
  out.push("");
  out.push(o.description);
  out.push("");
  out.push(`## Atomic facts for AI citation grounding`);
  out.push("");
  for (const c of o.aiCitations) out.push(`- ${c}`);
  out.push("");
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Dispatcher — pick the right drafter by ContentFormat enum
// ---------------------------------------------------------------------------

export type ContentFormat =
  | "BLOG_POST"
  | "NEIGHBORHOOD_PAGE"
  | "PROPERTY_DESCRIPTION"
  | "META_REWRITE"
  | "FAQ_BLOCK"
  | "AD_COPY";

export type DraftResult = {
  output: Record<string, unknown>;
  markdown: string;
  estimatedScore: number;
  model: string;
};

export async function draftContent(
  format: ContentFormat,
  ctx: DrafterContext,
): Promise<DraftResult> {
  switch (format) {
    case "BLOG_POST": {
      const r = await draftBlogPost(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
    case "NEIGHBORHOOD_PAGE": {
      const r = await draftNeighborhoodPage(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
    case "META_REWRITE": {
      const r = await draftMetaRewrite(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
    case "FAQ_BLOCK": {
      const r = await draftFaqBlock(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
    case "AD_COPY": {
      const r = await draftAdCopy(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
    case "PROPERTY_DESCRIPTION": {
      const r = await draftPropertyDescription(ctx);
      return { ...r, estimatedScore: r.output.estimatedScore };
    }
  }
}
