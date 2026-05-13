import * as React from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { MessageSquare, ArrowRight, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// LeadConversationPanel — surfaces the chatbot transcript that led to a
// lead being created, directly on the lead detail page. Operators were
// previously forced to navigate to /portal/conversations and find the
// right row to read what the prospect actually said — the chatbot WAS
// the lead source for most chatbot-captured leads, and not seeing it
// inline made every callback a cold call.
//
// Shape: collapsed-by-default summary card showing the most recent N
// messages with a "View full conversation" link that opens the dedicated
// detail page. When multiple conversations exist for one lead (common —
// returning prospects re-engage), only the most recent is inlined; the
// others are listed below as deep links.
// ---------------------------------------------------------------------------

export type LeadConversationMessage = {
  role: "user" | "assistant" | string;
  content: string;
  ts?: string;
};

export type LeadConversationSummary = {
  id: string;
  status: string;
  messageCount: number;
  lastMessageAt: Date | string;
  createdAt: Date | string;
  pageUrl: string | null;
  capturedEmail: string | null;
  capturedName: string | null;
  /** Parsed messages array. Caller must coerce from the Json column. */
  messages: LeadConversationMessage[];
};

type Props = {
  conversations: LeadConversationSummary[];
  /** How many trailing messages to show inline. Default 6. */
  previewCount?: number;
};

export function LeadConversationPanel({
  conversations,
  previewCount = 6,
}: Props) {
  if (conversations.length === 0) return null;

  const [primary, ...others] = conversations;
  const messages = Array.isArray(primary.messages) ? primary.messages : [];
  // Show only the last N messages to keep the panel scannable. The full
  // transcript lives at /portal/conversations/[id].
  const visible = messages.slice(-previewCount);
  const earlierHidden = Math.max(0, messages.length - visible.length);

  const lastMessageAt = new Date(primary.lastMessageAt);
  const createdAt = new Date(primary.createdAt);

  return (
    <section
      id="conversation"
      className="scroll-mt-20 rounded-[12px] border border-border bg-card overflow-hidden"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Chatbot conversation
            </h2>
            <span className="text-[10px] tracking-widest uppercase font-semibold text-muted-foreground">
              {primary.messageCount} {primary.messageCount === 1 ? "msg" : "msgs"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Started {format(createdAt, "MMM d, h:mm a")} ·{" "}
            {formatDistanceToNow(lastMessageAt, { addSuffix: true })}
            {primary.pageUrl ? (
              <>
                {" · on "}
                <span className="font-mono text-foreground/80">
                  {humanizeUrl(primary.pageUrl)}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <Link
          href={`/portal/conversations/${primary.id}`}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline whitespace-nowrap"
        >
          Full transcript
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </header>

      {/* Messages */}
      <div className="px-4 py-3 space-y-2">
        {earlierHidden > 0 ? (
          <p className="text-[11px] text-muted-foreground italic text-center py-1">
            {earlierHidden} earlier message{earlierHidden === 1 ? "" : "s"} hidden —{" "}
            <Link
              href={`/portal/conversations/${primary.id}`}
              className="font-semibold text-primary hover:underline"
            >
              view full transcript
            </Link>
          </p>
        ) : null}
        {visible.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
      </div>

      {/* Other conversations footer */}
      {others.length > 0 ? (
        <footer className="border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            +{others.length} earlier conversation{others.length === 1 ? "" : "s"}
          </span>
          {" — "}
          {others.slice(0, 3).map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 ? " · " : null}
              <Link
                href={`/portal/conversations/${c.id}`}
                className="hover:text-primary hover:underline"
              >
                {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}
              </Link>
            </React.Fragment>
          ))}
        </footer>
      ) : null}
    </section>
  );
}

function MessageBubble({ message }: { message: LeadConversationMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] text-[13px] px-3 py-2 rounded-[10px] whitespace-pre-wrap leading-snug",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <div
          className={cn(
            "text-[9px] uppercase tracking-widest font-semibold mb-0.5 flex items-center gap-1",
            isUser ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {isUser ? (
            "Visitor"
          ) : (
            <>
              <Bot className="h-2.5 w-2.5" aria-hidden="true" />
              Assistant
            </>
          )}
          {message.ts ? (
            <span className="font-mono tabular-nums opacity-70 ml-1">
              {format(new Date(message.ts), "h:mm a")}
            </span>
          ) : null}
        </div>
        {message.content}
      </div>
    </div>
  );
}

// "https://telegraphcommons.com/floor-plans/" → "telegraphcommons.com/floor-plans"
function humanizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "");
    return path ? `${u.host}${path}` : u.host;
  } catch {
    return url;
  }
}
