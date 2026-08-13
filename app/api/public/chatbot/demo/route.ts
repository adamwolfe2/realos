import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { scrape } from "@/lib/intelligence/firecrawl";
import {
  normalizeDemoUrl,
  derivePropertyName,
} from "@/lib/chatbot/demo-helpers";
import {
  enrichLimiter,
  publicApiLimiter,
  checkRateLimit,
  getIp,
  WIDGET_FALLBACK,
} from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/public/chatbot/demo
//
// Backend for the /build-a-chatbot lead magnet. Two actions, both
// STATELESS — nothing is persisted, the client holds the scraped context
// and passes it back on every chat turn:
//
//   { action: "scrape", url }        → Firecrawl-render the prospect's
//     homepage, return { propertyName, facts } for the demo bot. Cached
//     7 days inside lib/intelligence/firecrawl (unstable_cache), so
//     repeat demos of the same property cost nothing.
//
//   { action: "chat", context, messages } → stream a Claude Haiku reply
//     grounded ONLY in the scraped site content.
//
// This deliberately does NOT touch the tenant chat pipeline
// (/api/public/chatbot/chat) — that route is slug-routed, org-scoped,
// and persists conversations/leads. A prospect demo has no org.
//
// Denial-of-wallet bounds: scrape at 5/min/IP (Firecrawl $), chat at
// 60/min/IP with hard caps on message count, message size, and context
// size (worst case ~5K input tokens of Haiku per call).
// ---------------------------------------------------------------------------

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const scrapeBody = z.object({
  action: z.literal("scrape"),
  url: z.string().min(4).max(300),
});

const chatBody = z.object({
  action: z.literal("chat"),
  context: z.object({
    propertyName: z.string().min(1).max(120),
    websiteUrl: z.string().max(300),
    facts: z.string().min(1).max(8000),
  }),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1500),
      }),
    )
    .min(1)
    .max(16),
});

const body = z.discriminatedUnion("action", [scrapeBody, chatBody]);

export async function POST(req: NextRequest) {
  const ip = getIp(req);

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = body.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.action === "scrape") {
    // softFallback: an in-memory limiter when Upstash env is missing —
    // same pattern as the widget routes, so a misconfigured deploy (or
    // local dev) degrades to soft limiting instead of failing closed on
    // a public marketing surface.
    const { allowed } = await checkRateLimit(enrichLimiter, ip, {
      softFallback: { requests: 5, windowMs: 60_000 },
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests, try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return handleScrape(parsed.data.url);
  }

  const { allowed } = await checkRateLimit(publicApiLimiter, ip, {
    softFallback: WIDGET_FALLBACK.publicApi,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return handleChat(parsed.data);
}

// ── Scrape ─────────────────────────────────────────────────────────────

async function handleScrape(rawUrl: string) {
  const url = normalizeDemoUrl(rawUrl);
  if (!url) {
    return NextResponse.json(
      { error: "That doesn't look like a public website URL." },
      { status: 400 },
    );
  }

  const result = await scrape({ url: url.toString(), formats: ["markdown"] });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          "We couldn't read that site. It may be behind a login or blocking crawlers.",
      },
      { status: 502 },
    );
  }

  const title = result.data.metadata?.title ?? "";
  const description = result.data.metadata?.description ?? "";
  const markdown = result.data.markdown ?? "";
  const facts = [description, markdown]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 7000);

  if (!facts) {
    return NextResponse.json(
      {
        error:
          "We reached the site but couldn't extract any readable content.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    propertyName: derivePropertyName(title, url.hostname),
    websiteUrl: url.toString(),
    facts,
  });
}

// ── Chat ───────────────────────────────────────────────────────────────

function buildDemoSystemPrompt(ctx: {
  propertyName: string;
  websiteUrl: string;
  facts: string;
}): string {
  return `You are the AI leasing assistant for ${ctx.propertyName}, embedded on their website. You are being previewed live by someone from the property's team, so answer exactly as you would for a real renter.

Rules:
- Ground every answer ONLY in the WEBSITE CONTENT below. Never invent prices, availability, dates, or policies.
- If the content doesn't cover a question, say the leasing team can confirm the specifics, and offer to pass along their contact details.
- Be warm and specific. 1-3 short sentences per reply.
- After genuinely helping, look for a natural moment to invite a tour or ask for their name and email so leasing can follow up. Never open with that ask.
- Plain text only. No markdown, no bullet lists, no asterisks, no em dashes.

WEBSITE CONTENT for ${ctx.propertyName} (${ctx.websiteUrl}):
${ctx.facts}`;
}

async function handleChat(data: z.infer<typeof chatBody>) {
  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildDemoSystemPrompt(data.context),
    messages: data.messages,
    // Denial-of-wallet: bound the reply. Demo answers are 1-3 sentences.
    maxOutputTokens: 400,
  });
  return result.toTextStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
