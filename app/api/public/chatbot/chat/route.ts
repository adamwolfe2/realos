import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { prisma } from "@/lib/db";
import {
  ChatbotConversationStatus,
  LeadSource,
  Prisma,
  TenantStatus,
} from "@prisma/client";
import {
  buildSystemPrompt,
  type ChatbotTenant,
} from "@/lib/chatbot/build-system-prompt";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";
import { notifyLeadCaptured } from "@/lib/chatbot/notify-lead";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { resolvePropertyForChatPage } from "@/lib/chatbot/property-attribution";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";

// POST /api/public/chatbot/chat
//
// Public, CORS-enabled chat endpoint for the embed widget. Slug-routed,
// streams Claude Haiku 4.5 replies, persists the conversation + auto-creates
// a Lead when an email is captured. Mirrors the admin /api/chatbot flow but
// is explicitly cross-origin safe.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const chatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
});

const body = z.object({
  slug: z.string().min(1).max(120),
  sessionId: z.string().uuid(),
  messages: z.array(chatMessage).min(1).max(50),
  pageUrl: z.string().optional(),
});

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const { allowed } = await checkRateLimit(publicApiLimiter, ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": "60" } }
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const parsed = body.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  const { slug, sessionId, messages, pageUrl } = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      tenantSiteConfig: true,
      properties: {
        orderBy: { updatedAt: "desc" },
        include: { listings: { where: { isAvailable: true } } },
      },
    },
  });
  if (!org || org.orgType !== "CLIENT" || !org.moduleChatbot) {
    return NextResponse.json(
      { error: "Chatbot not enabled for this tenant" },
      { status: 403, headers: CORS_HEADERS }
    );
  }
  if (!org.tenantSiteConfig?.chatbotEnabled) {
    return NextResponse.json(
      { error: "Chatbot disabled" },
      { status: 403, headers: CORS_HEADERS }
    );
  }
  if (
    org.status === TenantStatus.CHURNED ||
    org.status === TenantStatus.PAUSED
  ) {
    return NextResponse.json(
      { error: "Chatbot unavailable" },
      { status: 403, headers: CORS_HEADERS }
    );
  }

  const orgId = org.id;
  const systemPrompt = buildSystemPrompt(org as ChatbotTenant);
  const userAgent = req.headers.get("user-agent") ?? undefined;
  // Match the chat's host pageUrl to a specific property when possible.
  // Multi-property tenants used to lose attribution because the previous
  // logic always picked the most-recently-updated property.
  const resolvedPropertyId = resolvePropertyForChatPage(
    pageUrl,
    org.properties.map((p) => ({ id: p.id, slug: p.slug, name: p.name }))
  );

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages,
    onFinish: async ({ text }) => {
      try {
        // Same markdown stripper the client renderer uses, so the
        // persisted transcript matches what the visitor actually saw on
        // screen. Without this, the conversation inbox shows raw "**foo**"
        // while the live chat showed "foo".
        await persistConversation({
          orgId,
          sessionId,
          messages,
          replyText: stripChatbotMarkdown(text),
          pageUrl,
          userAgent,
          ipAddress: ip,
          propertyId: resolvedPropertyId ?? org.properties[0]?.id,
        });
      } catch (err) {
        console.error("[public/chatbot/chat] persistence error:", err);
      }
    },
  });

  return result.toTextStreamResponse({
    headers: { ...CORS_HEADERS, "Cache-Control": "no-store" },
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
  const isLeadCaptured = Boolean(extracted.email);
  const now = new Date();

  const serializedMessages = full.map((m) => ({
    role: m.role,
    content: m.content,
    ts: now.toISOString(),
  })) as unknown as Prisma.InputJsonValue;

  const existing = await prisma.chatbotConversation.findUnique({
    where: { sessionId: args.sessionId },
    select: { id: true, orgId: true, leadId: true, status: true },
  });

  let conversation;
  if (existing) {
    if (existing.orgId !== args.orgId) {
      // Cross-tenant sessionId reuse — refuse silently. The session belongs to
      // a different org. Returning early prevents data corruption; the caller
      // can recover by generating a fresh sessionId on the client.
      return null;
    }
    // Status state machine: once LEAD_CAPTURED, stay LEAD_CAPTURED. The
    // PRE_CHAT path inserts a row with leadId set + status=LEAD_CAPTURED
    // before any messages exist; subsequent /chat calls would otherwise
    // demote it back to ACTIVE because extractLeadCapture finds nothing
    // in the (so-far empty) message history. Preserve the higher state.
    const alreadyCaptured =
      existing.leadId != null ||
      existing.status === ChatbotConversationStatus.LEAD_CAPTURED;
    const nextStatus = alreadyCaptured || isLeadCaptured
      ? ChatbotConversationStatus.LEAD_CAPTURED
      : ChatbotConversationStatus.ACTIVE;
    conversation = await prisma.chatbotConversation.update({
      where: { id: existing.id },
      data: {
        messages: serializedMessages,
        messageCount: full.length,
        lastMessageAt: now,
        status: nextStatus,
        capturedName: extracted.name ?? undefined,
        capturedEmail: extracted.email ?? undefined,
        capturedPhone: extracted.phone ?? undefined,
      },
    });
  } else {
    conversation = await prisma.chatbotConversation.create({
      data: {
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
    });
  }

  if (isLeadCaptured && !conversation.leadId && extracted.email) {
    const lead = await prisma.lead.create({
      data: {
        orgId: args.orgId,
        propertyId: args.propertyId ?? null,
        source: LeadSource.CHATBOT,
        sourceDetail: args.pageUrl ? `chatbot:${args.pageUrl}` : "chatbot",
        firstName: extracted.firstName ?? null,
        lastName: extracted.lastName ?? null,
        email: extracted.email.toLowerCase(),
        phone: extracted.phone ?? null,
        notes: `Captured by chatbot on ${args.pageUrl ?? "site"}`,
      },
    });
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { leadId: lead.id },
    });

    // Fire-and-forget notification. PRE_CHAT flow already seeds a leadId
    // on the conversation before the first message, so the guard above
    // ensures we don't double-send.
    void notifyLeadCaptured({ orgId: args.orgId, leadId: lead.id }).catch(
      (err) => {
        console.warn("[public/chatbot/chat] notify error:", err);
      }
    );
  }
}
