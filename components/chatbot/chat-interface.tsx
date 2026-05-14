"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChatQuickReplies } from "./chat-quick-replies";
import { trackChatbotLeadCaptured } from "@/lib/chatbot/analytics";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type InjectedEngagement = {
  id: string;
  message: string;
  openWidget?: boolean;
  createdAt?: string;
};

type ListingsSummary = {
  openCount: number;
  lowestRent: number | null;
  nextAvailable: string | null;
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

export function ChatInterface({
  orgId,
  slug,
  brandName,
  sessionId,
  personaName,
  avatarUrl,
  greeting,
  primaryCtaText,
  primaryCtaUrl,
  phoneNumber,
  contactEmail,
  onClose,
  injectedMessages,
  onInjectedConsumed,
}: {
  orgId: string;
  slug: string;
  brandName: string;
  sessionId: string;
  personaName: string;
  avatarUrl?: string | null;
  greeting: string;
  primaryCtaText?: string | null;
  primaryCtaUrl?: string | null;
  phoneNumber?: string | null;
  contactEmail?: string | null;
  onClose: () => void;
  injectedMessages?: InjectedEngagement[];
  onInjectedConsumed?: (ids: string[]) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveGreetingInjected, setLiveGreetingInjected] = useState(false);
  const leadFiredRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  // Desktop-only autofocus. iOS Safari would otherwise jump the page up and
  // summon the keyboard before the panel finishes animating in.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) inputRef.current?.focus();
  }, []);

  // Live inventory hook. On mount we fetch the tenant's current availability
  // summary and, if anything is open, append a second assistant bubble with
  // the lowest live rent. Matches the "Jessica just had rooms come available"
  // pattern used on Telegraph Commons. Silent failure → static greeting only.
  useEffect(() => {
    if (liveGreetingInjected) return;
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(
          "/api/public/chatbot/listings-summary",
          window.location.origin
        );
        url.searchParams.set("slug", slug);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as ListingsSummary;
        if (cancelled || body.openCount <= 0) return;
        const priceLine = body.lowestRent
          ? ` starting at $${body.lowestRent.toLocaleString()}/mo`
          : "";
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `We just had rooms come available at ${brandName}${priceLine}. What can I help you with?`,
          },
        ]);
        setLiveGreetingInjected(true);
      } catch {
        // fall back to the static greeting.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, brandName, liveGreetingInjected]);

  // Drain operator-pushed engagements into the visible transcript. We dedupe
  // by id, append them as assistant turns, then notify the parent so the
  // pending queue can be cleared.
  const consumedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!injectedMessages || injectedMessages.length === 0) return;
    const fresh = injectedMessages.filter(
      (m) => !consumedRef.current.has(m.id)
    );
    if (fresh.length === 0) return;
    fresh.forEach((m) => consumedRef.current.add(m.id));
    setMessages((prev) => [
      ...prev,
      ...fresh.map(
        (m) => ({ role: "assistant" as const, content: m.message })
      ),
    ]);
    onInjectedConsumed?.(fresh.map((m) => m.id));
  }, [injectedMessages, onInjectedConsumed]);

  async function sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const outbound = [
      ...messages.filter((m, i) => !(i === 0 && m.content === greeting)),
      userMsg,
    ];
    const history = [...messages, userMsg];
    setMessages(history);
    setStreaming(true);

    // Passive email detection. Fire the analytics lead event once per
    // session, regardless of whether the user filled the pre-chat form or
    // typed their email inline. Server-side persistence still creates the
    // Lead + Resend notification from /api/chat.
    if (!leadFiredRef.current && EMAIL_RE.test(trimmed)) {
      leadFiredRef.current = true;
      trackChatbotLeadCaptured({ orgId, via: "regex" });
    }

    try {
      const res = await fetch("/api/chat", {
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
        // Strip any markdown the model slipped in (asterisks, em dashes,
        // bullet markers, headers). Defense-in-depth — the system prompt
        // forbids these, but Claude occasionally reaches for them anyway,
        // and the widget renders plain text via whitespace-pre-wrap so
        // any raw markdown would show literally as "**Premium:**". Run
        // on every chunk so the visitor never even momentarily sees raw
        // markup mid-stream.
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: stripChatbotMarkdown(assistantText),
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

  function send() {
    const text = input;
    setInput("");
    void sendText(text);
  }

  const lastAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return null;
  }, [messages]);

  const hasAvailability = Boolean(primaryCtaUrl);
  const hasContact = Boolean(phoneNumber || contactEmail);
  const actionCount = 1 + (hasAvailability ? 1 : 0) + (hasContact ? 1 : 0);
  const gridCols =
    actionCount === 3
      ? "grid-cols-3"
      : actionCount === 2
        ? "grid-cols-2"
        : "grid-cols-1";

  return (
    <div
      className="fixed z-50 bg-white shadow-2xl flex flex-col overflow-hidden
                 inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl
                 sm:inset-auto sm:bottom-24 sm:right-4 sm:w-[92vw] sm:max-w-[380px] sm:h-[600px] sm:max-h-none sm:rounded-xl"
      role="dialog"
      aria-label={`Chat with ${personaName}`}
    >
      <header
        className="flex items-center gap-3 p-4"
        style={{
          background:
            "linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))",
          color: "white",
        }}
      >
        <div className="relative">
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
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">
            {personaName}
            <span className="font-normal opacity-80"> · {brandName}</span>
          </div>
          <div className="text-xs opacity-90 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Online · Usually replies instantly
          </div>
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

      <div className={`grid ${gridCols} gap-2 p-3 border-b bg-white`}>
        <button
          type="button"
          onClick={() => sendText("I'd like to schedule a tour")}
          className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <CalendarIcon />
          Schedule a Tour
        </button>
        {hasAvailability ? (
          <a
            href={primaryCtaUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <HomeIcon />
            {primaryCtaText ?? "Availability"}
          </a>
        ) : null}
        {hasContact ? (
          <a
            href={phoneNumber ? `tel:${phoneNumber}` : `mailto:${contactEmail}`}
            className="flex flex-col items-center justify-center gap-1 py-2 rounded-lg border text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <PhoneIcon />
            Contact
          </a>
        ) : null}
      </div>

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
        {!streaming ? (
          <ChatQuickReplies
            lastAssistantMessage={lastAssistantMessage}
            onSelect={(text) => sendText(text)}
            disabled={streaming}
          />
        ) : null}
        {error ? (
          <p className="text-xs text-red-600">{error}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <div
        className="p-3 border-t flex gap-2 bg-white"
        style={{
          paddingBottom:
            "max(0.75rem, calc(0.75rem + env(safe-area-inset-bottom)))",
        }}
      >
        <input
          ref={inputRef}
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
          className="flex-1 border rounded-full px-4 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
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

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
