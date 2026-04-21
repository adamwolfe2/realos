import Link from "next/link";
import { MessageSquare, AlertTriangle, User2, ArrowRight } from "lucide-react";

type ChatbotMessage = { role: string; content: string; timestamp?: string };

type Conversation = {
  id: string;
  capturedName: string | null;
  capturedEmail: string | null;
  messageCount: number;
  lastMessageAt: Date;
  messages: unknown;
  handedOffAt: Date | null;
  property: { id: string; name: string } | null;
  flags: { flag: string }[];
};

export function TranscriptList({ conversations }: { conversations: Conversation[] }) {
  if (conversations.length === 0) {
    return (
      <div className="text-center py-10">
        <MessageSquare className="mx-auto h-6 w-6 text-[var(--stone-gray)]" />
        <p className="mt-2 text-sm text-[var(--olive-gray)]">
          No chatbot transcripts to review this session.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border-cream)]">
      {conversations.map((c) => (
        <TranscriptRow key={c.id} conversation={c} />
      ))}
    </ul>
  );
}

function TranscriptRow({ conversation }: { conversation: Conversation }) {
  const msgs = (conversation.messages as ChatbotMessage[] | null) ?? [];
  const firstUserMsg = msgs.find((m) => m.role === "user")?.content ?? "";
  const preview = firstUserMsg.length > 120 ? firstUserMsg.slice(0, 117) + "..." : firstUserMsg;
  const name = conversation.capturedName || conversation.capturedEmail || "Anonymous visitor";
  const flagTypes = new Set(conversation.flags.map((f) => f.flag));
  const needsTuning = flagTypes.has("needs_prompt_tuning");
  const highIntent = flagTypes.has("lead_high_intent");

  return (
    <li className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--warm-sand)]">
        <User2 className="h-3 w-3 text-[var(--olive-gray)]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/portal/conversations/${conversation.id}`}
            className="text-sm font-semibold tracking-tight text-[var(--near-black)] hover:text-[var(--terracotta)] transition-colors"
          >
            {name}
          </Link>
          {conversation.capturedEmail ? (
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
              Captured
            </span>
          ) : null}
          {highIntent ? (
            <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-rose-700 ring-1 ring-inset ring-rose-200/70">
              High intent
            </span>
          ) : null}
          {needsTuning ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-800 ring-1 ring-inset ring-amber-200/70">
              <AlertTriangle className="h-2.5 w-2.5" />
              Tune prompt
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-[var(--stone-gray)]">
          <span className="tabular-nums">{conversation.messageCount} messages</span>
          {conversation.property ? (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-[var(--stone-gray)]" />
              <span>{conversation.property.name}</span>
            </>
          ) : null}
          <span className="h-0.5 w-0.5 rounded-full bg-[var(--stone-gray)]" />
          <time dateTime={conversation.lastMessageAt.toISOString()}>
            {relativeTime(conversation.lastMessageAt)}
          </time>
        </div>
        {preview ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--olive-gray)] line-clamp-2">
            "{preview}"
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center">
          <Link
            href={`/portal/conversations/${conversation.id}`}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--stone-gray)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Read transcript
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </li>
  );
}

function relativeTime(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}
