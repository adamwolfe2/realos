import Link from "next/link";
import { Sparkles } from "lucide-react";
import { z } from "zod";
import { Initial } from "./kit";

// The latest captured conversation as the prospect saw it, with the agent's
// extracted read of the prospect beside it.

const MessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string() });
const MessagesSchema = z.array(z.unknown()).transform((rows) =>
  rows.flatMap((r) => {
    const m = MessageSchema.safeParse(r);
    return m.success ? [m.data] : [];
  }),
);

export type SummaryLine = string;

export function ConversationPreview({ id, name, property, persona, messages, summary }: {
  id: string;
  name: string;
  property: string | null;
  persona: string;
  messages: unknown;
  summary: SummaryLine[];
}) {
  const parsed = MessagesSchema.safeParse(Array.isArray(messages) ? messages : []);
  const rows = (parsed.success ? parsed.data : []).slice(-4);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-[var(--t-divider)] px-4 py-3">
        <Initial name={name} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-[var(--t-ink)]">{name}</p>
          <p className="truncate text-[12px] text-[var(--t-muted)]">{property ?? "Website chat"} · with {persona}</p>
        </div>
        <Link href={`/portal/conversations/${id}`} className="rounded-full bg-[var(--t-primary-bg)] px-3 py-1 text-[12px] font-medium text-[var(--t-primary-fg)] hover:opacity-90">Open</Link>
      </div>
      <div className="flex-1 space-y-2.5 px-4 py-4">
        {rows.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ls-step flex justify-start" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="max-w-[82%] rounded-[12px] rounded-bl-[4px] border border-[var(--t-border)] bg-white px-3 py-2 text-[13px] leading-snug text-[var(--t-ink)]">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="ls-step flex justify-end" style={{ animationDelay: `${i * 90}ms` }}>
              <p className="max-w-[82%] rounded-[12px] rounded-br-[4px] bg-[var(--t-accent)] px-3 py-2 text-[13px] leading-snug text-white">{m.content}</p>
            </div>
          ),
        )}
        {summary.length ? (
          <div className="ls-step max-w-full rounded-[12px] border border-[var(--t-border)] bg-white px-3.5 py-3" style={{ animationDelay: `${rows.length * 90}ms` }}>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--t-ink)]"><Sparkles className="h-3.5 w-3.5" aria-hidden />Summary</p>
            <ul className="mt-1.5 space-y-0.5 text-[12.5px] leading-snug text-[var(--t-text)]">
              {summary.map((l) => <li key={l} className="flex gap-1.5"><span aria-hidden>•</span>{l}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
