import "server-only";
import { LeadSource } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// One Lead per (orgId, email) for chatbot captures.
//
// The pre-chat form (/api/public/chatbot/lead) and the mid-conversation
// capture in the chat routes run on different sessionIds, so the
// conversation-level `!conversation.leadId` guard never saw the pre-chat
// lead. Every prospect who filled the form and then typed their email in
// chat became two Lead rows (SG: 104 chatbot leads, 81 distinct emails as
// of 2026-09-29). Match on email first, case-insensitive, same as the
// pre-chat path.
// ---------------------------------------------------------------------------

export async function findOrCreateChatbotLead(args: {
  orgId: string;
  propertyId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  pageUrl?: string | null;
}): Promise<{ id: string; created: boolean }> {
  const email = args.email.trim().toLowerCase();

  const existing = await prisma.lead.findFirst({
    where: { orgId: args.orgId, email: { equals: email, mode: "insensitive" } },
    select: { id: true, phone: true, firstName: true, lastName: true },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        lastActivityAt: new Date(),
        // Fill gaps only; never overwrite what the prospect already gave us.
        phone: existing.phone ?? args.phone,
        firstName: existing.firstName ?? args.firstName,
        lastName: existing.lastName ?? args.lastName,
      },
    });
    return { id: existing.id, created: false };
  }

  const lead = await prisma.lead.create({
    data: {
      orgId: args.orgId,
      propertyId: args.propertyId,
      source: LeadSource.CHATBOT,
      sourceDetail: args.pageUrl ? `chatbot:${args.pageUrl}` : "chatbot",
      firstName: args.firstName,
      lastName: args.lastName,
      email,
      phone: args.phone,
      notes: `Captured by chatbot on ${args.pageUrl ?? "site"}`,
    },
    select: { id: true },
  });
  return { id: lead.id, created: true };
}
