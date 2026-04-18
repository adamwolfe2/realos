import "server-only";
import { prisma } from "@/lib/db";
import { notifyTenantOfLeadEmail } from "@/lib/email/lead-emails";
import { APP_URL } from "@/lib/email/shared";

// ---------------------------------------------------------------------------
// notifyLeadCaptured -- fire a Resend notification to the operator's primary
// contact (fallback: AGENCY_ADMIN_EMAIL) whenever a Lead is created by the
// public chatbot surface. Callers should treat this as fire-and-forget.
// If Resend is unconfigured the email helper short-circuits with a non-throw
// SendResult; this function logs and returns rather than throwing so that
// lead creation never depends on email delivery.
// ---------------------------------------------------------------------------

type ConversationMessage = { role: string; content: string };

function conversationSnippet(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const lines: string[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const msg = raw as Partial<ConversationMessage>;
    const role = typeof msg.role === "string" ? msg.role : "";
    const content = typeof msg.content === "string" ? msg.content : "";
    if (!content) continue;
    const label =
      role === "assistant" ? "Bot" : role === "user" ? "Visitor" : role;
    lines.push(`${label}: ${content}`);
  }
  if (lines.length === 0) return null;
  const joined = lines.join("\n");
  return joined.length > 500 ? joined.slice(0, 500) + "..." : joined;
}

export async function notifyLeadCaptured(args: {
  orgId: string;
  leadId: string;
}): Promise<void> {
  try {
    const [org, lead] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: args.orgId },
        select: {
          id: true,
          name: true,
          shortName: true,
          primaryContactEmail: true,
        },
      }),
      prisma.lead.findUnique({
        where: { id: args.leadId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          sourceDetail: true,
          preferredUnitType: true,
          notes: true,
        },
      }),
    ]);

    if (!org || !lead) {
      console.warn(
        "[notify-lead] missing org or lead",
        args.orgId,
        args.leadId
      );
      return;
    }

    const toEmail =
      org.primaryContactEmail ?? process.env.AGENCY_ADMIN_EMAIL ?? null;

    if (!toEmail) {
      console.warn(
        "[notify-lead] no recipient: org has no primaryContactEmail and AGENCY_ADMIN_EMAIL is unset"
      );
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      console.warn(
        "[notify-lead] RESEND_API_KEY not configured, skipping notification"
      );
      return;
    }

    const conversation = await prisma.chatbotConversation.findFirst({
      where: { leadId: lead.id },
      orderBy: { lastMessageAt: "desc" },
      select: { messages: true, pageUrl: true },
    });

    const snippet = conversation
      ? conversationSnippet(conversation.messages)
      : null;

    const notesWithSnippet =
      [
        lead.notes ?? null,
        snippet ? `--- Conversation ---\n${snippet}` : null,
        conversation?.pageUrl ? `Page: ${conversation.pageUrl}` : null,
      ]
        .filter(Boolean)
        .join("\n\n") || null;

    const result = await notifyTenantOfLeadEmail({
      to: toEmail,
      orgName: org.shortName ?? org.name,
      leadId: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      sourceDetail: lead.sourceDetail,
      preferredUnitType: lead.preferredUnitType,
      notes: notesWithSnippet,
      appUrl: APP_URL,
    });

    if (!result.ok) {
      console.warn(
        "[notify-lead] Resend send failed:",
        result.error ?? "unknown"
      );
    }
  } catch (err) {
    console.warn("[notify-lead] unexpected error:", err);
  }
}
