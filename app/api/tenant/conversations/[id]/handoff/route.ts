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
import { sendProspectProfileForConversation } from "@/lib/chatbot/send-prospect-profile";

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

    // Norman bug #3: handoff must actually notify the team, not just flip
    // the status. Fire a chatbot_lead notification so it lands in the
    // org-wide inbox at /portal/notifications. The bell + unread-count
    // pick it up automatically. Fire-and-forget — never blocks the API
    // response on the notification write.
    void prisma.notification
      .create({
        data: {
          orgId: scope.orgId,
          kind: "chatbot_lead",
          title: convo.capturedName
            ? `Chatbot conversation handed off — ${convo.capturedName}`
            : "Chatbot conversation handed off",
          body:
            (convo.capturedEmail ? `Contact: ${convo.capturedEmail}. ` : "") +
            "Pick this up from /portal/conversations.",
          entityType: "ChatbotConversation",
          entityId: id,
          href: `/portal/conversations/${id}`,
        },
      })
      .catch((e) => {
        // Notification failure must not break the handoff itself.
        console.error("[handoff] notification create failed", e);
      });

    // Adam 2026-06-03: handoff should ALSO immediately fire the rich
    // prospect-profile digest email to the agency's notifyLeadEmail —
    // the bell + portal page are great for operators sitting in the
    // dashboard, but the offsite team (Jessica @ TC etc) need the
    // profile in their inbox right now, not 5 minutes later when the
    // cron next fires. force: true overrides the 30-min debounce so a
    // re-handoff still lands fresh data.
    void sendProspectProfileForConversation({
      conversationId: id,
      force: true,
      reason: "handoff",
    }).catch((err) => {
      console.error("[handoff] prospect-profile email failed", err);
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
