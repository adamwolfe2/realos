"use client";

import * as React from "react";

// ---------------------------------------------------------------------------
// ReportTabs
//
// Splits the 18-section weekly report into 5 cohesive tabs so the operator
// (and the client they share the report with) lands on a glanceable Overview
// instead of a 12-foot scroll. Tab state is mirrored to the URL hash so:
//
//   • refreshes preserve the active tab
//   • a shared link can deep-link to any tab (e.g. /r/<token>#reputation)
//   • the back/forward buttons navigate between tabs
//
// In print, the CSS in [id]/page.tsx + r/[token]/page.tsx forces every panel
// to render so PDFs include the full report regardless of active tab.
// ---------------------------------------------------------------------------

export const REPORT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "traffic", label: "Traffic & Leads" },
  { id: "operations", label: "Operations" },
  { id: "reputation", label: "Reputation" },
  { id: "insights", label: "Insights" },
] as const;

export type ReportTabId = (typeof REPORT_TABS)[number]["id"];

const KNOWN_TAB_IDS = new Set<ReportTabId>(REPORT_TABS.map((t) => t.id));

const TabsContext = React.createContext<{
  active: ReportTabId;
  setActive: (id: ReportTabId) => void;
}>({ active: "overview", setActive: () => {} });

export function ReportTabs({
  children,
  /**
   * When true the tab strip + panel hiding is suppressed and every panel
   * renders in its natural order. Used by the public share page if we ever
   * want a "no nav" layout. Defaults to false.
   */
  flat = false,
}: {
  children: React.ReactNode;
  flat?: boolean;
}) {
  const [active, setActive] = React.useState<ReportTabId>("overview");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);

    const readHash = () => {
      const raw = window.location.hash.replace(/^#/, "");
      if (KNOWN_TAB_IDS.has(raw as ReportTabId)) {
        setActive(raw as ReportTabId);
      }
    };
    readHash();

    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const selectTab = React.useCallback((id: ReportTabId) => {
    setActive(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  if (flat) {
    return (
      <TabsContext.Provider
        value={{ active, setActive: selectTab }}
      >
        {children}
      </TabsContext.Provider>
    );
  }

  return (
    <TabsContext.Provider value={{ active, setActive: selectTab }}>
      <div
        className="ls-report-tabs"
        data-active-tab={hydrated ? active : "overview"}
      >
        <nav
          data-no-print
          role="tablist"
          aria-label="Report sections"
          className="ls-report-tab-strip sticky top-0 z-10 flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 px-1.5 py-1.5 backdrop-blur"
        >
          {REPORT_TABS.map((t) => {
            const isActive = (hydrated ? active : "overview") === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`report-tab-panel-${t.id}`}
                onClick={() => selectTab(t.id)}
                className={
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors " +
                  (isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function ReportTabPanel({
  id,
  children,
}: {
  id: ReportTabId;
  children: React.ReactNode;
}) {
  const { active } = React.useContext(TabsContext);
  const isActive = active === id;
  return (
    <div
      role="tabpanel"
      id={`report-tab-panel-${id}`}
      data-tab-id={id}
      data-active={isActive ? "true" : "false"}
      className="ls-report-tabpanel space-y-3"
      // `hidden` is preferred over conditional render so all tabs are in
      // the DOM (print-safe, screen-reader-discoverable via tab nav).
      hidden={!isActive}
    >
      {children}
    </div>
  );
}
