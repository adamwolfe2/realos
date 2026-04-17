"use client";

import { useState, useRef, useEffect } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function ChatInterface({
  orgId,
  sessionId,
  personaName,
  avatarUrl,
  greeting,
  onClose,
}: {
  orgId: string;
  sessionId: string;
  personaName: string;
  avatarUrl?: string | null;
  greeting: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: text };
    const outbound = [...messages.filter((m, i) => !(i === 0 && m.content === greeting)), userMsg];
    const history = [...messages, userMsg];
    setMessages(history);
    setStreaming(true);

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          sessionId,
          messages: outbound,
          pageUrl:
            typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `Chat failed, ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        assistantText += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return next;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Chat failed, try again."
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-50 w-[92vw] max-w-[380px] h-[540px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
      role="dialog"
      aria-label={`Chat with ${personaName}`}
    >
      <header
        className="flex items-center gap-3 p-4 border-b"
        style={{
          background:
            "linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))",
          color: "white",
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={personaName}
            className="w-10 h-10 rounded-full border-2 border-white/40 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg font-semibold">
            {personaName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{personaName}</div>
          <div className="text-xs opacity-80">● Online</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="text-white/80 hover:text-white text-2xl leading-none"
        >
          ×
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50"
        aria-live="polite"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[82%] text-sm px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                m.role === "user" ? "text-white" : "bg-white border text-slate-900"
              }`}
              style={
                m.role === "user"
                  ? { backgroundColor: "var(--tenant-primary)" }
                  : undefined
              }
            >
              {m.content || (streaming ? "…" : "")}
            </div>
          </div>
        ))}
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t flex gap-2 bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={streaming}
          placeholder="Ask about availability, tours, pricing…"
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          aria-label="Message"
        />
        <button
          type="button"
          onClick={send}
          disabled={streaming || !input.trim()}
          className="px-4 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: "var(--tenant-primary)" }}
        >
          {streaming ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
