import React from "react";
import { Fingerprint, MessageSquare, CalendarCheck, TrendingUp, TrendingDown } from "lucide-react";
import { Eyebrow, WCard, Delta, ScoreChip, INK, MUTED, FAINT, BORDER, BRAND } from "./shell";

// ---------------------------------------------------------------------------
// Compact, mobile-native versions of the five walkthrough screens. Same demo
// data as the desktop replicas (kept in sync), laid out as readable stacked
// cards for phones instead of a cropped desktop dashboard (mobile pass).
// ---------------------------------------------------------------------------

function ScreenTitle({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mt-1" style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
          {title}
        </h3>
      </div>
      {meta ? (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: MUTED, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{meta}</span>
      ) : null}
    </div>
  );
}

function MBriefing() {
  const insights = [
    { icon: TrendingUp, dir: "up" as const, d: "14%", t: "Oak Grove is ahead of pace" },
    { icon: TrendingDown, dir: "down" as const, d: "32%", t: "Riverside is soft this week" },
    { icon: MessageSquare, dir: "up" as const, d: "12", t: "Chatbot captured 12 leads overnight" },
  ];
  return (
    <WCard style={{ padding: 16 }}>
      <Eyebrow>AI briefing · Monday 7:02 AM</Eyebrow>
      <h3 className="mt-1.5" style={{ fontFamily: "var(--font-sans)", fontSize: 19, fontWeight: 600, color: INK, letterSpacing: "-0.02em" }}>
        Good morning, Sample Portfolio
      </h3>
      <p className="mt-1.5 inline-flex items-center gap-2" style={{ fontFamily: "var(--font-sans)", fontSize: 13.5, color: MUTED }}>
        Leasing up <Delta value="14%" dir="up" /> week over week.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {insights.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.t} className="flex items-center gap-2.5" style={{ padding: "9px 0", borderTop: `1px solid ${BORDER}` }}>
              <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND }}>
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} aria-hidden />
              </span>
              <Delta value={it.d} dir={it.dir} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: INK }}>{it.t}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3" style={{ backgroundColor: BRAND, borderRadius: 2, padding: "12px 14px", color: "#FFFFFF" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
          This week · 3 actions
        </p>
        <p className="mt-1.5" style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.4 }}>
          Shift $600 from Meta into Google Ads. Refresh the Riverside creative. Approve the after-hours follow-up.
        </p>
      </div>
    </WCard>
  );
}

function MDashboard() {
  const kpis = [
    { l: "Leads (28d)", v: "168", d: { value: "14%", dir: "up" as const } },
    { l: "Ad spend (28d)", v: "$18,240", d: { value: "6%", dir: "down" as const } },
    { l: "Tours (28d)", v: "31", d: { value: "8%", dir: "up" as const } },
    { l: "Organic (28d)", v: "12,480", d: { value: "11%", dir: "up" as const } },
  ];
  const funnel = [
    { l: "Visitors", v: "12,480", w: 100 },
    { l: "Leads", v: "168", w: 62 },
    { l: "Tours", v: "31", w: 38 },
    { l: "Applications", v: "11", w: 22 },
    { l: "Signed leases", v: "4", w: 12 },
  ];
  return (
    <WCard style={{ padding: 16 }}>
      <ScreenTitle eyebrow="At a glance · last 28 days" title="Dashboard" />
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        {kpis.map((k) => (
          <div key={k.l} style={{ border: `1px solid ${BORDER}`, borderRadius: 2, padding: "10px 12px" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: FAINT }}>{k.l}</p>
            <p className="mt-1" style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 500, color: INK, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{k.v}</p>
            <div className="mt-1"><Delta value={k.d.value} dir={k.d.dir} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Eyebrow>Conversion funnel · last 28 days</Eyebrow>
        <div className="flex flex-col gap-2 mt-2.5">
          {funnel.map((f) => (
            <div key={f.l} className="flex items-center gap-2.5">
              <span style={{ width: 96, fontFamily: "var(--font-sans)", fontSize: 12, color: MUTED, flexShrink: 0 }}>{f.l}</span>
              <div style={{ flex: 1, height: 16, backgroundColor: "#eef1f8", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${f.w}%`, height: "100%", backgroundColor: BRAND }} />
              </div>
              <span style={{ width: 52, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: INK, fontVariantNumeric: "tabular-nums" }}>{f.v}</span>
            </div>
          ))}
        </div>
      </div>
    </WCard>
  );
}

function Row({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: "11px 0", borderTop: first ? "none" : `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function MLeads() {
  const leads = [
    { name: "Marcus T.", source: "Google Ads", score: 92, next: "Call today" },
    { name: "Dana R.", source: "Meta", score: 84, next: "Tour Sat 11am" },
    { name: "Jordan K.", source: "Organic", score: 78, next: "Send floor plan" },
    { name: "Alex M.", source: "Referral", score: 71, next: "Follow up" },
  ];
  return (
    <WCard style={{ padding: 16 }}>
      <ScreenTitle eyebrow="Pipeline" title="Leads" meta="42 active · 168 mo" />
      <div className="mt-2">
        {leads.map((l, i) => (
          <Row key={l.name} first={i === 0}>
            <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: "#eef1f8", color: BRAND, fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600 }}>
              {l.name.charAt(0)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500, color: INK }}>{l.name}</span>
                <ScoreChip score={l.score} />
              </div>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED }}>{l.source} · {l.next}</p>
            </div>
          </Row>
        ))}
      </div>
    </WCard>
  );
}

function MVisitors() {
  const v = [
    { name: "Taylor B.", intent: "Viewed 3-bed floor plans", meta: "4 pages · Google" },
    { name: "Northside Realty", intent: "Pricing + amenities", meta: "7 pages · Direct" },
    { name: "Chris D.", intent: "Application page, twice", meta: "5 pages · Meta" },
    { name: "Beacon Partners", intent: "Compared two properties", meta: "9 pages · Referral" },
  ];
  return (
    <WCard style={{ padding: 16 }}>
      <ScreenTitle eyebrow="Visitor identification" title="Visitors" meta="312 identified" />
      <div className="mt-2">
        {v.map((it, i) => (
          <Row key={it.name} first={i === 0}>
            <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, borderRadius: 2, backgroundColor: "rgba(15,98,254,0.08)", color: BRAND }}>
              <Fingerprint className="w-4 h-4" strokeWidth={1.7} aria-hidden />
            </span>
            <div className="flex-1 min-w-0">
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: INK }}>{it.name}</span>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, color: MUTED }}>{it.intent}</p>
            </div>
            <span className="flex-shrink-0" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: FAINT }}>{it.meta}</span>
          </Row>
        ))}
      </div>
    </WCard>
  );
}

function MChatbot() {
  const messages = [
    { from: "visitor" as const, text: "Is the 2-bed at Oak Grove still available for June?" },
    { from: "bot" as const, text: "It is. $1,850 with parking. Want me to hold a tour time?" },
    { from: "visitor" as const, text: "Saturday morning works." },
    { from: "bot" as const, text: "Booked you for Saturday 11:00 AM. Floor plan sent to your email." },
  ];
  return (
    <WCard style={{ padding: 16 }}>
      <ScreenTitle eyebrow="After hours" title="Conversations" meta="6 flagged · 12 overnight" />
      <div className="flex flex-col gap-2 mt-3">
        {messages.map((m, i) => (
          <div key={i} className={m.from === "bot" ? "self-end" : "self-start"} style={{ maxWidth: "88%" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                lineHeight: 1.4,
                backgroundColor: m.from === "bot" ? BRAND : "#eef1f8",
                color: m.from === "bot" ? "#FFFFFF" : INK,
                borderBottomRightRadius: m.from === "bot" ? 2 : 10,
                borderBottomLeftRadius: m.from === "bot" ? 10 : 2,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3" style={{ padding: "8px 11px", borderRadius: 2, backgroundColor: "rgba(36,161,72,0.08)" }}>
        <CalendarCheck className="w-3.5 h-3.5" style={{ color: "#24a148" }} aria-hidden />
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: "#1a7a38" }}>
          Lead captured · Tour booked Sat 11:00 AM
        </span>
      </div>
    </WCard>
  );
}

const MOBILE = [MBriefing, MDashboard, MLeads, MVisitors, MChatbot];

export function MobileScreen({ beat }: { beat: number }) {
  const S = MOBILE[beat] ?? MBriefing;
  return <S />;
}
