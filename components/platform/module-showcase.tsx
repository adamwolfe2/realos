"use client";

import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// ModuleShowcase (Linear-inspired dark)
// Four large translucent cards on the near-black canvas, each with its own
// interactive mock UI. Copy is intentionally short; the mock is the argument.
// Order mirrors the operator journey: lead -> conversation -> creative ->
// measurement.
// ---------------------------------------------------------------------------

export function ModuleShowcase() {
  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end mb-14">
          <h2
            className="lg:col-span-2"
            style={{
              color: "var(--text-headline)",
              fontSize: "clamp(32px, 4.2vw, 48px)",
              fontWeight: 510,
              letterSpacing: "-0.022em",
              lineHeight: 1.04,
            }}
          >
            The platform, not the pitch deck.
          </h2>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: "var(--text-muted)", letterSpacing: "-0.011em" }}
          >
            Every operator gets the same four surfaces. Nothing to wire up,
            nothing to learn. We run it. You review the weekly report.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModuleCard
            label="LEAD INBOX + PIPELINE"
            title="Every visitor becomes a lead, scored and routed."
            body="Named visitors from the identity pixel land next to form submissions, tour requests, and AppFolio applicants in one pipeline."
          >
            <LeadInboxMock />
          </ModuleCard>

          <ModuleCard
            label="AI CHATBOT"
            title="24/7 concierge that knows every unit you have."
            body="Trained on your AppFolio inventory, rent ranges, pet policy, and tour calendar. Captures name and email in conversation."
          >
            <ChatbotMock />
          </ModuleCard>

          <ModuleCard
            label="CREATIVE QUEUE"
            title="A managed studio, not a design license."
            body="Submit a request. New concepts in 48 hours. Landing blocks, Meta ads, TikTok hooks, SMS copy, email templates."
          >
            <CreativeQueueMock />
          </ModuleCard>

          <ModuleCard
            label="WEEKLY REPORT"
            title="One PDF. Every spend, every lead, every tour."
            body="Goes to the operator and the property owner every Monday. Channel-level attribution, cost per tour, cost per signed lease."
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
      className="overflow-hidden transition-colors"
      style={{
        backgroundColor: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border-standard)",
        borderRadius: "12px",
      }}
    >
      <div className="p-6 md:p-7">
        <p
          className="font-mono text-[10px]"
          style={{
            color: "var(--accent-bright)",
            letterSpacing: "0.14em",
            fontWeight: 510,
          }}
        >
          {label}
        </p>
        <h3
          className="text-[22px] mt-3"
          style={{
            color: "var(--text-headline)",
            fontWeight: 510,
            letterSpacing: "-0.015em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h3>
        <p
          className="text-[13px] leading-relaxed mt-3"
          style={{
            color: "var(--text-muted)",
            letterSpacing: "-0.011em",
          }}
        >
          {body}
        </p>
      </div>
      <div
        className="px-6 md:px-7 pb-6 md:pb-7"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: "20px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lead inbox mock
// ---------------------------------------------------------------------------

function LeadInboxMock() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStage((s) => (s + 1) % 3), 2800);
    return () => clearInterval(id);
  }, []);

  const columns = [
    { title: "New",          count: 18, color: "var(--accent-bright)" },
    { title: "Tour booked",  count: 7,  color: "var(--warning)" },
    { title: "Applied",      count: 3,  color: "var(--success)" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {columns.map((c, i) => (
        <div
          key={c.title}
          className="p-2.5 rounded-md"
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-standard)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-mono text-[9px]"
              style={{
                color: "var(--text-subtle)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {c.title}
            </span>
            <span
              className="font-mono text-[9px] px-1 rounded"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                color: c.color,
                border: `1px solid ${c.color}44`,
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
        backgroundColor: highlight ? "rgba(94,106,210,0.10)" : "rgba(255,255,255,0.03)",
        border: highlight ? "1px solid var(--accent-bright)" : "1px solid var(--border-standard)",
        boxShadow: highlight
          ? "0 0 0 3px rgba(94,106,210,0.18), 0 0 20px var(--accent-glow)"
          : undefined,
        transition: "box-shadow 0.25s ease, border-color 0.25s ease, background-color 0.25s ease",
      }}
    >
      <p
        className="text-[11px]"
        style={{ color: "var(--text-headline)", fontWeight: 510 }}
      >
        {name}
      </p>
      <div className="flex items-center justify-between mt-0.5">
        <span
          className="font-mono text-[9px]"
          style={{ color: "var(--text-subtle)" }}
        >
          {unit}
        </span>
        <span
          className="font-mono text-[9px]"
          style={{
            color:
              score >= 85
                ? "var(--success)"
                : score >= 70
                ? "var(--warning)"
                : "var(--text-subtle)",
            fontWeight: 590,
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
// ---------------------------------------------------------------------------

function ChatbotMock() {
  const [i, setI] = useState(0);
  const msgs = [
    { from: "user" as const, text: "Do you have a studio for September?" },
    { from: "bot" as const,  text: "Yes, three studios open September 1. $1,995 fully furnished. Want to tour?" },
    { from: "user" as const, text: "Saturday morning?" },
    { from: "bot" as const,  text: "Picked 10:30 AM Saturday. What's the best email to send confirmation to?" },
  ];
  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, msgs.length)), 1400);
    return () => clearInterval(id);
  }, []);
  const shown = msgs.slice(0, i);

  return (
    <div
      className="rounded-md p-3"
      style={{
        backgroundColor: "rgba(0,0,0,0.25)",
        border: "1px solid var(--border-standard)",
        minHeight: "184px",
      }}
    >
      <div
        className="flex items-center gap-2 mb-3 pb-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
          style={{
            backgroundColor: "var(--accent)",
            color: "white",
            fontWeight: 590,
            boxShadow: "0 0 12px var(--accent-glow)",
          }}
        >
          T
        </span>
        <span
          className="text-[12px]"
          style={{ color: "var(--text-headline)", fontWeight: 510 }}
        >
          Telegraph Commons assistant
        </span>
        <span className="flex-1" />
        <span
          className="font-mono text-[9px] px-1.5 py-0.5 rounded-full"
          style={{
            color: "var(--success)",
            backgroundColor: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.25)",
          }}
        >
          &#9679; Live
        </span>
      </div>
      <div className="space-y-2">
        {shown.map((m, idx) => (
          <div key={idx} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] px-2.5 py-1.5 rounded-lg text-[11px] leading-snug"
              style={
                m.from === "user"
                  ? {
                      backgroundColor: "var(--accent)",
                      color: "white",
                      fontWeight: 510,
                      boxShadow: "0 0 14px var(--accent-glow)",
                    }
                  : {
                      backgroundColor: "rgba(255,255,255,0.04)",
                      color: "var(--text-body)",
                      border: "1px solid var(--border-standard)",
                    }
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
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-standard)",
              }}
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
// ---------------------------------------------------------------------------

function CreativeQueueMock() {
  const items = [
    { type: "Meta ad set",    name: "Fall 2026, 3x concepts",    status: "In review", eta: "Today" },
    { type: "Landing block",  name: "New hero photo + CTA swap", status: "Shipped",   eta: "Yesterday" },
    { type: "TikTok spark",   name: "Room tour, 15s cut",        status: "Filming",   eta: "Thu" },
    { type: "Email, welcome", name: "Auto-triggered on apply",   status: "Shipped",   eta: "Mon" },
  ];
  const toneFor = (s: string) =>
    s === "Shipped"
      ? { color: "var(--success)",        bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)" }
      : s === "In review"
      ? { color: "var(--accent-bright)",  bg: "rgba(94,106,210,0.14)",  border: "rgba(94,106,210,0.35)" }
      : { color: "var(--warning)",        bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)" };

  return (
    <div className="space-y-1.5">
      {items.map((a) => {
        const t = toneFor(a.status);
        return (
          <div
            key={a.name}
            className="flex items-center gap-3 px-3 py-2 rounded-md"
            style={{
              border: "1px solid var(--border-standard)",
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            <span
              className="font-mono text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                color: t.color,
                backgroundColor: t.bg,
                border: `1px solid ${t.border}`,
              }}
            >
              {a.status}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] leading-tight truncate"
                style={{
                  color: "var(--text-headline)",
                  fontWeight: 510,
                }}
              >
                {a.name}
              </p>
              <p
                className="font-mono text-[9px]"
                style={{ color: "var(--text-subtle)" }}
              >
                {a.type}
              </p>
            </div>
            <span
              className="font-mono text-[10px]"
              style={{ color: "var(--text-subtle)" }}
            >
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
              <div className="flex-1 flex flex-col-reverse rounded-sm overflow-hidden">
                <div
                  style={{
                    height: `${(d.meta / max) * 100}%`,
                    backgroundColor: "var(--accent)",
                  }}
                />
                <div
                  style={{
                    height: `${(d.google / max) * 100}%`,
                    backgroundColor: "var(--accent-bright)",
                  }}
                />
                <div
                  style={{
                    height: `${(d.tiktok / max) * 100}%`,
                    backgroundColor: "#828fff",
                  }}
                />
              </div>
              <div
                className="font-mono text-[9px] text-center mt-1"
                style={{ color: "var(--text-subtle)" }}
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
        style={{
          borderTop: "1px dashed var(--border-standard)",
          color: "var(--text-subtle)",
        }}
      >
        <div>
          <p
            className="text-[18px]"
            style={{
              color: "var(--text-headline)",
              fontWeight: 510,
              letterSpacing: "-0.015em",
            }}
          >
            168
          </p>
          <p className="mt-0.5">Leads this week</p>
        </div>
        <div>
          <p
            className="text-[18px]"
            style={{
              color: "var(--text-headline)",
              fontWeight: 510,
              letterSpacing: "-0.015em",
            }}
          >
            31
          </p>
          <p className="mt-0.5">Tours scheduled</p>
        </div>
        <div>
          <p
            className="text-[18px]"
            style={{
              color: "var(--text-headline)",
              fontWeight: 510,
              letterSpacing: "-0.015em",
            }}
          >
            4
          </p>
          <p className="mt-0.5">Leases signed</p>
        </div>
      </div>
    </div>
  );
}
