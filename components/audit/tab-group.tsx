"use client";

import * as React from "react";
import { T } from "@/components/audit/section";

// ---------------------------------------------------------------------------
// TabGroup (2026-08-19) — one panel at a time, all options visible.
//
// Replaces two stacked-card lists in the report. Stacking made a reader
// scroll past everything to find the one thing they cared about, and the
// severity-coloured top border on each card read as generated filler
// rather than a considered layout (Adam 2026-08-19).
//
// Panels are composed on the server and handed over as ReactNode, so the
// client bundle carries selection state and nothing else. Every panel
// stays mounted and is hidden with `hidden` — switching tabs never
// re-runs an animation or loses scroll position, and the full text of
// every tab is present for Cmd-F and for crawlers.
// ---------------------------------------------------------------------------

export type Tab = {
  id: string;
  label: string;
  /** Brand mark or icon rendered before the label. */
  icon?: React.ReactNode;
  /** Optional count/status shown after the label. */
  badge?: React.ReactNode;
  panel: React.ReactNode;
};

export function TabGroup({
  tabs,
  ariaLabel,
}: {
  tabs: Tab[];
  ariaLabel: string;
}) {
  const [active, setActive] = React.useState(0);
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  if (tabs.length === 0) return null;

  // Roving focus: arrow keys move between tabs, per the WAI-ARIA tabs
  // pattern. Without it a keyboard user is stuck on tab one.
  function onKeyDown(e: React.KeyboardEvent) {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div>
      <style>{`
        .tabg-btn { transition: color .18s ease, background-color .18s ease, border-color .18s ease; }
        @keyframes tabg-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .tabg-panel { animation: tabg-in .28s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .tabg-btn { transition: none; }
          .tabg-panel { animation: none; }
        }
      `}</style>

      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-2"
      >
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className="tabg-btn inline-flex h-9 items-center gap-2 px-3.5 text-[13px] font-medium"
              style={{
                backgroundColor: on ? T.accent : "#FFFFFF",
                color: on ? "#FFFFFF" : T.ink,
                border: `1px solid ${on ? T.accent : T.rule}`,
                borderRadius: 999,
              }}
            >
              {t.icon ? (
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center"
                  style={{
                    width: 15,
                    height: 15,
                    // Multi-colour brand marks need tinting to stay legible
                    // on the saturated active fill.
                    filter: on ? "brightness(0) invert(1)" : "none",
                  }}
                >
                  {t.icon}
                </span>
              ) : null}
              <span>{t.label}</span>
              {t.badge != null ? (
                <span
                  className="tabular-nums text-[12px]"
                  style={{
                    color: on ? "rgba(255,255,255,0.82)" : T.muted,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tabs.map((t, i) => (
          <div
            key={t.id}
            id={`panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            hidden={i !== active}
            className={i === active ? "tabg-panel" : undefined}
          >
            {t.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
