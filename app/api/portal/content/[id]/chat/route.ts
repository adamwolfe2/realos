import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/db";
import {
  requireWritableWorkspace,
  ForbiddenError,
  tenantWhere,
} from "@/lib/tenancy/scope";
import { Prisma } from "@prisma/client";
import { checkAiQuota } from "@/lib/ai/quota";
import { aiCallLimiter, checkRateLimit, rateLimited } from "@/lib/rate-limit";
import {
  checkAiBillingGate,
  aiBillingDeniedResponseBody,
} from "@/lib/billing/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Conversational refinement turns are typically 1-3s, capped at 30s.
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// /api/portal/content/[id]/chat — streaming chat endpoint for the editor.
//
// Model: Claude Sonnet 4.5 via @ai-sdk/anthropic.
// Transport: plain text stream via result.toTextStreamResponse() so the
//   client reader can stay dep-free (no useChat).
//
// Tool calls: we don't use the SDK's tool-call protocol here. Instead,
// the system prompt instructs the model to emit a `<<APPLY_EDIT>>{...}`
// sentinel as the LAST line whenever the user asks for a structural
// change (e.g. "rewrite the intro", "tighten section 3", "add an FAQ").
// The client splits on the sentinel and applies the edit via the TipTap
// editor instance. Everything before the sentinel is the human-readable
// confirmation rendered in the chat bubble.
//
// Why not the SDK's tool protocol: streamText with `tools` emits
// SSE-style typed chunks via toUIMessageStreamResponse(). That format
// requires the matching SDK client reader (useChat / readDataStream)
// which we deliberately aren't adding. Plain text streaming + a sentinel
// keeps the client surface to one ReadableStream.getReader() loop.
// ---------------------------------------------------------------------------

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(20_000),
});

const bodySchema = z.object({
  messages: z.array(chatMessage).min(1).max(50),
  htmlBody: z.string().max(200_000).optional(),
  title: z.string().max(280).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

const MODEL_ID = "claude-sonnet-4-5";

export async function POST(req: NextRequest, ctx: RouteContext) {
  let scope;
  try {
    scope = await requireWritableWorkspace();
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  const { id } = await ctx.params;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    const detail =
      err instanceof Error ? err.message.slice(0, 300) : "invalid";
    return NextResponse.json(
      { error: "Invalid body", detail },
      { status: 400 },
    );
  }

  const draft = await prisma.contentDraft.findFirst({
    where: { id, ...tenantWhere<{ orgId?: string }>(scope) } as never,
    select: {
      id: true,
      orgId: true,
      propertyId: true,
      format: true,
      brief: true,
      targetQuery: true,
      aiContext: true,
      chatThread: true,
    },
  });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (
    scope.allowedPropertyIds &&
    draft.propertyId &&
    !scope.allowedPropertyIds.includes(draft.propertyId)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Billing gate — block AI calls for delinquent (past_due / canceled /
  // paused) tenants. Without this a tenant whose card has been declining
  // for a week racks up Anthropic spend the platform absorbs. Agency
  // impersonation bypasses so support can debug AI on a customer's
  // behalf during dunning.
  const billingGate = await checkAiBillingGate(scope.orgId, {
    isImpersonating: scope.isImpersonating,
  });
  if (!billingGate.allowed) {
    return NextResponse.json(aiBillingDeniedResponseBody(billingGate), {
      status: 402,
    });
  }

  // Per-user hourly rate limit (10/hr) — bounds a runaway client / open
  // tab loop from burning the per-org daily quota in minutes.
  const rl = await checkRateLimit(aiCallLimiter, `ai-call:${scope.userId}`);
  if (!rl.allowed) {
    const retry = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return rateLimited(
      "AI rate limit hit (10 calls per hour). Try again soon.",
      retry,
    );
  }

  // Per-org daily AI quota backstop. Auth-gated route, but a single
  // workspace could still spam the editor; this catches that. Fails OPEN
  // on Redis errors. See lib/ai/quota.ts.
  const quota = await checkAiQuota(scope.orgId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "AI quota exceeded — try again tomorrow", code: "ai_quota_exceeded" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // Build the system prompt. Pulls brand voice + cornerstone pages from
  // SiteIntelligence so the assistant stays on-voice.
  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    select: { name: true },
  });
  const intel = await prisma.siteIntelligence.findUnique({
    where: { orgId: scope.orgId },
    select: { brandVoice: true, pages: true },
  });

  type IntelPage = { url?: string; title?: string; markdown?: string };
  const rawPages = Array.isArray(intel?.pages) ? (intel.pages as unknown[]) : [];
  const cornerstone: IntelPage[] = rawPages
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .slice(0, 3)
    .map((p) => ({
      url: typeof p.url === "string" ? p.url : undefined,
      title: typeof p.title === "string" ? p.title : undefined,
      markdown: typeof p.markdown === "string" ? p.markdown : undefined,
    }));

  const aiContext =
    draft.aiContext && typeof draft.aiContext === "object"
      ? (draft.aiContext as Record<string, unknown>)
      : {};
  const targetKeywords = Array.isArray(aiContext.targetKeywords)
    ? (aiContext.targetKeywords as unknown[]).filter(
        (k): k is string => typeof k === "string",
      )
    : draft.targetQuery
      ? [draft.targetQuery]
      : [];

  const lastHtml = parsed.htmlBody ?? "";
  const htmlContext = lastHtml ? lastHtml.slice(-800) : "(empty draft)";

  const systemLines: string[] = [
    `You are the LeaseStack content editor assistant — an expert content strategist for ${org?.name ?? "a real estate operator"}.`,
    `Format being edited: ${draft.format.replace(/_/g, " ")}.`,
    targetKeywords.length > 0
      ? `Target keywords (rank this content for these): ${targetKeywords.join(", ")}.`
      : "No target keywords specified.",
    intel?.brandVoice
      ? `BRAND VOICE NOTES:\n${intel.brandVoice.slice(0, 1500)}`
      : "No brand voice notes on file — keep tone professional and concrete.",
  ];

  if (cornerstone.length > 0) {
    systemLines.push("");
    systemLines.push("REPRESENTATIVE PAGES from this brand's site:");
    for (const p of cornerstone) {
      const head = [p.title, p.url].filter(Boolean).join(" — ");
      const body = (p.markdown ?? "").slice(0, 200).replace(/\s+/g, " ").trim();
      systemLines.push(`- ${head}: ${body}`);
    }
  }

  systemLines.push("");
  systemLines.push("CURRENT DRAFT (last ~800 chars of HTML):");
  systemLines.push(htmlContext);
  systemLines.push("");
  systemLines.push("HOW TO RESPOND:");
  systemLines.push(
    "- For conversational questions ('what should I focus on?', 'how is this looking?'), reply normally in 2-4 sentences.",
  );
  systemLines.push(
    "- When the user asks for a structural change ('rewrite the intro', 'tighten section 3', 'add an FAQ', 'make the title punchier'), do BOTH:",
  );
  systemLines.push(
    "    1. Write 1-2 sentences of human-readable confirmation describing what you changed.",
  );
  systemLines.push(
    "    2. End your reply with a NEW LINE that is EXACTLY this sentinel followed by a JSON object on the SAME line:",
  );
  systemLines.push(
    "       <<APPLY_EDIT>>{\"target\":\"title|body|section|metaDescription\",\"content\":\"...\"}",
  );
  systemLines.push(
    '   target="title" → replace the H1 (content is plain text).',
  );
  systemLines.push(
    '   target="body" → replace the ENTIRE body (content is full HTML with <h1>/<h2>/<p>/<blockquote>).',
  );
  systemLines.push(
    '   target="section" → append a new HTML fragment (content is HTML, e.g. "<h2>Heading</h2><p>...</p>").',
  );
  systemLines.push(
    '   target="metaDescription" → append a <p> note (content is plain text).',
  );
  systemLines.push(
    "- NEVER emit the sentinel unless you actually want the editor to apply a change. Conversational answers must not include it.",
  );
  systemLines.push(
    "- All HTML you emit must use only these tags: h1, h2, h3, p, ul, ol, li, blockquote, strong, em. Block quotes are the AEO quick-answer block — use them sparingly for facts an AI engine should cite.",
  );

  const systemPrompt = systemLines.join("\n");

  // Track the previous chat thread so we can append after the stream
  // completes. We rebuild from the request's messages array (which the
  // client maintains as the source of truth).
  const result = streamText({
    model: anthropic(MODEL_ID),
    system: systemPrompt,
    messages: parsed.messages,
    onFinish: async ({ text }) => {
      try {
        // Persist the updated chat thread. We don't store the sentinel
        // payload in chatThread — that's a side-effect, not transcript.
        const sentinelIdx = text.indexOf("<<APPLY_EDIT>>");
        const visible = sentinelIdx >= 0 ? text.slice(0, sentinelIdx) : text;
        const nextThread = [
          ...parsed.messages.map((m) => ({
            role: m.role,
            content: m.content,
            ts: new Date().toISOString(),
          })),
          {
            role: "assistant" as const,
            content: visible.trim(),
            ts: new Date().toISOString(),
          },
        ];
        await prisma.contentDraft.update({
          where: { id: draft.id },
          data: {
            chatThread: nextThread as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        console.error("[content-chat] persist failed", err);
      }
    },
  });

  return result.toTextStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}
