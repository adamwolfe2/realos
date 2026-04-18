"use client";

import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// HeroDemo
// Auto-advancing 4-step walkthrough: IMPORT -> BUILD -> ATTACH -> LAUNCH.
// Each step shows a distinct mock UI so operators can SEE the platform doing
// the thing, not read a paragraph about it.
// Click a tab to jump; otherwise advances every 4.2s.
// ---------------------------------------------------------------------------

type StepKey = "import" | "build" | "attach" | "launch";

const STEPS: { key: StepKey; num: string; title: string }[] = [
  { key: "import", num: "01", title: "IMPORT" },
  { key: "build", num: "02", title: "BUILD" },
  { key: "attach", num: "03", title: "ATTACH" },
  { key: "launch", num: "04", title: "LAUNCH" },
];

const AUTO_MS = 4200;

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
      className="w-full bg-white"
      style={{
        border: "1px solid var(--border-strong)",
        borderRadius: "12px",
        overflow: "hidden",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="grid grid-cols-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {STEPS.map((s, i) => {
          const isActive = s.key === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className="relative px-3 py-3 text-left transition-colors"
              style={{
                backgroundColor: isActive ? "var(--blue-light)" : "transparent",
                borderRight:
                  i < STEPS.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            >
              <span
                className="font-mono text-[10px] block"
                style={{
                  color: isActive ? "var(--blue)" : "var(--text-muted)",
                  letterSpacing: "0.12em",
                }}
              >
                {s.num}
              </span>
              <span
                className="font-mono text-[11px] font-semibold block mt-0.5"
                style={{
                  color: isActive ? "var(--blue)" : "var(--text-headline)",
                  letterSpacing: "0.06em",
                }}
              >
                {s.title}
              </span>
              {isActive && (
                <span
                  className="absolute left-0 right-0 bottom-[-1px] h-[2px]"
                  style={{ backgroundColor: "var(--blue)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-5 min-h-[372px]">
        {active === "import" && <ImportPane />}
        {active === "build" && <BuildPane />}
        {active === "attach" && <AttachPane />}
        {active === "launch" && <LaunchPane />}
      </div>

      <div
        className="px-5 py-3 flex items-center gap-4"
        style={{
          borderTop: "1px solid var(--border)",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--blue)" }}
        />
        <span
          className="font-mono text-[10px] flex-1"
          style={{
            color: "var(--text-muted)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Live demo, auto-advances, click any tab to jump
        </span>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <span
              key={s.key}
              className="block h-[3px] rounded-full transition-all"
              style={{
                width: i === activeIdx ? "24px" : "10px",
                backgroundColor:
                  i === activeIdx ? "var(--blue)" : "var(--border-strong)",
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
// Fakes a unit-sync table with a progress-filled row count.
// ---------------------------------------------------------------------------

function ImportPane() {
  const rows = useMemo(
    () => [
      { unit: "214", bed: "Studio",  rent: "$1,995", status: "Available",  sync: "synced" as const },
      { unit: "308", bed: "1 Bed",   rent: "$2,350", status: "Available",  sync: "synced" as const },
      { unit: "411", bed: "2 Bed",   rent: "$3,100", status: "Notice",     sync: "synced" as const },
      { unit: "512", bed: "2 Bed",   rent: "$3,200", status: "Occupied",   sync: "synced" as const },
      { unit: "604", bed: "3 Bed",   rent: "$4,150", status: "Available",  sync: "syncing" as const },
    ],
    []
  );

  return (
    <div>
      <StepHeader
        left={<span>STEP 01 &middot; IMPORT</span>}
        right={
          <span>
            <strong style={{ color: "var(--text-headline)" }}>86 / 86</strong>{" "}
            <span style={{ color: "var(--text-muted)" }}>UNITS</span>
          </span>
        }
      />
      <p
        className="font-serif text-[20px] mt-2 mb-4"
        style={{ color: "var(--text-headline)" }}
      >
        Pulling live inventory from AppFolio
      </p>

      <div
        className="rounded"
        style={{ border: "1px solid var(--border)" }}
      >
        <div
          className="grid grid-cols-[60px_1fr_70px_90px_80px] gap-2 px-3 py-2 font-mono text-[10px]"
          style={{
            color: "var(--text-muted)",
            backgroundColor: "var(--bg-primary)",
            borderBottom: "1px solid var(--border)",
            letterSpacing: "0.08em",
          }}
        >
          <span>UNIT</span>
          <span>BEDS</span>
          <span>RENT</span>
          <span>STATUS</span>
          <span>SYNC</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.unit}
            className="grid grid-cols-[60px_1fr_70px_90px_80px] gap-2 px-3 py-2.5 items-center font-mono text-[11px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span style={{ color: "var(--text-headline)" }}>{r.unit}</span>
            <span style={{ color: "var(--text-body)" }}>{r.bed}</span>
            <span style={{ color: "var(--text-headline)" }}>{r.rent}</span>
            <span>
              <StatusPill
                label={r.status}
                tone={
                  r.status === "Available"
                    ? "ok"
                    : r.status === "Notice"
                    ? "warn"
                    : "muted"
                }
              />
            </span>
            <span>
              {r.sync === "synced" ? (
                <span
                  className="inline-flex items-center gap-1 text-[10px]"
                  style={{ color: "var(--color-success)" }}
                >
                  <CheckIcon /> Synced
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[10px]"
                  style={{ color: "var(--blue)" }}
                >
                  <Spinner /> Syncing
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <FooterLine
        label="Source"
        value="AppFolio Property Manager"
        meta="Refresh every 15 min"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 02 - Build the site
// Wireframe-style block editor with draggable-looking rows.
// ---------------------------------------------------------------------------

function BuildPane() {
  const blocks = [
    { icon: "H", name: "Hero", meta: "Photo + headline + CTA", on: true },
    { icon: "P", name: "Floor plans", meta: "Auto-sync from AppFolio", on: true },
    { icon: "A", name: "Amenities", meta: "12 items, 6 icons", on: true },
    { icon: "M", name: "Map + neighborhood", meta: "5 categories pinned", on: true },
    { icon: "F", name: "FAQ + parents", meta: "Tenant-specific", on: true },
    { icon: "C", name: "Contact + tour", meta: "Cal.com embed", on: true },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 02 &middot; BUILD</span>}
        right={
          <span>
            <strong style={{ color: "var(--text-headline)" }}>6</strong>{" "}
            <span style={{ color: "var(--text-muted)" }}>BLOCKS ACTIVE</span>
          </span>
        }
      />
      <p
        className="font-serif text-[20px] mt-2 mb-4"
        style={{ color: "var(--text-headline)" }}
      >
        Page blocks on your domain
      </p>

      <div
        className="rounded"
        style={{ border: "1px solid var(--border)" }}
      >
        {blocks.map((b, i) => (
          <div
            key={b.name}
            className="flex items-center gap-3 px-3 py-2.5"
            style={{
              borderBottom:
                i < blocks.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 rounded font-serif text-[13px]"
              style={{
                border: "1px solid var(--border-strong)",
                color: "var(--text-headline)",
                backgroundColor: "var(--bg-primary)",
              }}
            >
              {b.icon}
            </span>
            <span
              className="font-serif text-[14px] flex-1"
              style={{ color: "var(--text-headline)" }}
            >
              {b.name}
            </span>
            <span
              className="font-mono text-[10px] hidden sm:inline"
              style={{ color: "var(--text-muted)" }}
            >
              {b.meta}
            </span>
            <Toggle on={b.on} />
          </div>
        ))}
      </div>

      <FooterLine label="Domain" value="occupant.telegraphcommons.com" meta="SSL active" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 03 - Attach pixel
// Visitor reveal: shows anonymous count ticking up, then a resolved lead.
// ---------------------------------------------------------------------------

function AttachPane() {
  const visitors = [
    { initials: "MR", name: "Maya R.",        univ: "UC Berkeley",    kind: "Resolved" as const, time: "2 min ago" },
    { initials: "?",  name: "Anonymous",      univ: "Bay Area IP",    kind: "Unresolved" as const, time: "4 min ago" },
    { initials: "DL", name: "Daniel L.",      univ: "UC Berkeley",    kind: "Resolved" as const, time: "9 min ago" },
    { initials: "SK", name: "Sophie K.",      univ: "Stanford parent",kind: "Resolved" as const, time: "12 min ago" },
    { initials: "?",  name: "Anonymous",      univ: "Oakland IP",     kind: "Unresolved" as const, time: "15 min ago" },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 03 &middot; ATTACH</span>}
        right={
          <span>
            <strong style={{ color: "var(--text-headline)" }}>95%</strong>{" "}
            <span style={{ color: "var(--text-muted)" }}>RESOLVE RATE</span>
          </span>
        }
      />
      <p
        className="font-serif text-[20px] mt-2 mb-4"
        style={{ color: "var(--text-headline)" }}
      >
        Naming the 95% of visitors who don't fill a form
      </p>

      <div
        className="rounded"
        style={{ border: "1px solid var(--border)" }}
      >
        {visitors.map((v, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2.5"
            style={{
              borderBottom:
                i < visitors.length - 1 ? "1px solid var(--border)" : "none",
              opacity: v.kind === "Unresolved" ? 0.55 : 1,
            }}
          >
            <span
              className="flex items-center justify-center w-8 h-8 rounded-full font-mono text-[10px]"
              style={{
                backgroundColor:
                  v.kind === "Resolved" ? "var(--blue-light)" : "var(--border)",
                color:
                  v.kind === "Resolved" ? "var(--blue)" : "var(--text-muted)",
              }}
            >
              {v.initials}
            </span>
            <div className="flex-1 min-w-0">
              <p
                className="font-serif text-[13px] truncate"
                style={{ color: "var(--text-headline)" }}
              >
                {v.name}
              </p>
              <p
                className="font-mono text-[10px] truncate"
                style={{ color: "var(--text-muted)" }}
              >
                {v.univ}
              </p>
            </div>
            <span className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
              {v.time}
            </span>
          </div>
        ))}
      </div>

      <FooterLine
        label="Pixel"
        value="Cursive identity graph"
        meta="450M U.S. profiles"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 04 - Launch ads
// Channel cards with budget + status + live impressions ticker.
// ---------------------------------------------------------------------------

function LaunchPane() {
  const channels = [
    {
      name: "Meta",
      tag: "Instagram + Facebook",
      budget: "$1,800",
      spent: "$742",
      pct: 41,
      impressions: "48.2k",
      status: "Live",
    },
    {
      name: "Google",
      tag: "Search + Performance Max",
      budget: "$1,400",
      spent: "$812",
      pct: 58,
      impressions: "6.3k",
      status: "Live",
    },
    {
      name: "TikTok",
      tag: "Spark + In-feed",
      budget: "$600",
      spent: "$110",
      pct: 18,
      impressions: "22.8k",
      status: "Ramping",
    },
  ];

  return (
    <div>
      <StepHeader
        left={<span>STEP 04 &middot; LAUNCH</span>}
        right={
          <span>
            <strong style={{ color: "var(--text-headline)" }}>3</strong>{" "}
            <span style={{ color: "var(--text-muted)" }}>CHANNELS LIVE</span>
          </span>
        }
      />
      <p
        className="font-serif text-[20px] mt-2 mb-4"
        style={{ color: "var(--text-headline)" }}
      >
        Managed creative, real budgets, weekly reports
      </p>

      <div className="space-y-2">
        {channels.map((c) => (
          <div
            key={c.name}
            className="px-3 py-3 rounded"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="font-serif text-[14px] font-semibold"
                style={{ color: "var(--text-headline)" }}
              >
                {c.name}
              </span>
              <span
                className="font-mono text-[10px]"
                style={{ color: "var(--text-muted)" }}
              >
                {c.tag}
              </span>
              <span className="flex-1" />
              <StatusPill label={c.status} tone={c.status === "Live" ? "ok" : "warn"} />
            </div>
            <div
              className="mt-2 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "var(--bg-primary)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${c.pct}%`,
                  backgroundColor: "var(--blue)",
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
              <span style={{ color: "var(--text-muted)" }}>
                {c.spent} / {c.budget}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {c.impressions} impressions this week
              </span>
            </div>
          </div>
        ))}
      </div>

      <FooterLine label="Spend" value="$3,800 this cycle" meta="Creative turn: 48 hrs" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function StepHeader({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-mono text-[10px]"
        style={{
          color: "var(--text-muted)",
          letterSpacing: "0.12em",
        }}
      >
        {left}
      </span>
      <span className="font-mono text-[10px]" style={{ letterSpacing: "0.08em" }}>
        {right}
      </span>
    </div>
  );
}

function FooterLine({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div
      className="mt-4 flex items-center justify-between font-mono text-[10px]"
      style={{
        color: "var(--text-muted)",
        paddingTop: "12px",
        borderTop: "1px dashed var(--border)",
        letterSpacing: "0.06em",
      }}
    >
      <span>
        <span style={{ color: "var(--text-muted)" }}>{label}: </span>
        <span style={{ color: "var(--text-headline)" }}>{value}</span>
      </span>
      <span>{meta}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "muted";
}) {
  const color =
    tone === "ok"
      ? "var(--color-success)"
      : tone === "warn"
      ? "var(--color-gold)"
      : "var(--text-muted)";
  const bg =
    tone === "ok"
      ? "#ECFDF5"
      : tone === "warn"
      ? "var(--color-gold-wash)"
      : "var(--bg-primary)";
  return (
    <span
      className="inline-block font-mono text-[9px] px-2 py-0.5 rounded-full"
      style={{
        color,
        backgroundColor: bg,
        border: `1px solid ${color}33`,
        letterSpacing: "0.08em",
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
        backgroundColor: on ? "var(--blue)" : "var(--border-strong)",
        transition: "background-color 0.15s ease",
      }}
    >
      <span
        className="absolute top-0.5 w-3 h-3 rounded-full bg-white"
        style={{
          left: on ? "16px" : "2px",
          transition: "left 0.15s ease",
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
      <circle
        cx="5"
        cy="5"
        r="3.5"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="1.5"
      />
      <path
        d="M5 1.5a3.5 3.5 0 0 1 3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <style jsx>{`
        @keyframes rei-spin {
          from { transform: rotate(0); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
