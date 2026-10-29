import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { ChatbotCaptureMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireScope, ForbiddenError } from "@/lib/tenancy/scope";
import { buildSystemPrompt, type ChatbotTenant } from "@/lib/chatbot/build-system-prompt";
import { resolveChatbotConfig } from "@/lib/chatbot/resolve-config";
import { parseFloorPlans } from "@/lib/properties/kb-completeness";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { clientWriteLimiter, checkRateLimit } from "@/lib/rate-limit";
import { withSpendCap, secondsUntilCapReset } from "@/lib/cost-tracker/cap";
import { logChatUsage } from "@/lib/chatbot/log-chat-usage";
import { exceedsChatInputBudget, MAX_CHAT_OUTPUT_TOKENS } from "@/lib/chatbot/input-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// POST /api/portal/chatbot/preview-chat — the operator's test chat on
// /portal/chatbot. Same prompt as the public widget, built from the UNSAVED
// draft in the editor, so "do you allow dogs?" answers from what they just
// typed. Signed-in and org-scoped; nothing is persisted (no conversation,
// no lead, no notification). Spend is capped and logged like public chat.
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5-20251001";

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
  draft: z.object({
    personaName: z.string().max(100).optional(),
    greeting: z.string().max(500).optional(),
    knowledgeBase: z.string().max(5000).optional(),
    captureMode: z.nativeEnum(ChatbotCaptureMode).optional(),
  }),
});

export async function POST(req: NextRequest) {
  let scope;
  try {
    scope = await requireScope();
  } catch (err) {
    if (err instanceof ForbiddenError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { allowed } = await checkRateLimit(clientWriteLimiter, `chatbot-preview:${scope.orgId}`, {
    softFallback: { requests: 20, windowMs: 60_000 },
  });
  if (!allowed) return NextResponse.json({ error: "Too many test messages. Try again in a minute." }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { messages, draft } = parsed.data;
  if (exceedsChatInputBudget(messages)) return NextResponse.json({ error: "Conversation too long" }, { status: 413 });

  const org = await prisma.organization.findUnique({
    where: { id: scope.orgId },
    include: {
      tenantSiteConfig: true,
      properties: { orderBy: { updatedAt: "desc" }, include: { listings: { where: { isAvailable: true } } } },
    },
  });
  if (!org) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // Org-level editor: single-property orgs get that property's facts, a
  // multi-property org is answered at org level, same as an unscoped embed.
  const property = org.properties.length === 1 ? org.properties[0] : null;
  const resolved = await resolveChatbotConfig(org.id, property?.id ?? null);
  const config = {
    ...resolved,
    chatbotPersonaName: draft.personaName?.trim() || resolved.chatbotPersonaName,
    chatbotGreeting: draft.greeting?.trim() || resolved.chatbotGreeting,
    chatbotKnowledgeBase: draft.knowledgeBase ?? resolved.chatbotKnowledgeBase,
    chatbotCaptureMode: draft.captureMode ?? resolved.chatbotCaptureMode,
  };
  const kbRow = property
    ? await prisma.propertyKnowledgeBase.findFirst({ where: { propertyId: property.id, orgId: org.id, property: { orgId: org.id } } })
    : null;

  const system = buildSystemPrompt(org as ChatbotTenant, undefined, {
    property,
    config,
    knowledgeBase: kbRow ? { ...kbRow, floorPlans: parseFloorPlans(kbRow.floorPlans) } : null,
    userTurnCount: messages.filter((m) => m.role === "user").length,
  });

  const startedAt = Date.now();
  try {
    const capped = await withSpendCap({ provider: "anthropic", endpoint: "chatbot.preview-chat", orgId: org.id }, () =>
      generateText({ model: anthropic(MODEL), system, messages, maxOutputTokens: MAX_CHAT_OUTPUT_TOKENS }),
    );
    if (capped.status === "skipped_cap") {
      return NextResponse.json(
        { error: "Test chat is paused: AI spend cap reached." },
        { status: 503, headers: { "Retry-After": String(secondsUntilCapReset()) } },
      );
    }
    await logChatUsage({ endpoint: "chatbot.preview-chat", model: MODEL, orgId: org.id, propertyId: property?.id ?? null, startedAt, usage: capped.data.totalUsage });
    return NextResponse.json({ text: stripChatbotMarkdown(capped.data.text) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[portal/chatbot/preview-chat] generation failed", { orgId: org.id, err });
    return NextResponse.json({ error: "The test reply failed. Try again." }, { status: 502 });
  }
}
