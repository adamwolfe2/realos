import "server-only";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { DetectedInsight } from "./types";

// ---------------------------------------------------------------------------
// LLM polish layer for detected insights.
//
// Detector rules emit accurate-but-template-y copy ("CPL spike at 47%
// over prior week"). This layer feeds the raw context through Claude
// Haiku to produce a tighter, operator-readable rewrite ("Your Google
// Ads CPL jumped from $34 to $48 this week — likely audience exhaustion
// or creative fatigue. Pause your weakest ad set first.").
//
// Design constraints:
//   - Polishing is OPTIONAL. Without ANTHROPIC_API_KEY the original
//     copy ships through unchanged. Detectors must always be useful
//     standalone.
//   - Batched: one Claude call per detector run, not per insight, so
//     a 30-insight pass is one API call (≤$0.005).
//   - Schema-validated: Claude returns structured (title, body,
//     suggestedAction) per insight. Failure to parse one insight
//     doesn't fail the batch — we fall back to the raw rule output.
//   - Never increases severity or invents context. Polish is purely
//     copywriting; the data is sacred.
// ---------------------------------------------------------------------------

const polishSchema = z.object({
  insights: z.array(
    z.object({
      id: z.string(),
      title: z.string().max(120),
      body: z.string().max(420),
      suggestedAction: z.string().max(220),
    }),
  ),
});

const SYSTEM_PROMPT = `You're a senior real estate operator's analyst. Operators are busy
multifamily / student housing / senior living managers who want
clear, calm direction — not jargon, not breathless alerts.

You'll receive a batch of detected insights with their raw template
copy + structured context. Rewrite each into:

- title (≤80 chars): plain-English headline. Lead with the property
  name when present and the metric that moved. No marketing
  language, no exclamation points, no emoji.
- body (≤300 chars): 1-2 sentences explaining the signal in operator
  language. Reference the actual numbers from context when present.
  Be specific. No "we noticed that" filler.
- suggestedAction (≤180 chars): one concrete next step. Use second
  person ("Pause the underperforming ad set"). Be opinionated.

Constraints:
- Never invent numbers not in the input context.
- Never escalate severity (don't add "urgent" / "critical" copy if
  the source severity is "info" or "warning").
- Use the property name verbatim. Don't abbreviate.
- US English. Numbers as digits ("12 leases" not "twelve leases").`;

/**
 * Polish a batch of detected insights via Claude Haiku. On any failure
 * (no key, API error, schema mismatch) returns the original insights
 * unchanged so the caller always gets usable output.
 */
export async function polishInsights(
  insights: DetectedInsight[],
): Promise<DetectedInsight[]> {
  if (insights.length === 0) return insights;
  if (!process.env.ANTHROPIC_API_KEY) {
    return insights;
  }

  // Build a stable id for each insight in the batch so Claude can
  // address them by id without us depending on array order.
  const indexed = insights.map((i, idx) => ({
    id: `i${idx}`,
    insight: i,
  }));

  const prompt = buildPrompt(indexed);

  try {
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: polishSchema,
      prompt,
      maxOutputTokens: 2048,
    });

    const polishedById = new Map<
      string,
      { title: string; body: string; suggestedAction: string }
    >(object.insights.map((p) => [p.id, p]));

    return indexed.map(({ id, insight }) => {
      const p = polishedById.get(id);
      if (!p) return insight; // fallback to raw
      return {
        ...insight,
        title: p.title.trim() || insight.title,
        body: p.body.trim() || insight.body,
        suggestedAction:
          p.suggestedAction.trim() || insight.suggestedAction,
      };
    });
  } catch (err) {
    console.error(
      "[insights.polish] Claude polish failed; keeping raw rule copy:",
      err instanceof Error ? err.message : err,
    );
    return insights;
  }
}

function buildPrompt(
  indexed: Array<{ id: string; insight: DetectedInsight }>,
): string {
  const items = indexed
    .map(({ id, insight }) => {
      const ctx = insight.context
        ? JSON.stringify(insight.context, null, 0)
        : "{}";
      return `id: ${id}
kind: ${insight.kind}
category: ${insight.category}
severity: ${insight.severity}
raw_title: ${insight.title}
raw_body: ${insight.body}
raw_action: ${insight.suggestedAction ?? ""}
context: ${ctx}`;
    })
    .join("\n---\n");

  return `${SYSTEM_PROMPT}

Insights to rewrite:

${items}

Return one polished insight per id in the same array order.`;
}
