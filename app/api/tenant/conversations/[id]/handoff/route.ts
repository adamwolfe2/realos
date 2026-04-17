import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireScope,
  tenantWhere,
  ForbiddenError,
  auditPayload,
} from "@/lib/tenancy/scope";
import {
  AuditAction,
  ChatbotConversationStatus,
  NoteType,
} from "@prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireScope();
    const { id } = await params;

    const convo = await prisma.chatbotConversation.findFirst({
      where: { id, ...tenantWhere(scope) },
      select: {
        id: true,
        orgId: true,
        status: true,
        capturedName: true,
        capturedEmail: true,
        leadId: true,
      },
    });
    if (!convo) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (
      convo.status === ChatbotConversationStatus.HANDED_OFF ||
      convo.status === ChatbotConversationStatus.CLOSED
    ) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    const now = new Date();
    const updated = await prisma.chatbotConversation.update({
      where: { id },
      data: {
        status: ChatbotConversationStatus.HANDED_OFF,
        handedOffAt: now,
        handoffReason: "Requested from portal",
      },
    });

    await prisma.clientNote.create({
      data: {
        orgId: scope.orgId,
        authorUserId: scope.userId,
        noteType: NoteType.LEAD_INTERACTION,
        body:
          `[conversation:${id}] Handed off chatbot conversation to the team` +
          (convo.capturedEmail ? `, contact ${convo.capturedEmail}` : ""),
      },
    });

    await prisma.auditEvent.create({
      data: auditPayload(scope, {
        action: AuditAction.UPDATE,
        entityType: "ChatbotConversation",
        entityId: id,
        description: `Conversation handed off to team`,
      }),
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
