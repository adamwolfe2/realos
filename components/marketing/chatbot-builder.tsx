"use client";

import * as React from "react";
import {
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  User,
} from "lucide-react";
import { stripChatbotMarkdown } from "@/lib/chatbot/strip-markdown";
import { BookDemoLink } from "@/components/marketing/book-demo-link";

// ---------------------------------------------------------------------------
// ChatbotBuilder — the interactive core of /build-a-chatbot.
//
// URL in → scraping progress theater → LIVE chat with a Haiku assistant
// grounded in the scraped site (via /api/public/chatbot/demo, stateless)
// → name+email gate ("email me the install snippet") that writes the
// lead through POST /api/onboarding (selectedModules: ["chatbot"], same
// intake pipeline as /book-demo: lands in /admin/intakes + Slack) →
// book-a-call close.
//
// The trial wizard (/onboarding) is deliberately NOT reused here — this
// is a marketing surface, not account setup.
// ---------------------------------------------------------------------------

type Phase = "idle" | "scraping" | "chat" | "failed";

type ChatMessage = { role: "user" | "assistant"; content: string };

type DemoContext = {
  propertyName: string;
  websiteUrl: string;
  facts: string;
};

const THEATER_STEPS = [
  "Reading your website",
  "Extracting floor plans, amenities, and policies",
  "Training the leasing assistant",
  "Bringing it online",
] as const;

const SUGGESTED = [
  "Do you allow pets?",
  "How do I book a tour?",
  "What's included in the rent?",
] as const;

const MIN_THEATER_MS = 3600;

export function ChatbotBuilder() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [urlInput, setUrlInput] = React.useState("");
  const [scrapeError, setScrapeError] = React.useState<string | null>(null);
  const [theaterStep, setTheaterStep] = React.useState(0);
  const [ctx, setCtx] = React.useState<DemoContext | null>(null);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [draft, setDraft] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const userTurns = messages.filter((m) => m.role === "user").length;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  // Theater step advance while the scrape runs.
  React.useEffect(() => {
    if (phase !== "scraping") return;
    setTheaterStep(0);
    const id = setInterval(
      () => setTheaterStep((s) => Math.min(s + 1, THEATER_STEPS.length - 1)),
      MIN_THEATER_MS / THEATER_STEPS.length,
    );
    return () => clearInterval(id);
  }, [phase]);

  async function build(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "scraping" || !urlInput.trim()) return;
    setScrapeError(null);
    setPhase("scraping");
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/public/chatbot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scrape", url: urlInput.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        propertyName?: string;
        websiteUrl?: string;
        facts?: string;
        error?: string;
      };
      // Let the theater finish its arc — the reveal lands better when
      // the steps complete than when the panel snaps in at 900ms.
      const wait = Math.max(0, MIN_THEATER_MS - (Date.now() - startedAt));
      await new Promise((r) => setTimeout(r, wait));
      if (!res.ok || !data.ok || !data.propertyName || !data.facts) {
        setScrapeError(
          data.error ??
            "We couldn't read that site. It may be behind a login or blocking crawlers.",
        );
        setPhase("failed");
        return;
      }
      const next: DemoContext = {
        propertyName: data.propertyName,
        websiteUrl: data.websiteUrl ?? urlInput.trim(),
        facts: data.facts,
      };
      setCtx(next);
      setMessages([
        {
          role: "assistant",
          content: `Hi, I'm the AI leasing assistant for ${next.propertyName}. Ask me anything a renter would: availability, amenities, pets, parking, tours.`,
        },
      ]);
      setPhase("chat");
    } catch {
      setScrapeError("Network error. Try again.");
      setPhase("failed");
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming || !ctx) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setStreaming(true);
    try {
      const res = await fetch("/api/public/chatbot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          context: ctx,
          // Client-side history cap mirrors the API's zod bound.
          messages: nextMessages.slice(-16),
        }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I hit a snag answering that. Give it another try in a moment.",
          },
        ]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const rendered = stripChatbotMarkdown(acc);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: rendered },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection dropped. Try that again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  const host = safeHost(ctx?.websiteUrl ?? urlInput);

  return (
    <div id="builder" className="scroll-mt-24">
      <style>{`
        @keyframes cbb-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .cbb-rise { animation: cbb-rise .5s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes cbb-pulse { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
        .cbb-dot { animation: cbb-pulse 1.2s ease-in-out infinite; }
        @keyframes cbb-live { 0%, 100% { box-shadow: 0 0 0 0 rgba(36,161,72,.35); } 50% { box-shadow: 0 0 0 4px rgba(36,161,72,0); } }
        .cbb-live { animation: cbb-live 2s ease-in-out infinite; }
        @keyframes cbb-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .cbb-bar { transform-origin: left; animation: cbb-bar ${MIN_THEATER_MS}ms cubic-bezier(.25,.6,.35,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .cbb-rise { animation: none; }
          .cbb-dot { animation: none; opacity: 1; }
          .cbb-live { animation: none; }
          .cbb-bar { animation: none; transform: scaleX(1); }
        }
      `}</style>

      {phase === "idle" || phase === "failed" ? (
        <form onSubmit={build} className="mx-auto max-w-[640px]">
          <label
            htmlFor="cbb-url"
            className="mb-2 block text-[12px] font-semibold"
            style={{ color: "#161616" }}
          >
            Your property&apos;s website
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Globe
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "#8d8d8d" }}
                aria-hidden
              />
              <input
                id="cbb-url"
                type="text"
                inputMode="url"
                autoComplete="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="yourproperty.com"
                className="h-12 w-full border pl-10 pr-3 text-[15px] outline-none transition focus:ring-2"
                style={{
                  borderColor: "#c6c6c6",
                  borderRadius: 2,
                  color: "#161616",
                  backgroundColor: "#ffffff",
                }}
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center px-6 text-[14px] font-semibold text-white"
              style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
            >
              Build my chatbot
            </button>
          </div>
          {phase === "failed" && scrapeError ? (
            <p className="cbb-rise mt-3 text-[13px]" style={{ color: "#da1e28" }} role="alert">
              {scrapeError}
            </p>
          ) : (
            <p className="mt-3 text-[12.5px]" style={{ color: "#6f6f6f" }}>
              No account, no card. We read your public site and train the
              preview on what&apos;s actually there.
            </p>
          )}
        </form>
      ) : null}

      {phase === "scraping" ? (
        <div className="cbb-rise mx-auto max-w-[640px]">
          <PanelShell title={host || "your property"} subtitle="Building the assistant" live={false}>
            <div className="px-5 py-6">
              <div className="h-[3px] w-full overflow-hidden" style={{ backgroundColor: "#f4f4f4" }} aria-hidden>
                <div className="cbb-bar h-full" style={{ backgroundColor: "#0f62fe" }} />
              </div>
              <ol className="mt-5" aria-label="Build progress">
                {THEATER_STEPS.map((label, i) => {
                  const state = i < theaterStep ? "done" : i === theaterStep ? "active" : "pending";
                  return (
                    <li
                      key={label}
                      className="flex items-center gap-3 py-2.5"
                      style={{
                        borderBottom: i < THEATER_STEPS.length - 1 ? "1px solid #f4f4f4" : "none",
                        opacity: state === "pending" ? 0.45 : 1,
                        transition: "opacity .3s ease",
                      }}
                    >
                      {state === "done" ? (
                        <Check className="h-4 w-4 shrink-0" style={{ color: "#24a148" }} aria-hidden />
                      ) : state === "active" ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "#0f62fe" }} aria-hidden />
                      ) : (
                        <span aria-hidden className="inline-block h-4 w-4 shrink-0 text-center">
                          <span className="mx-auto mt-1.5 block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#c6c6c6" }} />
                        </span>
                      )}
                      <span className="text-[13.5px] font-medium" style={{ color: "#161616" }}>
                        {label}
                        {state === "active" ? "…" : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </PanelShell>
        </div>
      ) : null}

      {phase === "chat" && ctx ? (
        <div className="cbb-rise mx-auto grid max-w-[980px] items-start gap-6 lg:grid-cols-[1.15fr_minmax(300px,0.85fr)]">
          <PanelShell
            title={ctx.propertyName}
            subtitle={`Live preview · trained on ${host}`}
            live
          >
            <div
              ref={scrollRef}
              className="flex flex-col gap-3 overflow-y-auto px-4 py-4"
              style={{ height: 420, scrollBehavior: "smooth" }}
              aria-live="polite"
            >
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} text={m.content} />
              ))}
              {streaming && messages[messages.length - 1]?.content === "" ? (
                <Typing />
              ) : null}
            </div>

            {userTurns === 0 ? (
              <div className="flex flex-wrap gap-1.5 border-t px-4 py-3" style={{ borderColor: "#f4f4f4" }}>
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    className="border px-3 py-1.5 text-[12.5px] font-medium transition-colors hover:border-[#0f62fe]"
                    style={{ borderColor: "#e0e0e0", borderRadius: 999, color: "#161616" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(draft);
              }}
              className="flex items-center gap-2 border-t px-3 py-3"
              style={{ borderColor: "#e0e0e0" }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Ask about ${ctx.propertyName}…`}
                aria-label="Message the chatbot"
                className="h-10 flex-1 border px-3 text-[14px] outline-none transition focus:ring-2"
                style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
              />
              <button
                type="submit"
                disabled={streaming || !draft.trim()}
                aria-label="Send message"
                className="inline-flex h-10 w-10 items-center justify-center text-white disabled:opacity-50"
                style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </PanelShell>

          <KeepPanel ctx={ctx} />
        </div>
      ) : null}
    </div>
  );
}

// ── Panel chrome ───────────────────────────────────────────────────────

function PanelShell({
  title,
  subtitle,
  live,
  children,
}: {
  title: string;
  subtitle: string;
  live: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="overflow-hidden border bg-white"
      style={{
        borderColor: "#e0e0e0",
        borderRadius: 2,
        boxShadow: "0 1px 2px rgba(22,22,22,0.04), 0 18px 48px rgba(22,22,22,0.07)",
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "#e0e0e0" }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid h-8 w-8 shrink-0 place-items-center text-white"
            style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
            aria-hidden
          >
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-semibold" style={{ color: "#161616" }}>
              {title}
            </p>
            <p className="truncate text-[11px]" style={{ color: "#6f6f6f" }}>
              {subtitle}
            </p>
          </div>
        </div>
        {live ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.12em]"
            style={{ color: "#24a148", fontFamily: "var(--font-mono)" }}
          >
            <span className="cbb-live inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#24a148" }} aria-hidden />
            Live
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (!text) return null;
  const user = role === "user";
  return (
    <div className={`cbb-rise flex ${user ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] whitespace-pre-wrap px-3.5 py-2.5 text-[13.5px] leading-relaxed"
        style={
          user
            ? { backgroundColor: "#0f62fe", color: "#ffffff", borderRadius: 2 }
            : { backgroundColor: "#f4f4f4", color: "#161616", borderRadius: 2 }
        }
      >
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start" aria-label="Assistant is typing">
      <div className="flex items-center gap-1 px-3.5 py-3" style={{ backgroundColor: "#f4f4f4", borderRadius: 2 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="cbb-dot inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#6f6f6f", animationDelay: `${i * 180}ms` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

// ── Keep-it gate: name + email → IntakeSubmission via /api/onboarding ──

function KeepPanel({ ctx }: { ctx: DemoContext }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const valid = name.trim().length >= 2 && /.+@.+\..+/.test(email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: ctx.propertyName,
          websiteUrl: ctx.websiteUrl,
          propertyType: "RESIDENTIAL",
          primaryContactName: name.trim(),
          primaryContactEmail: email.trim().toLowerCase(),
          selectedModules: ["chatbot"],
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save that. Try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <aside
        className="cbb-rise border bg-white p-5"
        style={{ borderColor: "#e0e0e0", borderRadius: 2 }}
      >
        <CheckCircle2 className="h-5 w-5" style={{ color: "#24a148" }} aria-hidden />
        <h3 className="mt-2.5 text-[17px] font-semibold" style={{ color: "#161616" }}>
          Done. Check your inbox.
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "#525252" }}>
          We&apos;ll follow up at {email.trim()} with next steps for putting
          this assistant on {safeHost(ctx.websiteUrl)}. Want it installed and
          tuned this week? That&apos;s a 15-minute call.
        </p>
        <BookDemoLink
          className="mt-4 inline-flex w-full items-center justify-center px-5 py-3 text-[14px] font-semibold text-white"
          style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
          ariaLabel="Book a 15-minute setup call"
        >
          Book a 15-min setup call
        </BookDemoLink>
      </aside>
    );
  }

  return (
    <aside
      className="border p-5"
      style={{ borderColor: "#e0e0e0", borderRadius: 2, backgroundColor: "#f7f9fe" }}
    >
      <p
        className="text-[10.5px] font-mono uppercase tracking-[0.16em]"
        style={{ color: "#0f62fe", fontFamily: "var(--font-mono)" }}
      >
        Keep this chatbot
      </p>
      <h3 className="mt-2 text-[17px] font-semibold leading-snug" style={{ color: "#161616" }}>
        Put it on {safeHost(ctx.websiteUrl)} for real.
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: "#525252" }}>
        We&apos;ll email you the install snippet and set it up with your
        actual availability, pricing rules, and lead routing. One line of
        code on any site.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-2.5">
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#161616" }}>
            <User className="h-3.5 w-3.5" style={{ color: "#6f6f6f" }} aria-hidden />
            Your name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            className="h-11 w-full border bg-white px-3 text-[14px] outline-none transition focus:ring-2"
            style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#161616" }}>
            <Mail className="h-3.5 w-3.5" style={{ color: "#6f6f6f" }} aria-hidden />
            Work email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="h-11 w-full border bg-white px-3 text-[14px] outline-none transition focus:ring-2"
            style={{ borderColor: "#c6c6c6", borderRadius: 2, color: "#161616" }}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !valid}
          className="inline-flex h-11 items-center justify-center px-5 text-[14px] font-semibold text-white transition disabled:opacity-60"
          style={{ backgroundColor: "#0f62fe", borderRadius: 2 }}
        >
          {busy ? "Saving…" : "Email me the install snippet"}
        </button>
      </form>
      {error ? (
        <p className="mt-2 text-[12px]" style={{ color: "#da1e28" }} role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[11px]" style={{ color: "#6f6f6f" }}>
        No spam. One email with the snippet and next steps.
      </p>
    </aside>
  );
}

function safeHost(u: string): string {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}
