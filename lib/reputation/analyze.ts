import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { Sentiment } from "@prisma/client";
import type { ScannedMention } from "./types";
import { logUsage } from "@/lib/cost-tracker/log";
import { tokenCostUsd } from "@/lib/aeo/engines/pricing";

const ANALYZE_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Batched sentiment + topic classification via Claude Haiku.
//
// One generateObject call per scan. The schema is INTENTIONALLY PERMISSIVE:
// we previously required `topics: z.array(...).min(1)` which caused silent
// full-batch failures when Claude returned 0 tags for any single mention
// (and zod validation is all-or-nothing for arrays). Now we accept 0–5 topic
// strings, then filter to known TOPIC_TAGS downstream.
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

const TOPIC_SET = new Set<string>(TOPIC_TAGS);

// Anthropic's structured-output rejects JSON Schema `maxItems` constraints
// ("output_format.schema: For 'array' type, property 'maxItems' is not
// supported"). Same restriction applies to numeric `minimum`/`maximum`
// ("output_format.schema: For 'number' type, properties maximum, minimum
// are not supported"). Keep the schema permissive and clamp in
// post-processing instead.
const analysisSchema = z.object({
  mentions: z.array(
    z.object({
      id: z.string(),
      sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL", "MIXED"]),
      // 0..1 self-reported confidence. Validated in post-processing so the
      // Anthropic structured-output call doesn't reject min/max constraints.
      confidence: z.number().default(0.5),
      topics: z.array(z.string()).default([]),
    })
  ),
});

type AnalysisItem = {
  id: string;
  sentiment: Sentiment;
  confidence: number;
  topics: TopicTag[];
};

// Conservative Haiku cost estimate (~$0.005/scan for typical batch size).
export const ANALYSIS_COST_CENTS_PER_SCAN = 1;

/**
 * Analyze a batch of mentions. Returns the classifications keyed by the
 * caller-supplied id. Callers are responsible for tagging each ScannedMention
 * with a stable id before calling (we use the urlHash downstream).
 *
 * Degrades gracefully: on missing ANTHROPIC_API_KEY or a model error, returns
 * an empty Map and logs to console.error so Vercel logs surface the cause.
 */
export type AnalyzeResult = {
  classifications: Map<string, AnalysisItem>;
  /** Surfaces in the SSE stream + Vercel logs so the silent-failure
   * mode (Bug #23) becomes visible. "ok" → all good; otherwise an
   * operator-readable string explaining why classification was skipped. */
  status: "ok" | "no_api_key" | "error";
  errorMessage: string | null;
};

export async function analyzeSentimentAndTopics(
  items: Array<{ id: string; mention: ScannedMention }>,
  /** Optional cost-attribution scope. Reputation orchestrator passes
   *  the orgId + propertyId it's scanning so /admin/costs can show
   *  per-property sentiment-classification spend. */
  cost?: { orgId?: string | null; propertyId?: string | null },
): Promise<AnalyzeResult> {
  if (items.length === 0) {
    return { classifications: new Map(), status: "ok", errorMessage: null };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    const msg =
      "ANTHROPIC_API_KEY missing — mentions will stay unclassified. Set the key in Vercel env vars and re-run a scan.";
    console.error(`[reputation.analyze] ${msg}`);
    return {
      classifications: new Map(),
      status: "no_api_key",
      errorMessage: msg,
    };
  }

  const prompt = buildPrompt(items);
  const startedAt = Date.now();

  try {
    const { object, usage } = await generateObject({
      model: anthropic(ANALYZE_MODEL),
      schema: analysisSchema,
      prompt,
      maxOutputTokens: 2048,
    });
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    await logUsage({
      provider: "anthropic",
      endpoint: `${ANALYZE_MODEL}/reputation-sentiment`,
      status: "SUCCESS",
      costUsd: tokenCostUsd(ANALYZE_MODEL, inputTokens, outputTokens),
      durationMs: Date.now() - startedAt,
      orgId: cost?.orgId ?? null,
      propertyId: cost?.propertyId ?? null,
      meta: {
        model: ANALYZE_MODEL,
        inputTokens,
        outputTokens,
        batchSize: items.length,
      },
    });

    const map = new Map<string, AnalysisItem>();
    for (const row of object.mentions) {
      // Filter to known tags AND cap at 5 here (was schema-enforced, now
      // enforced post-Anthropic so the structured-output call doesn't
      // reject the schema).
      const topics = row.topics
        .map((t) => t.toLowerCase())
        .filter((t): t is TopicTag => TOPIC_SET.has(t))
        .slice(0, 5);
      // Clamp confidence to [0, 1] in post-processing since the JSON
      // Schema validator (Anthropic structured output) can't enforce it.
      const confidence = Math.max(0, Math.min(1, row.confidence ?? 0.5));
      map.set(row.id, {
        id: row.id,
        sentiment: row.sentiment as Sentiment,
        confidence,
        topics,
      });
    }
    return { classifications: map, status: "ok", errorMessage: null };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown classification error";
    // Log so operators can see why sentiment is missing in Vercel logs.
    console.error(
      "[reputation.analyze] Claude classification failed:",
      errorMessage,
    );
    await logUsage({
      provider: "anthropic",
      endpoint: `${ANALYZE_MODEL}/reputation-sentiment`,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      orgId: cost?.orgId ?? null,
      propertyId: cost?.propertyId ?? null,
      meta: {
        model: ANALYZE_MODEL,
        batchSize: items.length,
        error: errorMessage.slice(0, 200),
      },
    });
    return {
      classifications: new Map(),
      status: "error",
      errorMessage,
    };
  }
}

function buildPrompt(
  items: Array<{ id: string; mention: ScannedMention }>
): string {
  const lines = items.map(({ id, mention }) => {
    const text = mention.excerpt.slice(0, 600).replace(/\s+/g, " ").trim();
    const src = mention.source;
    const rating =
      typeof mention.rating === "number" ? ` (rating: ${mention.rating}/5)` : "";
    return `- id: ${id} | source: ${src}${rating}\n  text: ${text}`;
  });
  return `Classify each public mention of a rental property below.

For each item, return:
  - sentiment: POSITIVE | NEGATIVE | NEUTRAL | MIXED
  - confidence: a 0..1 score reflecting how sure you are of the sentiment label.
                Use 0.9+ only when the text is unambiguous. Use 0.5–0.7 for
                short/sparse content. Use < 0.5 when you genuinely can't tell.
  - topics: 0 to 3 tags from [${TOPIC_TAGS.join(", ")}]. If nothing fits, return an empty array.

Guidance:
- Sentiment reflects the author's feeling about the property, not general mood.
- Use MIXED only when positive and negative signals are clearly both present.
- Use NEUTRAL for factual questions or generic mentions with no clear sentiment ("anyone live at X?").
- Prefer specific topics (maintenance, staff, noise) over "general" when possible.
- Be honest about uncertainty — a low confidence on a borderline sentiment is
  more useful than overclaiming.

Return exactly one classification per input id.

Items:
${lines.join("\n")}
`;
}
