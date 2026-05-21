/**
 * Brand-voice extractor — Claude Haiku 4.5 via @ai-sdk/anthropic.
 *
 * Input: crawled page markdown + the Perplexity research blob.
 * Output: a 6-8 sentence plain-text brand voice note covering tone,
 * register, dos/don'ts, and preferred CTAs. Written so it can be
 * dropped directly into a system prompt verbatim.
 *
 * Gated on ANTHROPIC_API_KEY. If missing, returns `{ skipped: true, reason }`.
 *
 * Same SDK + model pattern as lib/aeo/engines/claude.ts and
 * lib/insights/llm-polish.ts — no new deps.
 */

import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5-20251001";

// Pricing (Anthropic public list, May 2026): Haiku 4.5 is $1/MTok input,
// $5/MTok output. We estimate per call so the orchestrator can roll it up.
const COST_INPUT_PER_MTOK = 1.0;
const COST_OUTPUT_PER_MTOK = 5.0;

export interface VoiceExtractInput {
  orgName: string;
  pages: Array<{ url: string; markdown?: string | null }>;
  research?: {
    companyOverview?: string;
    competitiveLandscape?: string;
    recentNews?: string;
    positioningCues?: string;
  } | null;
}

export type VoiceExtractResult =
  | { ok: true; brandVoice: string; costUsd: number }
  | { ok: false; error: string; skipped?: boolean; reason?: string };

const SYSTEM_PROMPT = `You are a brand voice analyst.

Given a company's name, excerpts of their public web copy, and a research
briefing, produce a 6-8 sentence brand voice note that another writer
could use as a style guide.

Cover ALL of:
  - Tone (warm, clinical, playful, no-nonsense, etc.)
  - Register (vocabulary level, sentence length, formality)
  - What they DO say (recurring phrases, motifs, value props)
  - What they DON'T say (taboo words, off-brand patterns)
  - Preferred CTAs (verbs, urgency level, how they ask for the next step)

Output rules:
  - Plain text only — no markdown, no headings, no bullets, no JSON.
  - 6 to 8 sentences. Coherent paragraph form.
  - Be specific. Quote distinctive phrases in single quotes.
  - If evidence is thin, say so honestly in a sentence rather than inventing.
  - Never address the reader. Write in third person about the brand.`;

export async function extractBrandVoice(
  input: VoiceExtractInput,
): Promise<VoiceExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error: "ANTHROPIC_API_KEY not configured",
      skipped: true,
      reason: "ANTHROPIC_API_KEY not configured",
    };
  }

  const userPrompt = buildUserPrompt(input);

  try {
    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxOutputTokens: 600,
      temperature: 0.4,
    });
    const brandVoice = (text ?? "").trim();
    if (!brandVoice) {
      return { ok: false, error: "claude returned empty brand voice" };
    }

    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * COST_INPUT_PER_MTOK +
      (outputTokens / 1_000_000) * COST_OUTPUT_PER_MTOK;

    console.log(
      `[voice-extract] $${costUsd.toFixed(4)} ${input.orgName} in=${inputTokens} out=${outputTokens}`,
    );
    return { ok: true, brandVoice, costUsd };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[voice-extract] generateText failed:", message);
    return { ok: false, error: `voice-extract error: ${message}` };
  }
}

function buildUserPrompt(input: VoiceExtractInput): string {
  const research = input.research ?? null;

  // Cap individual page snippets so we don't blow the context window. We
  // sort by markdown length descending so the meatier pages survive the cut.
  const pageExcerpts = input.pages
    .filter((p) => p.markdown && p.markdown.trim().length > 0)
    .map((p) => ({
      url: p.url,
      markdown: (p.markdown ?? "").trim().slice(0, 2000),
    }))
    .sort((a, b) => b.markdown.length - a.markdown.length)
    .slice(0, 8);

  const pageBlock = pageExcerpts
    .map(
      (p, i) =>
        `--- Page ${i + 1}: ${p.url} ---\n${p.markdown}`,
    )
    .join("\n\n");

  const researchBlock = research
    ? [
        `Company overview: ${research.companyOverview ?? ""}`,
        `Competitive landscape: ${research.competitiveLandscape ?? ""}`,
        `Recent news: ${research.recentNews ?? ""}`,
        `Positioning cues: ${research.positioningCues ?? ""}`,
      ]
        .filter((line) => line.split(": ")[1])
        .join("\n")
    : "(no external research available)";

  return `Company: ${input.orgName}

External research briefing:
${researchBlock}

Web copy excerpts (from their own site):
${pageBlock || "(no page copy available)"}

Write the 6-8 sentence brand voice note now.`;
}

export function isVoiceExtractConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
