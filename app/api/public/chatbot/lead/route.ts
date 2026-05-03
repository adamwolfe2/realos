import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  ChatbotConversationStatus,
  LeadSource,
  LeadStatus,
  Prisma,
} from "@prisma/client";
import {
  publicApiLimiter,
  checkRateLimit,
  getIp,
} from "@/lib/rate-limit";
import { notifyLeadCaptured } from "@/lib/chatbot/notify-lead";
import { notifyChatbotLeadCaptured } from "@/lib/notifications/create";
import { resolvePropertyForChatPage } from "@/lib/chatbot/property-attribution";

// POST /api/public/chatbot/lead
//
// Pre-chat lead capture endpoint. Called by the embed widget BEFORE the
// first chat message when `chatbotCaptureMode === PRE_CHAT`. Creates (or
// reuses) a Lead, mints a fresh sessionId, seeds an empty
// ChatbotConversation linked to that Lead, and fires the operator
// notification email. Mirrors the CORS / validation / rate-limit posture
// of /api/public/chatbot/chat.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

const body = z.object({
  slug: z.string().min(1).max(120),
  firstName: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((s) => s.replace(/\s+/g, " ")),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  pageUrl: z.string().max(1000).optional(),
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
  const { slug, firstName, email, phone, pageUrl } = parsed.data;

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      tenantSiteConfig: { select: { chatbotEnabled: true } },
      // Pull all properties so we can match the chat's pageUrl to the
      // right one. The audit caught chatbot leads being attributed to
      // the wrong (or no) property because the previous query was
      // take: 1 — multi-property orgs always lost attribution.
      properties: {
        select: { id: true, slug: true, name: true },
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

  const orgId = org.id;
  // Resolve the chat's host page → property. Audit BUG-08 found chatbot
  // leads displaying property "—" because we were always attributing to
  // the most-recently-updated property regardless of where the chat
  // actually happened. Now we match against the URL when possible and
  // only fall back to the first property when no match is found AND
  // there's exactly one property (single-property tenants).
  const propertyId = resolvePropertyForChatPage(pageUrl, org.properties);
  const userAgent = req.headers.get("user-agent") ?? undefined;
  const sessionId = crypto.randomUUID();

  // Split firstName on whitespace. Anything after the first token becomes
  // lastName. Keeps existing data pattern used by extract-lead consistent.
  const nameParts = firstName.split(" ");
  const first = nameParts[0];
  const last =
    nameParts.length > 1 ? nameParts.slice(1).join(" ").trim() : null;

  try {
    // Upsert Lead keyed by (orgId, email). Prisma has no compound unique on
    // (orgId, email), so we handle the upsert manually.
    const existing = await prisma.lead.findFirst({
      where: { orgId, email },
      select: { id: true, phone: true },
    });

    const notesLine = `Captured by chatbot on ${pageUrl ?? "site"}`;

    let leadId: string;
    if (existing) {
      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: new Date(),
          phone: existing.phone ?? phone ?? null,
        },
        select: { id: true },
      });
      leadId = updated.id;
    } else {
      const created = await prisma.lead.create({
        data: {
          orgId,
          propertyId,
          source: LeadSource.CHATBOT,
          sourceDetail: "chatbot:pre_chat",
          status: LeadStatus.NEW,
          firstName: first,
          lastName: last,
          email,
          phone: phone ?? null,
          notes: notesLine,
        },
        select: { id: true },
      });
      leadId = created.id;
    }

    const now = new Date();
    const emptyMessages: Prisma.InputJsonValue =
      [] as unknown as Prisma.InputJsonValue;

    await prisma.chatbotConversation.create({
      data: {
        orgId,
        sessionId,
        messages: emptyMessages,
        messageCount: 0,
        status: ChatbotConversationStatus.ACTIVE,
        capturedName: last ? `${first} ${last}` : first,
        capturedEmail: email,
        capturedPhone: phone ?? null,
        propertyId,
        pageUrl: pageUrl ?? null,
        userAgent: userAgent ?? null,
        ipAddress: ip,
        leadId,
        lastMessageAt: now,
      },
    });

    // Fire-and-forget notifications. Never block the response.
    void notifyLeadCaptured({ orgId, leadId }).catch((err) => {
      console.warn("[public/chatbot/lead] notify error:", err);
    });

    void notifyChatbotLeadCaptured({
      id: sessionId,
      orgId,
      capturedName: last ? `${first} ${last}` : first,
      capturedEmail: email,
      leadId,
    }).catch(() => {});

    return NextResponse.json(
      { sessionId, leadId },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error("[public/chatbot/lead] create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// Property attribution helper extracted to lib/chatbot/property-attribution.ts
// so the /chat route uses the same logic. See JSDoc there for resolution
// strategy.
