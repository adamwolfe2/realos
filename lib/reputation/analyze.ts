import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { Sentiment } from "@prisma/client";
import type { ScannedMention } from "./types";

// ---------------------------------------------------------------------------
// Batched sentiment + topic classification via Claude Haiku.
//
// One generateObject call per scan (not per mention). Each item in the
// prompt carries a short id so we can map Claude's response back to our
// mention array without ambiguity. Haiku handles 50+ short items per call
// comfortably; we trim longer excerpts to 800 chars before sending to keep
// token usage predictable.
// ---------------------------------------------------------------------------

export const TOPIC_TAGS = [
  "maintenance",
  "pricing",
  "safety",
  "noise",
  "staff",
  "amenities",
  "location",
  "cleanliness",
  "value",
  "general",
] as const;

export type TopicTag = (typeof TOPIC_TAGS)[number];

const analysisSchema = z.object({
  mentions: z.array(
    z.object({
      id: z.string(),
      sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]),
      topics: z.array(z.enum(TOPIC_TAGS)).min(1).max(3),
    })
  ),
});

type AnalysisItem = {
  id: string;
  sentiment: Sentiment;
  topics: TopicTag[];
};

// Conservative Haiku cost estimate: ~$0.80 per 1M input tokens, ~$4 per 1M
// output tokens. A 50-mention scan is ~12k input + ~2k output tokens. Round
// up to 1 cent so the number isn't deceptively small when mentions pile up.
export const ANALYSIS_COST_CENTS_PER_SCAN = 1;

/**
 * Analyze a batch of mentions. Returns the classifications keyed by the
 * caller-supplied id. Callers are responsible for tagging each ScannedMention
 * with a stable id before calling (we use the urlHash downstream in
 * orchestrate.ts).
 *
 * Degrades gracefully: if ANTHROPIC_API_KEY is missing or the model call
 * throws, returns an empty Map so the orchestrator falls back to un-analyzed
 * mentions rather than failing the whole scan.
 */
export async function analyzeSentimentAndTopics(
  items: Array<{ id: string; mention: ScannedMention }>
): Promise<Map<string, AnalysisItem>> {
  if (items.length === 0) return new Map();
  if (!process.env.ANTHROPIC_API_KEY) return new Map();

  const prompt = buildPrompt(items);

  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: analysisSchema,
      prompt,
      // Keep latency in check even if the model gets chatty.
      maxOutputTokens: 2048,
    });

    const map = new Map<string, AnalysisItem>();
    for (const row of object.mentions) {
      map.set(row.id, {
        id: row.id,
        sentiment: row.sentiment as Sentiment,
        topics: row.topics as TopicTag[],
      });
    }
    return map;
  } catch {
    // Silent fallback — persisting un-analyzed mentions is strictly better
    // than losing the scan. The UI renders a "not analyzed" state for
    // rows with sentiment = null.
    return new Map();
  }
}

function buildPrompt(
  items: Array<{ id: string; mention: ScannedMention }>
): string {
  const lines = items.map(({ id, mention }) => {
    const text = mention.excerpt.slice(0, 800).replace(/\s+/g, " ").trim();
    const src = mention.source;
    const rating =
      typeof mention.rating === "number" ? ` (rating: ${mention.rating}/5)` : "";
    return `- id: ${id} | source: ${src}${rating}\n  text: ${text}`;
  });
  return `You are classifying public mentions of a rental property.

For each item below, decide:
  - sentiment: POSITIVE | NEGATIVE | NEUTRAL | MIXED
  - topics: 1–3 tags from: ${TOPIC_TAGS.join(", ")}

Rules:
- Sentiment reflects the author's feeling about the property, not their general mood.
- Use MIXED only when positive and negative signals are both clearly present.
- Use NEUTRAL for factual questions or generic mentions with no clear sentiment (e.g. "anyone live here?").
- Prefer specific topics (maintenance, staff, noise) over "general" when possible.

Return exactly one classification per input id.

Items:
${lines.join("\n")}
`;
}
