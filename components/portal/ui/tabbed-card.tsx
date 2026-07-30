"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// TabbedCard — generic "one card, N tabbed views" shell. Styling copied from
// app/portal/chatbot/performance-panel.tsx (Adam, 2026-07-29: "more views,
// not more page"). All tab panels render into the DOM; inactive ones are
// hidden with the `hidden` attribute rather than unmounted, since panel
// content is server-rendered ReactNode passed in from the parent.
// ---------------------------------------------------------------------------

export function TabbedCard({
  title,
  tabs,
  minHeightClass = "min-h-[360px]",
}: {
  title: string;
  tabs: Array<{
    key: string;
    label: string;
    description?: string;
    content: React.ReactNode;
  }>;
  minHeightClass?: string;
}) {
  const [active, setActive] = React.useState(tabs[0]?.key);
  const activeTab = tabs.find((t) => t.key === active) ?? tabs[0];
  // Instance-scoped id prefix so two TabbedCards on one page can't emit
  // duplicate DOM ids (breaks aria-controls/labelledby silently).
  const uid = React.useId();

  return (
    <section className="ls-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
          {activeTab?.description ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTab.description}
            </p>
          ) : null}
        </div>
        <div
          role="tablist"
          aria-label={title}
          className="inline-flex rounded-[2px] border border-border overflow-hidden"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              id={`${uid}-tab-${t.key}`}
              role="tab"
              aria-selected={active === t.key}
              aria-controls={`${uid}-panel-${t.key}`}
              onClick={() => setActive(t.key)}
              className={`px-3.5 py-1.5 text-[12px] font-semibold transition-colors border-r border-border last:border-r-0 ${
                active === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={minHeightClass}>
        {tabs.map((t) => (
          <div
            key={t.key}
            role="tabpanel"
            id={`${uid}-panel-${t.key}`}
            aria-labelledby={`${uid}-tab-${t.key}`}
            hidden={active !== t.key}
          >
            {t.content}
          </div>
        ))}
      </div>
    </section>
  );
}
