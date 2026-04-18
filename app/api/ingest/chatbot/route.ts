import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import {
  ChatbotConversationStatus,
  LeadSource,
  LeadStatus,
  Prisma,
} from "@prisma/client";
import { guardIngest } from "@/lib/api-keys/ingest-shared";
import { notifyLeadCaptured } from "@/lib/chatbot/notify-lead";

// POST /api/ingest/chatbot
//
// Generic chatbot conversation ingestion. External chat vendors (Drift,
// Intercom, custom widgets) can push message turns here. We upsert the
// ChatbotConversation by sessionId, merge messages rather than overwriting,
// and opportunistically create a Lead if an email is supplied.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
  ts: z.string().optional(),
});

const schema = z.object({
  sessionId: z.string().trim().min(1).max(200).optional(),
  firstName: z.string().trim().max(100).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  messages: z.array(messageSchema).min(1).max(200),
  pageUrl: z.string().trim().max(2000).optional(),
});

type PersistedMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
};

function parseExistingMessages(raw: unknown): PersistedMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Partial<PersistedMessage>;
    if (
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
    ) {
      out.push({
        role: m.role,
        content: m.content,
        ts: typeof m.ts === "string" ? m.ts : new Date().toISOString(),
      });
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const gate = await guardIngest(req, "ingest:chatbot");
  if (!gate.ok) return gate.response;
  const { orgId } = gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const sessionId = data.sessionId ?? crypto.randomUUID();
  const now = new Date();
  const email = data.email ? data.email.toLowerCase() : null;

  const incomingMessages: PersistedMessage[] = data.messages.map((m) => ({
    role: m.role,
    content: m.content,
    ts: m.ts && !Number.isNaN(Date.parse(m.ts)) ? m.ts : now.toISOString(),
  }));

  const existing = await prisma.chatbotConversation.findUnique({
    where: { sessionId },
    select: {
      id: true,
      orgId: true,
      leadId: true,
      messages: true,
      capturedName: true,
      capturedEmail: true,
      capturedPhone: true,
    },
  });

  // Enforce tenancy: a sessionId is globally unique, so a foreign tenant
  // cannot steal it, but we still refuse to merge cross-tenant.
  if (existing && existing.orgId !== orgId) {
    return NextResponse.json(
      { error: "Session belongs to another tenant" },
      { status: 409 }
    );
  }

  const mergedMessages: PersistedMessage[] = [
    ...parseExistingMessages(existing?.messages ?? []),
    ...incomingMessages,
  ];

  const isLeadCaptured = Boolean(email);
  const status = isLeadCaptured
    ? ChatbotConversationStatus.LEAD_CAPTURED
    : ChatbotConversationStatus.ACTIVE;

  const serialized = mergedMessages as unknown as Prisma.InputJsonValue;

  const conversation = existing
    ? await prisma.chatbotConversation.update({
        where: { id: existing.id },
        data: {
          messages: serialized,
          messageCount: mergedMessages.length,
          lastMessageAt: now,
          status,
          capturedName: data.firstName ?? existing.capturedName ?? undefined,
          capturedEmail: email ?? existing.capturedEmail ?? undefined,
          capturedPhone: data.phone ?? existing.capturedPhone ?? undefined,
          pageUrl: data.pageUrl ?? undefined,
        },
        select: { id: true, leadId: true },
      })
    : await prisma.chatbotConversation.create({
        data: {
          orgId,
          sessionId,
          messages: serialized,
          messageCount: mergedMessages.length,
          status,
          capturedName: data.firstName ?? null,
          capturedEmail: email,
          capturedPhone: data.phone ?? null,
          pageUrl: data.pageUrl ?? null,
        },
        select: { id: true, leadId: true },
      });

  // Opportunistically create/link a lead when an email shows up.
  if (email && !conversation.leadId) {
    const existingLead = await prisma.lead.findFirst({
      where: { orgId, email },
      select: { id: true },
    });

    const leadId = existingLead
      ? existingLead.id
      : (
          await prisma.lead.create({
            data: {
              orgId,
              email,
              firstName: data.firstName ?? null,
              phone: data.phone ?? null,
              source: LeadSource.CHATBOT,
              sourceDetail: data.pageUrl
                ? `chatbot:${data.pageUrl}`
                : "chatbot",
              status: LeadStatus.NEW,
              notes: `Captured by chatbot ingestion on ${
                data.pageUrl ?? "site"
              }`,
            },
            select: { id: true },
          })
        ).id;

    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { leadId },
    });

    if (!existingLead) {
      void notifyLeadCaptured({ orgId, leadId }).catch((err) => {
        console.warn("[ingest/chatbot] notify error", err);
      });
    }
  }

  return NextResponse.json(
    { ok: true, id: conversation.id, sessionId },
    { status: existing ? 200 : 201 }
  );
}
