"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Message = {
  role: string;
  content: string;
  timestamp?: string | number | Date | null;
};

function parseMessages(raw: unknown): Message[] {
  if (!Array.isArray(raw)) return [];
  const out: Message[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const role = typeof rec.role === "string" ? rec.role : null;
    const content = typeof rec.content === "string" ? rec.content : null;
    if (!role || !content) continue;
    out.push({
      role,
      content,
      timestamp:
        (typeof rec.timestamp === "string" || typeof rec.timestamp === "number"
          ? rec.timestamp
          : null),
    });
  }
  return out;
}

export function ChatTranscript({ rawMessages }: { rawMessages: unknown }) {
  const [open, setOpen] = useState(false);
  const messages = parseMessages(rawMessages);

  if (messages.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No messages recorded.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-primary hover:text-[hsl(var(--primary)/0.9)] transition-colors duration-200"
      >
        {open ? "Hide conversation" : "View conversation"}
      </button>
      {open ? (
        <div
          className={cn(
            "mt-3 max-h-[340px] overflow-auto rounded-[10px] bg-card",
            "ring-1 ring-border p-3 space-y-2"
          )}
        >
          {messages.map((m, i) => {
            const isUser = m.role === "user";
            return (
              <div
                key={i}
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-[10px] px-3 py-2 text-xs leading-snug whitespace-pre-wrap",
                    isUser
                      ? "bg-primary text-background"
                      : "bg-card text-foreground ring-1 ring-border"
                  )}
                >
                  {m.content}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
