"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// HeroDemo (Claude-inspired warm canvas)
// Auto-advancing 4-step walkthrough: IMPORT -> BUILD -> ATTACH -> LAUNCH.
// Ivory card with parchment-tinted borders, terracotta for active accents.
// Ring shadows instead of drop shadows. Fraunces for headline text.
// ---------------------------------------------------------------------------

type StepKey = "import" | "build" | "attach" | "launch";

const STEPS: { key: StepKey; num: string; title: string }[] = [
  { key: "import", num: "01", title: "IMPORT" },
  { key: "build",  num: "02", title: "BUILD" },
  { key: "attach", num: "03", title: "ATTACH" },
  { key: "launch", num: "04", title: "LAUNCH" },
];

const AUTO_MS = 4500;

export function HeroDemo() {
  const [active, setActive] = useState<StepKey>("import");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((k) => {
        const idx = STEPS.findIndex((s) => s.key === k);
        return STEPS[(idx + 1) % STEPS.length].key;
      });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [paused]);

  const activeIdx = STEPS.findIndex((s) => s.key === active);

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        backgroundColor: "#faf9f5",
        boxShadow: "0 0 0 1px #f0eee6, 0 10px 32px rgba(0,0,0,0.04)",
        borderRadius: "20px",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="grid grid-cols-4" style={{ borderBottom: "1px solid #f0eee6" }}>
        {STEPS.map((s, i) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className="relative px-3 py-3.5 text-left"
              style={{
                backgroundColor: isActive ? "#ffffff" : "transparent",
                borderRight: i < STEPS.length - 1 ? "1px solid #f0eee6" : "none",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
            >
              <span
                className="block"
                style={{
                  color: isActive ? "#2F6FE5" : "#87867f",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.14em",
                  fontWeight: 500,
                }}
              >
                {s.num}
              </span>
              <span
                className="block mt-1"
                style={{
                  color: isActive ? "#141413" : "#5e5d59",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.03em",
                }}
              >
                {s.title}
              </span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 bottom-[-1px] h-[2px]"
                  style={{ backgroundColor: "#2F6FE5" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-6 md:p-8 min-h-[420px]" style={{ backgroundColor: "#ffffff" }}>
        {active === "import" && <ImportPane />}
        {active === "build" && <BuildPane />}
        {active === "attach" && <AttachPane />}
        {active === "launch" && <LaunchPane />}
      </div>

      <div
        className="px-6 py-3 flex items-center gap-4"
        style={{
          borderTop: "1px solid #f0eee6",
          backgroundColor: "#faf9f5",
        }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "#2F6FE5" }}
        />
        <span
          className="flex-1"
          style={{
            color: "#87867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Live demo, auto-advances, click any tab
        </span>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className="block h-[3px] rounded-full"
              style={{
                width: i === activeIdx ? "24px" : "10px",
                backgroundColor: i === activeIdx ? "#2F6FE5" : "#d1cfc5",
                transition: "all 0.3s ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 01 - Import from AppFolio
// ---------------------------------------------------------------------------

function ImportPane() {
  const rows = useMemo(
    () => [
      { unit: "214", bed: "Studio", rent: "$1,995", status: "Available", sync: "synced" as const },
      { unit: "308", bed: "1 Bed",  rent: "$2,350", status: "Available", sync: "synced" as const },
      { unit: "411", bed: "2 Bed",  rent: "$3,100", status: "Notice",    sync: "synced" as const },
      { unit: "512", bed: "2 Bed",  rent: "$3,200", status: "Occupied",  sync: "synced" as const },
      { unit: "604", bed: "3 Bed",  rent: "$4,150", status: "Available", sync: "syncing" as const },
    ],
    []
  );

  return (
    <div>
      <StepHeader
        left={<span>STEP 01 &middot; IMPORT</span>}
        right={
          <span>
            <strong style={{ color: "#141413", fontWeight: 500 }}>86 / 86</strong>{" "}
            <span style={{ color: "#87867f" }}>UNITS</span>
          </span>
        }
      />
      <p
        className="mt-3 mb-5"
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          lineHeight: 1.25,
        }}
      >
        Live inventory, synced from your PMS
      </p>

      <div
        className="overflow-hidden"
        style={{ boxShadow: "0 0 0 1px #f0eee6", borderRadius: "12px" }}
      >
        <div
          className="grid grid-cols-[56px_1fr_72px_96px_84px] gap-2 px-4 py-2.5"
          style={{
            backgroundColor: "#faf9f5",
            borderBottom: "1px solid #f0eee6",
            color: "#87867f",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.08em",
            fontWeight: 500,
          }}
        >
          <span>UNIT</span>
          <span>BEDS</span>
          <span>RENT</span>
          <span>STATUS</span>
          <span>SYNC</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.unit}
            className="grid grid-cols-[56px_1fr_72px_96px_84px] gap-2 px-4 py-2.5 items-center"
            style={{
              borderBottom: i < rows.length - 1 ? "1px solid #f0eee6" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "#141413", fontWeight: 500 }}>{r.unit}</span>
            <span style={{ color: "#4d4c48" }}>{r.bed}</span>
            <span style={{ color: "#141413", fontWeight: 500 }}>{r.rent}</span>
            <span>
              <StatusPill
                label={r.status}
                tone={r.status === "Available" ? "ok" : r.status === "Notice" ? "warn" : "muted"}
              />
            </span>
            <span>
              {r.sync === "synced" ? (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: "#3a7d44", fontFamily: "var(--font-mono)", fontSize: "10px" }}
                >
                  <CheckIcon /> Synced
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: "#2F6FE5", fontFamily: "var(--font-mono)", fontSize: "10px" }}
                >
                  <Spinner /> Syncing
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <FooterLine label="Source" value="AppFolio, Yardi, Buildium, RealPage" meta="Refresh every 15 min" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 02 - Build
// ---------------------------------------------------------------------------

function BuildPane() {
  const blocks = [
    { icon: "H", name: "Hero",               meta: "Photo, headline, CTA" },
    { icon: "P", name: "Floor plans",        meta: "Auto-sync from PMS" },
    { icon: "A", name: "Amenities",          meta: "12 items, 6 icons" },
    { icon: "M", name: "Map + neighborhood", meta: "5 categories pinned" },
    { icon: "F", name: "FAQ",                meta: "Tailored to your property" },
    { icon: "C", name: "Contact + tour",     meta: "Cal.com embedded" },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 02 &middot; BUILD</span>}
        right={
          <span>
            <strong style={{ color: "#141413", fontWeight: 500 }}>6</strong>{" "}
            <span style={{ color: "#87867f" }}>BLOCKS ACTIVE</span>
          </span>
        }
      />
      <p
        className="mt-3 mb-5"
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          lineHeight: 1.25,
        }}
      >
        Page blocks on your domain
      </p>

      <div
        className="overflow-hidden"
        style={{ boxShadow: "0 0 0 1px #f0eee6", borderRadius: "12px" }}
      >
        {blocks.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: i < blocks.length - 1 ? "1px solid #f0eee6" : "none",
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8"
              style={{
                backgroundColor: "rgba(47,111,229,0.10)",
                color: "#2F6FE5",
                borderRadius: "8px",
                fontFamily: "var(--font-display)",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {b.icon}
            </span>
            <span
              className="flex-1"
              style={{
                color: "#141413",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {b.name}
            </span>
            <span
              className="hidden sm:inline"
              style={{
                color: "#87867f",
                fontFamily: "var(--font-sans)",
                fontSize: "12px",
              }}
            >
              {b.meta}
            </span>
            <Toggle on={true} />
          </div>
        ))}
      </div>

      <FooterLine label="Domain" value="your-domain.com" meta="SSL active" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 03 - Attach
// ---------------------------------------------------------------------------

function AttachPane() {
  const visitors = [
    { initials: "MR", name: "Maya R.",   src: "Returning visitor",  kind: "Resolved" as const,   time: "2m" },
    { initials: "?",  name: "Anonymous", src: "Direct search",      kind: "Unresolved" as const, time: "4m" },
    { initials: "DL", name: "Daniel L.", src: "Paid social",        kind: "Resolved" as const,   time: "9m" },
    { initials: "SK", name: "Sophie K.", src: "Referral",           kind: "Resolved" as const,   time: "12m" },
    { initials: "?",  name: "Anonymous", src: "Organic search",     kind: "Unresolved" as const, time: "15m" },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 03 &middot; ATTACH</span>}
        right={
          <span>
            <strong style={{ color: "#141413", fontWeight: 500 }}>95%</strong>{" "}
            <span style={{ color: "#87867f" }}>RESOLVE RATE</span>
          </span>
        }
      />
      <p
        className="mt-3 mb-5"
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          lineHeight: 1.25,
        }}
      >
        Naming the visitors who never fill a form
      </p>

      <div
        className="overflow-hidden"
        style={{ boxShadow: "0 0 0 1px #f0eee6", borderRadius: "12px" }}
      >
        {visitors.map((v, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3"
            style={{
              borderBottom: i < visitors.length - 1 ? "1px solid #f0eee6" : "none",
              opacity: v.kind === "Unresolved" ? 0.55 : 1,
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                backgroundColor: v.kind === "Resolved" ? "rgba(47,111,229,0.12)" : "#f0eee6",
                color: v.kind === "Resolved" ? "#2F6FE5" : "#87867f",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                fontWeight: 500,
              }}
            >
              {v.initials}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="truncate"
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {v.name}
              </p>
              <p
                className="truncate"
                style={{
                  color: "#87867f",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                }}
              >
                {v.src}
              </p>
            </div>
            <span style={{ color: "#87867f", fontFamily: "var(--font-mono)", fontSize: "10px" }}>
              {v.time} ago
            </span>
          </div>
        ))}
      </div>

      <FooterLine label="Pixel" value="Identity graph, US coverage" meta="Hundreds of millions of profiles" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 04 - Launch
// ---------------------------------------------------------------------------

function LaunchPane() {
  const channels = [
    { name: "Meta",   tag: "Instagram + Facebook",     budget: "$1,800", spent: "$742", pct: 41, impressions: "48.2k", status: "Live" },
    { name: "Google", tag: "Search + Performance Max", budget: "$1,400", spent: "$812", pct: 58, impressions: "6.3k",  status: "Live" },
    { name: "TikTok", tag: "Spark + In-feed",          budget: "$600",   spent: "$110", pct: 18, impressions: "22.8k", status: "Ramping" },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 04 &middot; LAUNCH</span>}
        right={
          <span>
            <strong style={{ color: "#141413", fontWeight: 500 }}>3</strong>{" "}
            <span style={{ color: "#87867f" }}>CHANNELS LIVE</span>
          </span>
        }
      />
      <p
        className="mt-3 mb-5"
        style={{
          color: "#141413",
          fontFamily: "var(--font-display)",
          fontSize: "22px",
          fontWeight: 500,
          lineHeight: 1.25,
        }}
      >
        Managed creative, real budgets, weekly reports
      </p>

      <div className="space-y-2.5">
        {channels.map((c) => (
          <div
            key={c.name}
            className="px-4 py-3.5"
            style={{
              boxShadow: "0 0 0 1px #f0eee6",
              borderRadius: "12px",
              backgroundColor: "#faf9f5",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                style={{
                  color: "#141413",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {c.name}
              </span>
              <span style={{ color: "#87867f", fontSize: "12px" }}>{c.tag}</span>
              <span className="flex-1" />
              <StatusPill label={c.status} tone={c.status === "Live" ? "ok" : "warn"} />
            </div>
            <div
              className="mt-2.5 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "#f0eee6" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${c.pct}%`,
                  backgroundColor: "#2F6FE5",
                }}
              />
            </div>
            <div
              className="mt-2.5 flex items-center justify-between"
              style={{
                color: "#87867f",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
              }}
            >
              <span>{c.spent} / {c.budget}</span>
              <span>{c.impressions} impressions this week</span>
            </div>
          </div>
        ))}
      </div>

      <FooterLine label="Spend" value="$3,800 this cycle" meta="Creative turn: 48 hrs" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function StepHeader({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span
        style={{
          color: "#87867f",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          fontWeight: 500,
        }}
      >
        {left}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.08em" }}>
        {right}
      </span>
    </div>
  );
}

function FooterLine({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div
      className="mt-5 flex items-center justify-between"
      style={{
        paddingTop: "14px",
        borderTop: "1px dashed #e8e6dc",
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        color: "#87867f",
      }}
    >
      <span>
        <span>{label}: </span>
        <span style={{ color: "#4d4c48" }}>{value}</span>
      </span>
      <span>{meta}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "#3a7d44" : tone === "warn" ? "#b8860b" : "#87867f";
  const bg   = tone === "ok" ? "rgba(58,125,68,0.10)" : tone === "warn" ? "rgba(184,134,11,0.10)" : "#f0eee6";
  return (
    <span
      className="inline-block rounded-full"
      style={{
        color,
        backgroundColor: bg,
        border: `1px solid ${color}33`,
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        padding: "1px 8px",
        letterSpacing: "0.08em",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block w-9 h-5 rounded-full relative"
      style={{
        backgroundColor: on ? "#2F6FE5" : "#d1cfc5",
        transition: "background-color 0.2s ease",
      }}
    >
      <span
        className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
        style={{
          left: on ? "18px" : "2px",
          transition: "left 0.2s ease",
        }}
      />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ animation: "rei-spin 0.9s linear infinite" }}>
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M5 1.5a3.5 3.5 0 0 1 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <style jsx>{`@keyframes rei-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}
