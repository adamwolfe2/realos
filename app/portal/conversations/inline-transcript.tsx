import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { humanChatbotStatus } from "@/lib/format";
import { FlagPill, isFlagType, FLAG_TYPES, type FlagType } from "@/components/portal/conversations/flag-pill";
import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// InlineTranscript
//
// Server component rendered in the right pane of the conversations inbox.
// Shows the full transcript + capture metadata for the conversation
// currently selected via ?c=<id>. Keep this slim — flag toggles and notes
// stay on the dedicated /portal/conversations/[id] page (linked via the
// "Open in full view" button).
//
// Returns null when no ID is provided so the parent can render its own
// empty state.
// ---------------------------------------------------------------------------

type SerializedMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
};

export async function InlineTranscript({
  conversationId,
}: {
  conversationId: string;
}) {
  const scope = await requireScope();

  const convo = await prisma.chatbotConversation.findFirst({
    where: { id: conversationId, ...tenantWhere(scope) },
    include: {
      property: { select: { id: true, name: true } },
      lead: { select: { id: true, status: true } },
      flags: {
        select: { id: true, flag: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!convo) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-10 text-center">
        <MessageSquare className="h-7 w-7 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-foreground">
          Conversation not found
        </p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          This conversation may have been deleted or belongs to a different
          property than the one currently in view.
        </p>
      </div>
    );
  }

  const messages = (Array.isArray(convo.messages)
    ? (convo.messages as unknown as SerializedMessage[])
    : []) as SerializedMessage[];

  const flagSet = new Set<FlagType>();
  for (const f of convo.flags) {
    if (isFlagType(f.flag)) flagSet.add(f.flag);
  }
  const uniqueFlags: FlagType[] = FLAG_TYPES.filter((f) => flagSet.has(f));

  const displayName = convo.capturedName ?? "Anonymous visitor";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row — identity + open-detail link */}
      <header className="px-5 py-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {displayName}
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {humanChatbotStatus(convo.status)}
            </span>
            {convo.lead ? (
              <Link
                href={`/portal/leads/${convo.lead.id}`}
                className="text-[10px] uppercase tracking-widest font-semibold text-primary hover:underline"
              >
                Lead
              </Link>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {convo.capturedEmail ?? "No email captured"}
            {convo.capturedPhone ? ` · ${convo.capturedPhone}` : ""}
            {convo.property ? ` · ${convo.property.name}` : ""}
          </p>
        </div>
        <Link
          href={`/portal/conversations/${convo.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors shrink-0"
        >
          Open full view
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Meta strip — chips along the top of the scroll pane */}
      <div className="px-5 py-2 border-b border-border bg-secondary/30 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground shrink-0">
        <span>
          <span className="uppercase tracking-widest font-semibold mr-1">
            First seen
          </span>
          {format(convo.createdAt, "MMM d, p")}
        </span>
        <span>
          <span className="uppercase tracking-widest font-semibold mr-1">
            Last
          </span>
          {formatDistanceToNow(convo.lastMessageAt, { addSuffix: true })}
        </span>
        <span>
          <span className="uppercase tracking-widest font-semibold mr-1">
            Messages
          </span>
          <span className="tabular-nums text-foreground">
            {convo.messageCount}
          </span>
        </span>
        {convo.handedOffAt ? (
          <span className="text-amber-700">
            <span className="uppercase tracking-widest font-semibold mr-1">
              Handoff
            </span>
            {formatDistanceToNow(convo.handedOffAt, { addSuffix: true })}
          </span>
        ) : null}
        {uniqueFlags.length > 0 ? (
          <div className="flex items-center gap-1 ml-auto">
            {uniqueFlags.slice(0, 4).map((f) => (
              <FlagPill key={f} flag={f} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Scrollable transcript body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 bg-card">
        {messages.length === 0 ? (
          <CaptureOnlyPanel
            capturedName={convo.capturedName}
            capturedEmail={convo.capturedEmail}
            capturedPhone={convo.capturedPhone}
            pageUrl={convo.pageUrl}
            createdAt={convo.createdAt}
          />
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: SerializedMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] text-sm px-4 py-2.5 rounded-[10px] whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div
          className={`text-[10px] uppercase tracking-widest mb-1 ${
            isUser ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {isUser ? "Visitor" : "Assistant"}
        </div>
        {message.content}
        {message.ts ? (
          <div
            className={`text-[10px] mt-1 tabular-nums ${
              isUser ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {format(new Date(message.ts), "MMM d, p")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CaptureOnlyPanel({
  capturedName,
  capturedEmail,
  capturedPhone,
  pageUrl,
  createdAt,
}: {
  capturedName: string | null;
  capturedEmail: string | null;
  capturedPhone: string | null;
  pageUrl: string | null;
  createdAt: Date;
}) {
  const hasAnyContact = Boolean(capturedName || capturedEmail || capturedPhone);
  return (
    <div className="max-w-md mx-auto rounded-xl border border-border bg-muted/30 px-4 py-4">
      <p className="text-sm font-semibold text-foreground">
        {hasAnyContact
          ? "Capture-only conversation"
          : "No interaction recorded"}
      </p>
      <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
        {hasAnyContact
          ? "The visitor submitted contact info via the pre-chat form but never sent a message. They're a real lead — reach out directly."
          : "The widget loaded but no contact info or messages were captured. Likely a visitor who closed the launcher before engaging."}
      </p>
      {hasAnyContact ? (
        <dl className="mt-3 space-y-1.5 text-xs">
          {capturedName ? (
            <Row k="Name" v={capturedName} />
          ) : null}
          {capturedEmail ? (
            <Row
              k="Email"
              v={
                <a
                  href={`mailto:${capturedEmail}`}
                  className="text-foreground underline underline-offset-2"
                >
                  {capturedEmail}
                </a>
              }
            />
          ) : null}
          {capturedPhone ? (
            <Row
              k="Phone"
              v={
                <a
                  href={`tel:${capturedPhone}`}
                  className="text-foreground underline underline-offset-2"
                >
                  {capturedPhone}
                </a>
              }
            />
          ) : null}
          <Row k="Captured" v={format(createdAt, "MMM d, p")} />
          {pageUrl ? <Row k="Page" v={compactUrl(pageUrl)} /> : null}
        </dl>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground w-20 shrink-0">
        {k}
      </dt>
      <dd className="text-foreground min-w-0 truncate">{v}</dd>
    </div>
  );
}

function compactUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname}${path}`.slice(0, 60);
  } catch {
    return url.slice(0, 60);
  }
}

// Helper for the parent page to compose links with the selected conversation
// id preserved alongside the existing filter params.
export function buildConversationHref(
  searchParams: Record<string, string | string[] | undefined>,
  conversationId: string,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string" && v !== "") params.set(k, v);
  }
  params.set("c", conversationId);
  return `/portal/conversations?${params.toString()}`;
}

export type InlineTranscriptProps = Prisma.ChatbotConversationFindFirstArgs;
