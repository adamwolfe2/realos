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
import {
  ChatbotConversationStatus,
  LeadSource,
  Prisma,
} from "@prisma/client";
import { buildSystemPrompt, type ChatbotTenant } from "@/lib/chatbot/build-system-prompt";
import { extractLeadCapture } from "@/lib/chatbot/extract-lead";

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

  const systemPrompt = buildSystemPrompt(org as ChatbotTenant);
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
          replyText: text,
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
  }
}
