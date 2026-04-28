import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import { AuditAction, EngagementStatus } from "@prisma/client";
import {
  clientWriteLimiter,
  checkRateLimit,
} from "@/lib/rate-limit";

// POST /api/tenant/visitors/[visitorId]/engage
//
// Operator pushes a contextual message into a live visitor's chatbot widget.
// The widget polls /api/public/chatbot/inbox?sessionId=... and renders any
// PENDING engagements as assistant turns. We persist the row immediately and
// return 202 — delivery is best-effort and only confirmed once the widget
// reads it.

export const runtime = "nodejs";

const body = z.object({
  message: z.string().min(1).max(2000),
  // Cross-tenant security is enforced by the ChatbotConversation DB lookup
  // below, not by sessionId format.
  sessionId: z.string().min(1).max(200),
  openWidget: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ visitorId: string }> }
) {
  try {
    const scope = await requireScope();
    const { visitorId } = await params;

    const { allowed } = await checkRateLimit(
      clientWriteLimiter,
      `engage:${scope.userId}`
    );
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

    // The dynamic segment is historically a Visitor.id, but the operator UI
    // can also engage at the conversation level (sessionId is the only thing
    // the widget actually knows). We accept either, and validate that the
    // sessionId is bound to a ChatbotConversation in this org. That is the
    // real cross-tenant guard — a stolen visitorId from another org cannot
    // resolve to a session that org owns.
    const [visitor, convo] = await Promise.all([
      prisma.visitor.findFirst({
        where: { id: visitorId, ...tenantWhere(scope) },
        select: { id: true },
      }),
      prisma.chatbotConversation.findFirst({
        where: {
          sessionId: parsed.data.sessionId,
          ...tenantWhere(scope),
        },
        select: { id: true },
      }),
    ]);

    if (!visitor && !convo) {
      return NextResponse.json(
        { error: "Visitor or session not found in this org" },
        { status: 404 }
      );
    }

    const engagement = await prisma.chatbotEngagement.create({
      data: {
        orgId: scope.orgId,
        visitorId: visitor?.id ?? null,
        sessionId: parsed.data.sessionId,
        triggeredById: scope.clerkUserId,
        message: parsed.data.message,
        openWidget: parsed.data.openWidget,
        status: EngagementStatus.PENDING,
      },
      select: { id: true },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.CREATE,
        entityType: "ChatbotEngagement",
        entityId: engagement.id,
        description: visitor
          ? `Operator engaged visitor ${visitor.id} via chatbot`
          : `Operator engaged chat session ${parsed.data.sessionId} via chatbot`,
      }),
    });

    return NextResponse.json(
      { ok: true, engagementId: engagement.id },
      { status: 202 }
    );
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[tenant/visitors/engage] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
