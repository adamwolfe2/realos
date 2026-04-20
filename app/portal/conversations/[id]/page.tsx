import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { HandoffButton } from "./handoff-button";

export const metadata: Metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

type SerializedMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

export default async function ConversationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const convo = await prisma.chatbotConversation.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: { lead: true, property: { select: { id: true, name: true } } },
  });
  if (!convo) notFound();

  const messages = (Array.isArray(convo.messages)
    ? (convo.messages as unknown as SerializedMessage[])
    : []) as SerializedMessage[];

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/portal/conversations"
            className="text-xs opacity-60 hover:opacity-100"
          >
            ← Conversations
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">
            {convo.capturedName ?? "Anonymous visitor"}
          </h1>
          <p className="text-sm opacity-70 mt-1">
            {convo.capturedEmail ?? "No email captured"}
            {convo.capturedPhone ? ` · ${convo.capturedPhone}` : ""}
          </p>
          <p className="text-xs opacity-60 mt-1">
            {convo.messageCount} messages · {convo.status}
            {convo.pageUrl ? ` · ${convo.pageUrl}` : ""}
          </p>
        </div>
        <HandoffButton
          conversationId={convo.id}
          disabled={
            convo.status === "HANDED_OFF" || convo.status === "CLOSED"
          }
        />
      </header>

      {convo.lead ? (
        <div className="border rounded-md p-4 bg-emerald-50 border-emerald-200 text-sm flex items-baseline justify-between gap-3">
          <span>
            Lead captured, status{" "}
            <span className="font-semibold">{convo.lead.status}</span>
          </span>
          <Link
            href={`/portal/leads/${convo.lead.id}`}
            className="text-xs underline"
          >
            Open lead →
          </Link>
        </div>
      ) : null}

      <section className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm opacity-60">No messages on record.</p>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] text-sm px-4 py-2 rounded-2xl whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground hover:bg-primary-dark transition-colors"
                    : "bg-muted"
                }`}
              >
                {m.content}
                {m.ts ? (
                  <div className="text-[10px] opacity-60 mt-1">
                    {new Date(m.ts).toLocaleString()}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
