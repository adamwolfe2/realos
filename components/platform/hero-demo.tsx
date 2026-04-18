"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// HeroDemo (Tesla-compatible white-canvas)
// Auto-advancing 4-step walkthrough: IMPORT -> BUILD -> ATTACH -> LAUNCH.
// White surface with Light Ash stripes, Electric Blue for active tab and
// highlights. No shadows. 4px radii. 0.33s transitions.
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
        backgroundColor: "#FFFFFF",
        border: "1px solid #EEEEEE",
        borderRadius: "12px",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="grid grid-cols-4"
        style={{ borderBottom: "1px solid #EEEEEE" }}
      >
        {STEPS.map((s, i) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className="relative px-3 py-3 text-left"
              style={{
                backgroundColor: isActive ? "#FFFFFF" : "#F4F4F4",
                borderRight: i < STEPS.length - 1 ? "1px solid #EEEEEE" : "none",
                cursor: "pointer",
                transition: "background-color 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
              }}
            >
              <span
                className="block"
                style={{
                  color: isActive ? "#3E6AE1" : "#8E8E8E",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  fontWeight: 500,
                }}
              >
                {s.num}
              </span>
              <span
                className="block mt-0.5"
                style={{
                  color: isActive ? "#171A20" : "#5C5E62",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                }}
              >
                {s.title}
              </span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 bottom-[-1px] h-[2px]"
                  style={{ backgroundColor: "#3E6AE1" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-6 md:p-7 min-h-[400px]" style={{ backgroundColor: "#FFFFFF" }}>
        {active === "import" && <ImportPane />}
        {active === "build" && <BuildPane />}
        {active === "attach" && <AttachPane />}
        {active === "launch" && <LaunchPane />}
      </div>

      <div
        className="px-5 py-3 flex items-center gap-4"
        style={{
          borderTop: "1px solid #EEEEEE",
          backgroundColor: "#F4F4F4",
        }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "#3E6AE1" }}
        />
        <span
          className="flex-1"
          style={{
            color: "#8E8E8E",
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          Live demo, auto-advances, click any tab to jump
        </span>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className="block h-[3px] rounded-full"
              style={{
                width: i === activeIdx ? "24px" : "10px",
                backgroundColor: i === activeIdx ? "#3E6AE1" : "#D0D1D2",
                transition: "all 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
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
            <strong style={{ color: "#171A20", fontWeight: 500 }}>86 / 86</strong>{" "}
            <span style={{ color: "#8E8E8E" }}>UNITS</span>
          </span>
        }
      />
      <p
        className="mt-2 mb-4"
        style={{
          color: "#171A20",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
        }}
      >
        Pulling live inventory from AppFolio
      </p>

      <div
        className="overflow-hidden"
        style={{ border: "1px solid #EEEEEE", borderRadius: "4px" }}
      >
        <div
          className="grid grid-cols-[56px_1fr_72px_96px_80px] gap-2 px-3 py-2"
          style={{
            backgroundColor: "#F4F4F4",
            borderBottom: "1px solid #EEEEEE",
            color: "#8E8E8E",
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
            className="grid grid-cols-[56px_1fr_72px_96px_80px] gap-2 px-3 py-2.5 items-center"
            style={{
              borderBottom: i < rows.length - 1 ? "1px solid #EEEEEE" : "none",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            }}
          >
            <span style={{ color: "#171A20", fontWeight: 500 }}>{r.unit}</span>
            <span style={{ color: "#393C41" }}>{r.bed}</span>
            <span style={{ color: "#171A20", fontWeight: 500 }}>{r.rent}</span>
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
                  style={{
                    color: "#10b981",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                  }}
                >
                  <CheckIcon /> Synced
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1"
                  style={{
                    color: "#3E6AE1",
                    fontFamily: "var(--font-mono)",
                    fontSize: "10px",
                  }}
                >
                  <Spinner /> Syncing
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <FooterLine label="Source" value="AppFolio Property Manager" meta="Refresh every 15 min" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 02 - Build the site
// ---------------------------------------------------------------------------

function BuildPane() {
  const blocks = [
    { icon: "H", name: "Hero",               meta: "Photo + headline + CTA",  on: true },
    { icon: "P", name: "Floor plans",        meta: "Auto-sync from AppFolio", on: true },
    { icon: "A", name: "Amenities",          meta: "12 items, 6 icons",       on: true },
    { icon: "M", name: "Map + neighborhood", meta: "5 categories pinned",     on: true },
    { icon: "F", name: "FAQ + parents",      meta: "Tenant-specific",         on: true },
    { icon: "C", name: "Contact + tour",     meta: "Cal.com embed",           on: true },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 02 &middot; BUILD</span>}
        right={
          <span>
            <strong style={{ color: "#171A20", fontWeight: 500 }}>6</strong>{" "}
            <span style={{ color: "#8E8E8E" }}>BLOCKS ACTIVE</span>
          </span>
        }
      />
      <p
        className="mt-2 mb-4"
        style={{
          color: "#171A20",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
        }}
      >
        Page blocks on your domain
      </p>

      <div
        className="overflow-hidden"
        style={{ border: "1px solid #EEEEEE", borderRadius: "4px" }}
      >
        {blocks.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center gap-3 px-3 py-2.5"
            style={{
              borderBottom: i < blocks.length - 1 ? "1px solid #EEEEEE" : "none",
              backgroundColor: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
            }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded"
              style={{
                backgroundColor: "rgba(62,106,225,0.08)",
                color: "#3E6AE1",
                fontFamily: "var(--font-display)",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              {b.icon}
            </span>
            <span
              className="flex-1"
              style={{
                color: "#171A20",
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
                color: "#8E8E8E",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
              }}
            >
              {b.meta}
            </span>
            <Toggle on={b.on} />
          </div>
        ))}
      </div>

      <FooterLine label="Domain" value="telegraphcommons.com" meta="SSL active" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 03 - Attach pixel
// ---------------------------------------------------------------------------

function AttachPane() {
  const visitors = [
    { initials: "MR", name: "Maya R.",   univ: "UC Berkeley",     kind: "Resolved" as const,   time: "2m" },
    { initials: "?",  name: "Anonymous", univ: "Bay Area IP",     kind: "Unresolved" as const, time: "4m" },
    { initials: "DL", name: "Daniel L.", univ: "UC Berkeley",     kind: "Resolved" as const,   time: "9m" },
    { initials: "SK", name: "Sophie K.", univ: "Stanford parent", kind: "Resolved" as const,   time: "12m" },
    { initials: "?",  name: "Anonymous", univ: "Oakland IP",      kind: "Unresolved" as const, time: "15m" },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 03 &middot; ATTACH</span>}
        right={
          <span>
            <strong style={{ color: "#171A20", fontWeight: 500 }}>95%</strong>{" "}
            <span style={{ color: "#8E8E8E" }}>RESOLVE RATE</span>
          </span>
        }
      />
      <p
        className="mt-2 mb-4"
        style={{
          color: "#171A20",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
        }}
      >
        Naming the 95% who don't fill a form
      </p>

      <div
        className="overflow-hidden"
        style={{ border: "1px solid #EEEEEE", borderRadius: "4px" }}
      >
        {visitors.map((v, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5"
            style={{
              borderBottom: i < visitors.length - 1 ? "1px solid #EEEEEE" : "none",
              opacity: v.kind === "Unresolved" ? 0.55 : 1,
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                backgroundColor:
                  v.kind === "Resolved" ? "rgba(62,106,225,0.12)" : "#F4F4F4",
                color: v.kind === "Resolved" ? "#3E6AE1" : "#8E8E8E",
                border: "1px solid #EEEEEE",
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
                  color: "#171A20",
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
                  color: "#8E8E8E",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                }}
              >
                {v.univ}
              </p>
            </div>
            <span
              style={{
                color: "#8E8E8E",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
              }}
            >
              {v.time} ago
            </span>
          </div>
        ))}
      </div>

      <FooterLine label="Pixel" value="Cursive identity graph" meta="450M US profiles" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 04 - Launch ads
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
            <strong style={{ color: "#171A20", fontWeight: 500 }}>3</strong>{" "}
            <span style={{ color: "#8E8E8E" }}>CHANNELS LIVE</span>
          </span>
        }
      />
      <p
        className="mt-2 mb-4"
        style={{
          color: "#171A20",
          fontFamily: "var(--font-display)",
          fontSize: "20px",
          fontWeight: 500,
        }}
      >
        Managed creative, real budgets, weekly reports
      </p>

      <div className="space-y-2">
        {channels.map((c) => (
          <div
            key={c.name}
            className="px-3 py-3"
            style={{
              border: "1px solid #EEEEEE",
              borderRadius: "4px",
              backgroundColor: "#FFFFFF",
            }}
          >
            <div className="flex items-center gap-2">
              <span
                style={{
                  color: "#171A20",
                  fontFamily: "var(--font-sans)",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {c.name}
              </span>
              <span style={{ color: "#8E8E8E", fontSize: "12px" }}>{c.tag}</span>
              <span className="flex-1" />
              <StatusPill label={c.status} tone={c.status === "Live" ? "ok" : "warn"} />
            </div>
            <div
              className="mt-2 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: "#EEEEEE" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${c.pct}%`, backgroundColor: "#3E6AE1" }}
              />
            </div>
            <div
              className="mt-2 flex items-center justify-between"
              style={{
                color: "#8E8E8E",
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
          color: "#8E8E8E",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.14em",
          fontWeight: 500,
        }}
      >
        {left}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.08em",
        }}
      >
        {right}
      </span>
    </div>
  );
}

function FooterLine({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <div
      className="mt-4 flex items-center justify-between"
      style={{
        paddingTop: "12px",
        borderTop: "1px dashed #EEEEEE",
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        color: "#8E8E8E",
      }}
    >
      <span>
        <span>{label}: </span>
        <span style={{ color: "#393C41" }}>{value}</span>
      </span>
      <span>{meta}</span>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "#10b981" : tone === "warn" ? "#B8860B" : "#8E8E8E";
  const bg   = tone === "ok" ? "rgba(16,185,129,0.08)" : tone === "warn" ? "rgba(184,134,11,0.08)" : "#F4F4F4";
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
      className="inline-block w-8 h-4 rounded-full relative"
      style={{
        backgroundColor: on ? "#3E6AE1" : "#D0D1D2",
        transition: "background-color 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
      }}
    >
      <span
        className="absolute top-0.5 w-3 h-3 rounded-full bg-white"
        style={{
          left: on ? "16px" : "2px",
          transition: "left 0.33s cubic-bezier(0.5, 0, 0, 0.75)",
        }}
      />
    </span>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path
        d="M1.5 5L4 7.5L8.5 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      style={{ animation: "rei-spin 0.9s linear infinite" }}
    >
      <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1.5" />
      <path d="M5 1.5a3.5 3.5 0 0 1 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <style jsx>{`
        @keyframes rei-spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
