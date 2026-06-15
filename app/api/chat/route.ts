import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/db";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import {
  ChatbotConversationStatus,
  LeadSource,
  Prisma,
} from "@prisma/client";
import { buildSystemPrompt, type ChatbotTenant } from "@/lib/chatbot/build-system-prompt";
import { parseFloorPlans } from "@/lib/properties/kb-completeness";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";
import { requireMatchingOrigin } from "@/lib/tenancy/origin-guard";
import { notifyLeadCaptured } from "@/lib/notifications/lead-notify";
import { LeadNotifyChannel } from "@prisma/client";
import { notifyChatbotLeadCaptured } from "@/lib/notifications/create";

export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const body = z.object({
  orgId: z.string().min(1),
  sessionId: z.string().uuid(),
  messages: z.array(chatMessage).min(1).max(50),
  pageUrl: z.string().optional(),
});

// POST /api/chatbot
// Multi-tenant chatbot endpoint. Streams Claude's reply back to the widget
// and persists the full conversation + captured lead in the background.
//
// TODO(v2): move DB persistence off the main request path onto a QStash
// queue so a slow Postgres write doesn't stall the stream.
export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicApiLimiter, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

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
      { status: 400 }
    );
  }
  const { orgId, sessionId, messages, pageUrl } = parsed.data;

  // Verify the request's Origin header resolves to the claimed orgId. Without
  // this, anyone on the internet could spoof another tenant's orgId, drain
  // their Anthropic budget, and pollute their lead pipeline.
  const guard = await requireMatchingOrigin(req, orgId);
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      tenantSiteConfig: true,
      properties: {
        orderBy: { updatedAt: "desc" },
        include: { listings: { where: { isAvailable: true } } },
      },
    },
  });
  if (!org || org.orgType !== "CLIENT") {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }
  if (!org.moduleChatbot) {
    return NextResponse.json(
      { error: "Chatbot module is not enabled for this tenant." },
      { status: 403 }
    );
  }

  // Per-org daily AI quota backstop. See lib/ai/quota.ts — set well above
  // legitimate volume so this only catches a runaway tenant or bad actor,
  // not real customers. Fails OPEN on Redis errors.
  const quota = await checkAiQuota(orgId);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Chatbot temporarily unavailable", code: "ai_quota_exceeded" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  // Ground the prompt with the default property's structured knowledge base
  // (slice "Property Knowledge Base" S1). This legacy endpoint serves the
  // org's first property; scope the KB lookup by orgId via the relation for
  // tenant isolation. Best-effort — a miss yields null and the bot deflects.
  const defaultProperty = org.properties[0] ?? null;
  const kbRow = defaultProperty
    ? await prisma.propertyKnowledgeBase
        .findFirst({
          // Double-scope by KB orgId AND property orgId so a stale row (e.g.
          // after a cross-org property reassignment) never injects another
          // tenant's facts into the prompt. (Codex tenant-isolation.)
          where: { propertyId: defaultProperty.id, orgId, property: { orgId } },
        })
        .catch(() => null)
    : null;
  const knowledgeBase = kbRow
    ? { ...kbRow, floorPlans: parseFloorPlans(kbRow.floorPlans) }
    : null;

  const systemPrompt = buildSystemPrompt(org as ChatbotTenant, undefined, {
    property: defaultProperty,
    knowledgeBase,
  });
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages,
    onFinish: async ({ text }) => {
      try {
        await persistConversation({
          orgId,
          sessionId,
          messages,
          // Strip markdown server-side so the inbox transcript matches
          // what the visitor saw rendered in the widget. See
          // lib/chatbot/strip-markdown.ts for the rules.
          replyText: stripChatbotMarkdown(text),
          pageUrl,
          userAgent,
          ipAddress: ip,
          propertyId: org.properties[0]?.id,
        });
      } catch (err) {
        console.error("[chatbot] persistence error:", err);
      }
    },
  });

  return result.toTextStreamResponse({
    headers: { "Cache-Control": "no-store" },
  });
}

async function persistConversation(args: {
  orgId: string;
  sessionId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  replyText: string;
  pageUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  propertyId?: string | null;
}) {
  const full = [
    ...args.messages,
    { role: "assistant" as const, content: args.replyText },
  ];
  const extracted = extractLeadCapture(full);
  const isLeadCaptured = !!extracted.email;

  // DECISION: store messages as a JSON array of { role, content, ts } on the
  // ChatbotConversation row. The PRD schema allows `messages: Json`, this
  // keeps writes atomic without a dedicated Message table.
  const serializedMessages = full.map((m) => ({
    role: m.role,
    content: m.content,
    ts: new Date().toISOString(),
  })) as unknown as Prisma.InputJsonValue;

  const conversation = await prisma.chatbotConversation.upsert({
    where: { sessionId: args.sessionId },
    create: {
      orgId: args.orgId,
      sessionId: args.sessionId,
      messages: serializedMessages,
      messageCount: full.length,
      status: isLeadCaptured
        ? ChatbotConversationStatus.LEAD_CAPTURED
        : ChatbotConversationStatus.ACTIVE,
      capturedName: extracted.name ?? null,
      capturedEmail: extracted.email ?? null,
      capturedPhone: extracted.phone ?? null,
      propertyId: args.propertyId ?? null,
      pageUrl: args.pageUrl ?? null,
      userAgent: args.userAgent ?? null,
      ipAddress: args.ipAddress ?? null,
    },
    update: {
      messages: serializedMessages,
      messageCount: full.length,
      lastMessageAt: new Date(),
      status: isLeadCaptured
        ? ChatbotConversationStatus.LEAD_CAPTURED
        : ChatbotConversationStatus.ACTIVE,
      capturedName: extracted.name ?? undefined,
      capturedEmail: extracted.email ?? undefined,
      capturedPhone: extracted.phone ?? undefined,
    },
  });

  // First-time lead capture: create the Lead row and link it.
  if (isLeadCaptured && !conversation.leadId && extracted.email) {
    const lead = await prisma.lead.create({
      data: {
        orgId: args.orgId,
        propertyId: args.propertyId ?? null,
        source: LeadSource.CHATBOT,
        sourceDetail: args.pageUrl ? `chatbot:${args.pageUrl}` : "chatbot",
        firstName: extracted.firstName ?? null,
        lastName: extracted.lastName ?? null,
        email: extracted.email,
        phone: extracted.phone ?? null,
        notes: `Captured by chatbot on ${args.pageUrl ?? "site"}`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { leadId: lead.id },
    });

    // Operator notifications. Mirrors the PRE_CHAT path in
    // /api/public/chatbot/lead — without this, mid-conversation lead
    // capture silently created Lead rows but never lit up the in-app
    // bell, Slack, or Resend operator email. We AWAIT inside onFinish:
    // the stream is already closed by the SDK so the user-perceived
    // latency is unaffected, but the lambda stays alive long enough
    // for these to complete.
    const fullName =
      [extracted.firstName, extracted.lastName].filter(Boolean).join(" ") ||
      null;
    try {
      await Promise.allSettled([
        notifyLeadCaptured({
          orgId: args.orgId,
          leadId: lead.id,
          propertyId: args.propertyId ?? null,
          channel: LeadNotifyChannel.CHATBOT,
          lead: {
            name: fullName,
            email: extracted.email,
            phone: extracted.phone ?? null,
            sourceLabel: args.pageUrl
              ? `Chatbot on ${args.pageUrl}`
              : "Chatbot",
          },
          conversationId: conversation.id,
        }),
        notifyChatbotLeadCaptured({
          id: args.sessionId,
          orgId: args.orgId,
          capturedName: fullName,
          capturedEmail: extracted.email,
          leadId: lead.id,
        }),
      ]);
    } catch (err) {
      console.warn("[chatbot] lead notification fanout failed:", err);
    }
  }
}
