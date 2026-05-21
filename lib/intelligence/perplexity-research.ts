/**
 * Perplexity Sonar research for a single company.
 *
 * Single entry point: `researchCompany({ orgName, domain })`. We send Sonar
 * a structured prompt asking for company overview, competitive landscape,
 * recent news, and positioning cues, and parse the JSON block out of the
 * response. The Sonar API itself returns free text plus a `citations` array
 * — we keep both so downstream consumers can show source URLs.
 *
 * Gated on PERPLEXITY_API_KEY. If missing, returns `{ skipped: true, reason }`.
 *
 * No new deps — raw fetch, same pattern as lib/aeo/engines/perplexity.ts.
 */

import "server-only";

const ENDPOINT = "https://api.perplexity.ai/chat/completions";
const MODEL = process.env.INTELLIGENCE_PERPLEXITY_MODEL ?? "sonar";

// Perplexity Sonar list pricing as of 2026-05: ~$0.005 per request. Used for
// cost-log only — the caller is responsible for rolling this into stats.
const COST_PER_CALL_USD = 0.005;

export interface CompanyResearch {
  companyOverview: string;
  competitiveLandscape: string;
  recentNews: string;
  positioningCues: string;
  citations: string[];
}

export type ResearchResult =
  | { ok: true; data: CompanyResearch; costUsd: number }
  | { ok: false; error: string; skipped?: boolean; reason?: string };

const SYSTEM_PROMPT = `You are a senior B2B research analyst.

Given a company name and domain, produce a tight, factual briefing
covering FOUR sections — Company Overview, Competitive Landscape,
Recent News, and Positioning Cues. Be specific and concrete. Avoid
generic platitudes. Cite the company's own materials where possible.

You MUST respond with a single JSON object (no markdown, no fences,
no commentary outside the JSON). Schema:

{
  "companyOverview": "3-5 sentences: what they do, who they serve, scale signals (markets, properties, units, employees if known).",
  "competitiveLandscape": "3-5 sentences: direct competitors by name, how this company differentiates, where it's strong/weak.",
  "recentNews": "2-4 bullet-style sentences separated by newlines: notable launches, hires, funding, expansions in the last 12 months.",
  "positioningCues": "3-5 sentences: brand voice signals lifted from their public materials — tone, vocabulary, taglines, dominant CTAs, audience they're courting."
}`;

export async function researchCompany(args: {
  orgName: string;
  domain: string;
}): Promise<ResearchResult> {
  if (!process.env.PERPLEXITY_API_KEY) {
    return {
      ok: false,
      error: "PERPLEXITY_API_KEY not configured",
      skipped: true,
      reason: "PERPLEXITY_API_KEY not configured",
    };
  }

  const userPrompt = buildUserPrompt(args);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1800,
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const error = `perplexity http ${res.status}: ${detail.slice(0, 200)}`;
      console.error("[perplexity-research]", error);
      return { ok: false, error };
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
    };
    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    const citations = Array.isArray(body.citations) ? body.citations : [];

    const parsed = safeParseResearch(text);
    if (!parsed) {
      // Fall back to stuffing the raw text into companyOverview so we still
      // persist something useful.
      console.warn(
        "[perplexity-research] failed to parse JSON, falling back to raw text",
      );
      const data: CompanyResearch = {
        companyOverview: text.slice(0, 2000),
        competitiveLandscape: "",
        recentNews: "",
        positioningCues: "",
        citations,
      };
      console.log(
        `[perplexity-research] $${COST_PER_CALL_USD.toFixed(4)} ${args.domain} (unparsed)`,
      );
      return { ok: true, data, costUsd: COST_PER_CALL_USD };
    }

    const data: CompanyResearch = { ...parsed, citations };
    console.log(
      `[perplexity-research] $${COST_PER_CALL_USD.toFixed(4)} ${args.domain} ${citations.length} citations`,
    );
    return { ok: true, data, costUsd: COST_PER_CALL_USD };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[perplexity-research] request failed:", message);
    return { ok: false, error: `perplexity error: ${message}` };
  }
}

function buildUserPrompt(args: { orgName: string; domain: string }): string {
  return `Company: ${args.orgName}
Primary domain: ${args.domain}

Research this company using public sources (their site, press releases,
news coverage, review sites, LinkedIn). Return the JSON briefing per
the schema. Be specific — name competitors, cite numbers, quote phrases
that capture their voice.`;
}

function safeParseResearch(
  text: string,
): Omit<CompanyResearch, "citations"> | null {
  if (!text) return null;
  // Strip a leading ```json or ``` fence if Sonar ignored our instruction.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>;
    return {
      companyOverview: stringField(obj.companyOverview),
      competitiveLandscape: stringField(obj.competitiveLandscape),
      recentNews: stringField(obj.recentNews),
      positioningCues: stringField(obj.positioningCues),
    };
  } catch {
    // Try to recover by locating the outermost { ... } block.
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      const obj = JSON.parse(stripped.slice(start, end + 1)) as Record<
        string,
        unknown
      >;
      return {
        companyOverview: stringField(obj.companyOverview),
        competitiveLandscape: stringField(obj.competitiveLandscape),
        recentNews: stringField(obj.recentNews),
        positioningCues: stringField(obj.positioningCues),
      };
    } catch {
      return null;
    }
  }
}

function stringField(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join("\n");
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

export function isPerplexityResearchConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY;
}
