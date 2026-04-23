import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { HandoffButton } from "./handoff-button";
import { ConversationSidebar } from "./conversation-sidebar";
import { humanChatbotStatus } from "@/lib/format";

export const metadata: Metadata = { title: "Conversation" };
export const dynamic = "force-dynamic";

type SerializedMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

// ---------------------------------------------------------------------------
// Conversation detail
//
// Two-column layout: transcript on the left, review sidebar on the right.
// The sidebar holds the flag toggles, a notes field, and visitor/lead cross
// links so the operator can jump to related records without losing place.
// ---------------------------------------------------------------------------

export default async function ConversationDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const scope = await requireScope();
  const { id } = await params;

  const convo = await prisma.chatbotConversation.findFirst({
    where: { id, ...tenantWhere(scope) },
    include: {
      lead: true,
      property: { select: { id: true, name: true } },
      flags: {
        orderBy: { createdAt: "desc" },
        select: { id: true, flag: true, note: true, createdAt: true },
      },
    },
  });
  if (!convo) notFound();

  // Resolve linked visitor (by visitorHash) so the sidebar can link to the
  // visitor profile. Scoped by org to prevent cross-tenant leakage.
  const linkedVisitor = convo.visitorHash
    ? await prisma.visitor.findFirst({
        where: { orgId: scope.orgId, visitorHash: convo.visitorHash },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      })
    : null;

  const messages = (Array.isArray(convo.messages)
    ? (convo.messages as unknown as SerializedMessage[])
    : []) as SerializedMessage[];

  const initialFlags = convo.flags.map((f) => ({
    id: f.id,
    flag: f.flag,
    note: f.note,
    createdAt: f.createdAt.toISOString(),
  }));

  const handoffDisabled =
    convo.status === "HANDED_OFF" || convo.status === "CLOSED";

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <Link
            href="/portal/conversations"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {"\u2190"} All conversations
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-2">
            {convo.capturedName ?? "Anonymous visitor"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {convo.capturedEmail ?? "No email captured"}
            {convo.capturedPhone ? ` \u00b7 ${convo.capturedPhone}` : ""}
          </p>
        </div>
        <HandoffButton
          conversationId={convo.id}
          disabled={handoffDisabled}
        />
      </div>

      {/* Metadata chips row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <MetaChip
          label="Status"
          value={humanChatbotStatus(convo.status)}
        />
        <MetaChip
          label="First seen"
          value={format(convo.createdAt, "MMM d, yyyy p")}
        />
        <MetaChip
          label="Last message"
          value={formatDistanceToNow(convo.lastMessageAt, { addSuffix: true })}
        />
        <MetaChip label="Messages" value={String(convo.messageCount)} />
        {convo.handedOffAt ? (
          <MetaChip
            label="Handoff"
            value={formatDistanceToNow(convo.handedOffAt, { addSuffix: true })}
            tone="warn"
          />
        ) : (
          <MetaChip label="Handoff" value="None" tone="muted" />
        )}
        {convo.pageUrl ? (
          <MetaChip label="Page" value={compactUrl(convo.pageUrl)} />
        ) : null}
        {convo.property ? (
          <MetaChip label="Property" value={convo.property.name} />
        ) : null}
      </div>

      {/* Two-column layout: transcript + sidebar. On mobile sidebar stacks
          below the transcript. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">
              Transcript
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </span>
          </div>
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages on record.
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <MessageBubble key={i} message={m} />
              ))}
            </div>
          )}
        </section>

        <ConversationSidebar
          conversationId={convo.id}
          initialFlags={initialFlags}
          lead={
            convo.lead
              ? {
                  id: convo.lead.id,
                  status: convo.lead.status,
                }
              : null
          }
          visitor={
            linkedVisitor
              ? {
                  id: linkedVisitor.id,
                  displayName:
                    [linkedVisitor.firstName, linkedVisitor.lastName]
                      .filter(Boolean)
                      .join(" ") || linkedVisitor.email || "View profile",
                  status: linkedVisitor.status,
                }
              : null
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local UI helpers
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: SerializedMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] text-sm px-4 py-2.5 rounded-[10px] whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          {isUser ? "Visitor" : "Assistant"}
        </div>
        {message.content}
        {message.ts ? (
          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            {format(new Date(message.ts), "MMM d, p")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "muted";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50 text-amber-900 ring-amber-200"
      : tone === "muted"
        ? "bg-muted text-muted-foreground ring-border"
        : "bg-card text-foreground ring-border";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[6px] px-2 py-1 text-[11px] ring-1 ring-inset ${toneClass}`}
    >
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function compactUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname}${path}`.slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}
