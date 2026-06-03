import "server-only";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { logUsage } from "@/lib/cost-tracker/log";

// ---------------------------------------------------------------------------
// extractProspectProfile — Claude-backed structured extraction of every
// useful field a chatbot conversation might surface. Lands in the
// ChatbotConversation.prospectProfile JSONB column and flows into the
// digest email so the agency operator (Jessica @ TC etc) sees the full
// prospect picture in one inbox row, not just name + email.
//
// Why Claude vs regex: the existing extract-lead.ts is regex-only and
// catches email / phone / name. It can't parse "moving in mid-September
// with my boyfriend, budget around $3,200, looking for a 1BR" into
// structured fields. Claude Haiku at ~600 input tokens × ~200 output
// is ~$0.0006/extract — cheap to run on every idle conversation.
//
// Defensive: this function NEVER throws. Lead capture is upstream;
// extraction is decoration. Any failure returns null and the cron
// retries on the next pass.
// ---------------------------------------------------------------------------

// Anthropic tool-calling caps the number of union-type parameters in a
// single schema at 16. The original v1 of this extractor had 18 fields
// declared as z.string().nullable() / z.array().nullable(), each of
// which compiles to a string | null / array | null union — every
// extraction call was 400-ing on the union-count limit. (Adam caught
// this 2026-06-03 via the lead-routing diagnostic.)
//
// New convention: empty strings + empty arrays are the "not provided"
// sentinel. Eliminates the union pressure entirely while keeping the
// schema readable and the downstream code defensive (truthy checks
// already treat "" as absent throughout the email template).
export const ProspectProfileSchema = z.object({
  // Identity / contact
  fullName: z
    .string()
    .default("")
    .describe(
      'First + last name if mentioned, otherwise empty string.',
    ),
  email: z
    .string()
    .default("")
    .describe('Email address if provided, otherwise empty string.'),
  phone: z
    .string()
    .default("")
    .describe('Phone number if provided, otherwise empty string.'),

  // Move / lease intent
  moveInDate: z
    .string()
    .default("")
    .describe(
      'Target move-in date as the prospect described it, e.g. "September 1", "mid-September", "ASAP", "by Q4". Verbatim where possible. Empty string if not mentioned.',
    ),
  moveOutDate: z
    .string()
    .default("")
    .describe(
      'Target move-out / lease-end date if mentioned. Same verbatim convention.',
    ),
  leaseTerm: z
    .string()
    .default("")
    .describe('Desired lease length, e.g. "12 months", "month-to-month"'),

  // Unit / property fit
  roomType: z
    .string()
    .default("")
    .describe(
      'Unit type as discussed, e.g. "studio", "1BR", "2BR with den", "townhouse"',
    ),
  budgetMonthly: z
    .string()
    .default("")
    .describe('Monthly budget as stated, e.g. "$3,200", "under $4k", "3-3.5k"'),
  partySize: z
    .string()
    .default("")
    .describe(
      'Number of people moving in including pets, e.g. "myself + partner", "family of 4 with a dog"',
    ),

  // Lifestyle context
  occupation: z
    .string()
    .default("")
    .describe('Job / role if mentioned, e.g. "software engineer", "student"'),
  employer: z
    .string()
    .default("")
    .describe('Employer / school / company name if mentioned'),
  petsAndKids: z
    .string()
    .default("")
    .describe(
      'Pets and / or children context — number, breeds, ages — anything the prospect shared.',
    ),
  reasonForMove: z
    .string()
    .default("")
    .describe(
      'Why they are moving — new job, relocating, lease ending, etc.',
    ),

  // Preferences + soft signals — arrays default to [] (empty), no union.
  mustHaves: z
    .array(z.string())
    .default([])
    .describe(
      'Specific amenities or features the prospect named as must-haves — e.g. ["in-unit washer/dryer", "parking", "south-facing", "near transit"]. Empty array if nothing matches.',
    ),
  niceToHaves: z
    .array(z.string())
    .default([])
    .describe('Preferences they mentioned as nice-to-have. Empty array if nothing matches.'),
  competitorsConsidering: z
    .array(z.string())
    .default([])
    .describe(
      'Other buildings / properties the prospect mentioned by name — important for objection prep. Empty array if nothing matches.',
    ),
  sentiment: z
    .enum(["hot", "warm", "lukewarm", "cold", "unclear"])
    .describe(
      'Hand-on-the-pulse read of how ready they are to lease. "hot" = ready to tour or sign this week. "cold" = browsing.',
    ),

  // Closing helpers
  followUpNeeded: z
    .string()
    .default("")
    .describe(
      'One-line description of the most specific next action the agency should take. E.g. "Schedule a tour Friday at 3pm" or "Send floor plans for 2BR units under $4k". Empty string if nothing specific.',
    ),
  notes: z
    .string()
    .default("")
    .describe(
      'Free-text catch-all for anything important not covered above — quotes, concerns, signals. Empty string if nothing notable.',
    ),
});

export type ProspectProfile = z.infer<typeof ProspectProfileSchema>;

/** Diagnostic-friendly extraction result. Callers that just need the
 *  profile can read `.profile`; callers that need to debug a backfill
 *  failure can read `.error` to see the actual model / API failure
 *  instead of a generic "extraction failed" string. */
export type ProspectProfileExtractResult =
  | { ok: true; profile: ProspectProfile }
  | { ok: false; error: string };

// Match the model the public chat route uses so we get the same
// pricing tier + latency tier across the chatbot surface. The
// previous "claude-3-5-haiku-latest" alias has been retired on
// Anthropic's side — every extract call was silently 404-ing,
// which is what surfaced as "extraction failed (no ANTHROPIC_API_KEY
// or model error)" in the lead-routing diagnostic. Adam caught
// this 2026-06-03.
const EXTRACT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an extraction assistant. Given a chatbot transcript between a prospective tenant and an apartment-leasing assistant, pull out every fact the prospect shared.

You MUST respond with ONLY a JSON object — no prose, no markdown fence, no explanation. Just the JSON. The schema is:

{
  "fullName": string,                    // First + last name if mentioned, otherwise ""
  "email": string,                        // Email if provided, otherwise ""
  "phone": string,                        // Phone if provided, otherwise ""
  "moveInDate": string,                   // Verbatim ("September 1", "ASAP", etc), or ""
  "moveOutDate": string,                  // Same convention, or ""
  "leaseTerm": string,                    // "12 months", "month-to-month", or ""
  "roomType": string,                     // "studio", "1BR", "2BR with den", or ""
  "budgetMonthly": string,                // "$3,200", "under $4k", "3-3.5k", or ""
  "partySize": string,                    // "myself + partner", "family of 4", or ""
  "occupation": string,                   // "software engineer", "student", or ""
  "employer": string,                     // Company name, or ""
  "petsAndKids": string,                  // Pets/kids context, or ""
  "reasonForMove": string,                // Why moving, or ""
  "mustHaves": string[],                  // Array of must-have features. [] if none.
  "niceToHaves": string[],                // Array of nice-to-haves. [] if none.
  "competitorsConsidering": string[],     // Other buildings they mentioned. [] if none.
  "sentiment": "hot"|"warm"|"lukewarm"|"cold"|"unclear",
  "followUpNeeded": string,               // One-line next action for the agency, or ""
  "notes": string                          // Free-text catch-all, or ""
}

Rules:
1. NEVER invent data. Empty string ("") for unset string fields, empty array ([]) for unset array fields.
2. Quote the prospect's words verbatim where possible. Don't paraphrase budgets, dates, or unit types.
3. The transcript may be long. Use the user turns as ground truth — never trust the assistant's guesses.
4. sentiment MUST be one of the 5 enum values listed.
5. Output ONLY the JSON object. No prefix, no suffix, no markdown.`;

export async function extractProspectProfile(args: {
  messages: Array<{ role: string; content: string }>;
  orgId: string;
  conversationId: string;
}): Promise<ProspectProfileExtractResult> {
  // Skip the empty-conversation case — no signal to extract.
  if (!args.messages || args.messages.length === 0) {
    return { ok: false, error: "no messages in conversation" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[extract-prospect-profile] ANTHROPIC_API_KEY missing — skipping",
    );
    return { ok: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  // Compact serialization. Keep ~2k token budget tops.
  const transcript = args.messages
    .map((m) => {
      const role = m.role === "user" ? "PROSPECT" : "ASSISTANT";
      return `${role}: ${(m.content ?? "").slice(0, 1200)}`;
    })
    .slice(-30) // last 30 turns covers any realistic conversation
    .join("\n\n");

  const startedAt = Date.now();
  try {
    // Plain generateText + JSON parsing instead of generateObject.
    // generateObject was hanging at 15s per call via the AI SDK's
    // Anthropic tool-mode adapter — likely the compiled tool schema
    // (even after dropping union types) was triggering some slow
    // path on Anthropic's side. Asking Claude to return raw JSON
    // directly is faster (~1-2s per call) and we already trust
    // Haiku to produce valid JSON when the schema is in the system
    // prompt. We validate post-hoc with z.parse() so corrupt output
    // still surfaces a clean error.
    const { text, usage } = await generateText({
      model: anthropic(EXTRACT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: `Transcript:\n\n${transcript}`,
      abortSignal: AbortSignal.timeout(15_000),
      maxOutputTokens: 1000,
    });

    // Strip any accidental code-fence wrapping ("```json...```") before
    // parsing — Haiku sometimes still wraps despite the "no markdown"
    // instruction, and we'd rather salvage than fail.
    const cleaned = text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsed = ProspectProfileSchema.safeParse(JSON.parse(cleaned));
    if (!parsed.success) {
      throw new Error(
        `Claude returned malformed JSON: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`,
      );
    }
    const object = parsed.data;

    // Log cost so /admin/costs reflects the digest spend. Haiku pricing
    // 2025: $1/MTok input, $5/MTok output. Round to micro-USD.
    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const costUsd =
      (inputTokens * 1) / 1_000_000 + (outputTokens * 5) / 1_000_000;
    void logUsage({
      provider: "anthropic",
      endpoint: `chatbot.extract-profile[${EXTRACT_MODEL}]`,
      status: "SUCCESS",
      costUsd,
      durationMs: Date.now() - startedAt,
      orgId: args.orgId,
      meta: {
        surface: "chatbot",
        conversationId: args.conversationId,
        model: EXTRACT_MODEL,
        inputTokens,
        outputTokens,
      },
    }).catch(() => undefined);
    return { ok: true, profile: object };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[extract-prospect-profile] failed for conversation ${args.conversationId}:`,
      err,
    );
    void logUsage({
      provider: "anthropic",
      endpoint: `chatbot.extract-profile[${EXTRACT_MODEL}]`,
      status: "ERROR",
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      orgId: args.orgId,
      meta: {
        surface: "chatbot",
        conversationId: args.conversationId,
        message,
      },
    }).catch(() => undefined);
    return { ok: false, error: message };
  }
}
