import "server-only";
import { generateObject } from "ai";
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

Rules:
1. NEVER invent data. If a field wasn't mentioned, return null (or [] for arrays).
2. Quote the prospect's words where possible. Don't paraphrase budgets, dates, or unit types.
3. The transcript may be long. Use the user turns as ground truth — never trust the assistant's guesses.
4. sentiment must be one of: hot, warm, lukewarm, cold, unclear.
5. mustHaves / niceToHaves / competitorsConsidering are arrays. Empty array if nothing matches.`;

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
    // Hard 15s ceiling per extraction so a slow Anthropic response can't
    // hang the parent backfill / cron loop. Most haiku-4-5 calls land
    // in 1-2 sec; anything over 15 is almost certainly a rate-limit
    // pause we don't want to wait through.
    const { object, usage } = await generateObject({
      model: anthropic(EXTRACT_MODEL),
      schema: ProspectProfileSchema,
      system: SYSTEM_PROMPT,
      prompt: `Transcript:\n\n${transcript}`,
      abortSignal: AbortSignal.timeout(15_000),
    });

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
