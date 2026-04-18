"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// ModuleShowcase
// Four large cards, each with its own interactive/animated mock UI.
// Cream section, white cards. Copy is intentionally short; the mock is the
// argument. Order mirrors the operator journey: lead -> conversation ->
// creative -> measurement.
// ---------------------------------------------------------------------------

export function ModuleShowcase() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end mb-12">
          <h2
            className="font-serif text-3xl md:text-4xl lg:col-span-2 leading-[1.1]"
            style={{ color: "var(--text-headline)" }}
          >
            The platform, not the pitch deck.
          </h2>
          <p
            className="font-mono text-[12px] leading-relaxed"
            style={{ color: "var(--text-body)" }}
          >
            Every operator gets the same four surfaces. Nothing to wire up,
            nothing to learn. We run it. You review the weekly report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ModuleCard
            label="LEAD INBOX + PIPELINE"
            title="Every visitor becomes a lead, scored and routed."
            body="Named visitors from the identity pixel land next to form submissions, tour requests, and AppFolio applicants in one pipeline. Auto-assigned to the right property."
          >
            <LeadInboxMock />
          </ModuleCard>

          <ModuleCard
            label="AI CHATBOT"
            title="24/7 concierge that knows every unit you have."
            body="Trained on your AppFolio inventory, rent ranges, pet policy, and tour calendar. Captures name + email in conversation, hands off to humans on intent."
          >
            <ChatbotMock />
          </ModuleCard>

          <ModuleCard
            label="CREATIVE QUEUE"
            title="A managed studio. Not a design license."
            body="Submit a request. New concepts in 48 hours. Landing blocks, Meta ads, TikTok hooks, SMS copy, email templates. Every asset brand-locked to your guide."
          >
            <CreativeQueueMock />
          </ModuleCard>

          <ModuleCard
            label="WEEKLY REPORT"
            title="One PDF. Every spend, every lead, every tour."
            body="Goes to the operator and the property owner every Monday. Channel-level attribution, cost per tour, cost per signed lease, and the next creative drop."
          >
            <ReportMock />
          </ModuleCard>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ModuleCard shell
// ---------------------------------------------------------------------------

function ModuleCard({
  label,
  title,
  body,
  children,
}: {
  label: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white overflow-hidden"
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "14px",
      }}
    >
      <div className="p-6 md:p-7">
        <p
          className="font-mono text-[10px]"
          style={{
            color: "var(--blue)",
            letterSpacing: "0.14em",
          }}
        >
          {label}
        </p>
        <h3
          className="font-serif text-[22px] leading-[1.15] mt-3"
          style={{ color: "var(--text-headline)" }}
        >
          {title}
        </h3>
        <p
          className="font-mono text-[12px] leading-relaxed mt-3"
          style={{ color: "var(--text-body)" }}
        >
          {body}
        </p>
      </div>
      <div
        className="px-6 md:px-7 pb-6 md:pb-7"
        style={{ borderTop: "1px dashed var(--border)", paddingTop: "20px" }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead inbox mock
// Three-column kanban with one animated card that cycles stages.
// ---------------------------------------------------------------------------

function LeadInboxMock() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % 3), 3000);
    return () => clearInterval(id);
  }, []);

  const columns = [
    { title: "New", count: 18, color: "var(--blue)" },
    { title: "Tour booked", count: 7, color: "var(--color-gold)" },
    { title: "Applied", count: 3, color: "var(--color-success)" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {columns.map((c, i) => (
        <div
          key={c.title}
          className="p-2.5 rounded"
          style={{
            backgroundColor: "var(--bg-primary)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-mono text-[9px]"
              style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}
            >
              {c.title.toUpperCase()}
            </span>
            <span
              className="font-mono text-[9px] px-1 rounded"
              style={{
                backgroundColor: "white",
                color: c.color,
                border: `1px solid ${c.color}33`,
              }}
            >
              {c.count}
            </span>
          </div>

          <LeadCard
            name={i === 0 ? "Maya R." : i === 1 ? "Daniel L." : "Sophie K."}
            unit={i === 0 ? "Studio" : i === 1 ? "1-Bed" : "2-Bed"}
            score={i === 0 ? 74 : i === 1 ? 88 : 92}
            highlight={i === stage}
          />
          <LeadCard
            name={i === 0 ? "Jin H." : i === 1 ? "Arjun P." : "Noelle D."}
            unit={i === 0 ? "Studio" : i === 1 ? "2-Bed" : "1-Bed"}
            score={i === 0 ? 62 : i === 1 ? 71 : 81}
          />
        </div>
      ))}
    </div>
  );
}

function LeadCard({
  name,
  unit,
  score,
  highlight,
}: {
  name: string;
  unit: string;
  score: number;
  highlight?: boolean;
}) {
  return (
    <div
      className="p-2 mt-1.5 rounded"
      style={{
        backgroundColor: "white",
        border: highlight ? "1px solid var(--blue)" : "1px solid var(--border)",
        boxShadow: highlight ? "0 0 0 3px rgba(42,82,190,0.12)" : undefined,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      <p
        className="font-serif text-[11px]"
        style={{ color: "var(--text-headline)" }}
      >
        {name}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <span
          className="font-mono text-[9px]"
          style={{ color: "var(--text-muted)" }}
        >
          {unit}
        </span>
        <span
          className="font-mono text-[9px] font-semibold"
          style={{
            color: score >= 85 ? "var(--color-success)" : score >= 70 ? "var(--color-gold)" : "var(--text-muted)",
          }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chatbot mock
// Typing-dots loop with a cycled transcript.
// ---------------------------------------------------------------------------

function ChatbotMock() {
  const [i, setI] = useState(0);
  const msgs = [
    { from: "user" as const,  text: "Do you have a studio for September?" },
    { from: "bot" as const,   text: "Yes, three studios open September 1. $1,995 fully furnished. Want to tour?" },
    { from: "user" as const,  text: "Saturday morning?" },
    { from: "bot" as const,   text: "Picked 10:30 AM Saturday. What's the best email to send the confirmation to?" },
  ];
  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, msgs.length)), 1500);
    return () => clearInterval(id);
  }, []);
  const shown = msgs.slice(0, i);

  return (
    <div
      className="rounded p-3"
      style={{
        backgroundColor: "var(--bg-primary)",
        border: "1px solid var(--border)",
        minHeight: "184px",
      }}
    >
      <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--blue)", color: "white" }}
        >
          <span className="font-serif text-[11px]">T</span>
        </span>
        <span className="font-serif text-[12px]" style={{ color: "var(--text-headline)" }}>
          Telegraph Commons assistant
        </span>
        <span className="flex-1" />
        <span
          className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
          style={{
            color: "var(--color-success)",
            backgroundColor: "#ECFDF5",
            border: "1px solid #D1FAE5",
          }}
        >
          &#9679; Live
        </span>
      </div>
      <div className="space-y-2">
        {shown.map((m, idx) => (
          <div key={idx} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] px-2.5 py-1.5 rounded-lg font-mono text-[11px] leading-snug"
              style={
                m.from === "user"
                  ? { backgroundColor: "var(--blue)", color: "white" }
                  : { backgroundColor: "white", color: "var(--text-body)", border: "1px solid var(--border)" }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {i < msgs.length && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: "white", border: "1px solid var(--border)" }}
            >
              <TypingDots />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full"
          style={{
            backgroundColor: "var(--text-muted)",
            animation: `rei-bounce 0.9s ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes rei-bounce {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Creative queue mock
// Asset list with status + ETA.
// ---------------------------------------------------------------------------

function CreativeQueueMock() {
  const items = [
    { type: "Meta ad set",       name: "Fall 2026, 3x concepts",    status: "In review",  eta: "Today" },
    { type: "Landing block",     name: "New hero photo + CTA swap", status: "Shipped",    eta: "Yesterday" },
    { type: "TikTok spark",      name: "Room tour, 15s cut",        status: "Filming",    eta: "Thu" },
    { type: "Email, welcome",    name: "Auto-triggered on apply",   status: "Shipped",    eta: "Mon" },
  ];
  const toneFor = (s: string) =>
    s === "Shipped"
      ? { color: "var(--color-success)", bg: "#ECFDF5", border: "#D1FAE5" }
      : s === "In review"
      ? { color: "var(--blue)", bg: "var(--blue-light)", border: "var(--blue-border)" }
      : { color: "var(--color-gold)", bg: "var(--color-gold-wash)", border: "#F3DCA7" };

  return (
    <div className="space-y-1.5">
      {items.map((a) => {
        const t = toneFor(a.status);
        return (
          <div
            key={a.name}
            className="flex items-center gap-3 px-3 py-2 rounded"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-primary)" }}
          >
            <span
              className="font-mono text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ color: t.color, backgroundColor: t.bg, border: `1px solid ${t.border}` }}
            >
              {a.status}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="font-serif text-[12px] leading-tight truncate"
                style={{ color: "var(--text-headline)" }}
              >
                {a.name}
              </p>
              <p
                className="font-mono text-[9px]"
                style={{ color: "var(--text-muted)" }}
              >
                {a.type}
              </p>
            </div>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {a.eta}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report mock
// Stacked bar-ish week with 3 channels + line of KPIs underneath.
// ---------------------------------------------------------------------------

function ReportMock() {
  const days = [
    { d: "Mon", meta: 18, google: 12, tiktok: 6 },
    { d: "Tue", meta: 22, google: 15, tiktok: 8 },
    { d: "Wed", meta: 28, google: 18, tiktok: 10 },
    { d: "Thu", meta: 34, google: 20, tiktok: 14 },
    { d: "Fri", meta: 30, google: 24, tiktok: 12 },
    { d: "Sat", meta: 26, google: 14, tiktok: 18 },
    { d: "Sun", meta: 20, google: 10, tiktok: 16 },
  ];
  const max = 80;

  return (
    <div>
      <div className="flex items-end gap-1.5 h-[110px]">
        {days.map((d) => {
          const total = d.meta + d.google + d.tiktok;
          return (
            <div key={d.d} className="flex-1 flex flex-col items-stretch">
              <div className="flex-1 flex flex-col-reverse">
                <div
                  style={{
                    height: `${(d.meta / max) * 100}%`,
                    backgroundColor: "var(--blue)",
                  }}
                />
                <div
                  style={{
                    height: `${(d.google / max) * 100}%`,
                    backgroundColor: "var(--color-gold)",
                  }}
                />
                <div
                  style={{
                    height: `${(d.tiktok / max) * 100}%`,
                    backgroundColor: "var(--color-sky)",
                  }}
                />
              </div>
              <div
                className="font-mono text-[9px] text-center mt-1"
                style={{ color: "var(--text-muted)" }}
                title={`${total} leads`}
              >
                {d.d}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="mt-4 pt-3 grid grid-cols-3 gap-3 font-mono text-[10px]"
        style={{ borderTop: "1px dashed var(--border)", color: "var(--text-muted)" }}
      >
        <div>
          <p style={{ color: "var(--text-headline)" }} className="font-serif text-[16px]">
            168
          </p>
          <p className="mt-0.5">Leads this week</p>
        </div>
        <div>
          <p style={{ color: "var(--text-headline)" }} className="font-serif text-[16px]">
            31
          </p>
          <p className="mt-0.5">Tours scheduled</p>
        </div>
        <div>
          <p style={{ color: "var(--text-headline)" }} className="font-serif text-[16px]">
            4
          </p>
          <p className="mt-0.5">Leases signed</p>
        </div>
      </div>
    </div>
  );
}
