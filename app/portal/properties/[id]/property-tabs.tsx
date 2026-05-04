"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BarChart3,
  MessageSquare,
  Building2,
  Star,
  Home,
  CalendarClock,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyTabs
//
// Client tab switcher with URL param sync (?tab=traffic). Renders ALL tab
// panels but shows only the active one so tab switches don't remount or
// refetch. The individual panels are server components passed in from the
// page, so the initial render still streams data efficiently.
// ---------------------------------------------------------------------------

type TabKey =
  | "overview"
  | "traffic"
  | "leads"
  | "ads"
  | "chatbot"
  | "reputation"
  | "occupancy"
  | "residents"
  | "renewals"
  | "work-orders";

type TabDef = {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS_BASE: TabDef[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "traffic", label: "Traffic", icon: TrendingUp },
  { key: "leads", label: "Leads", icon: Users },
  { key: "ads", label: "Ads", icon: BarChart3 },
  { key: "chatbot", label: "Chatbot", icon: MessageSquare },
  { key: "reputation", label: "Reputation", icon: Star },
];

const OCCUPANCY_TAB: TabDef = {
  key: "occupancy",
  label: "Occupancy",
  icon: Building2,
};

const OPERATIONS_TABS: TabDef[] = [
  { key: "residents", label: "Residents", icon: Home },
  { key: "renewals", label: "Renewals", icon: CalendarClock },
  // Work orders tab intentionally removed per product decision.
];

function PropertyTabsInner({
  initialTab,
  showOccupancy,
  panels,
}: {
  initialTab: string;
  showOccupancy: boolean;
  panels: Record<TabKey, React.ReactNode>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = React.useMemo(
    () =>
      showOccupancy
        ? [...TABS_BASE, OCCUPANCY_TAB, ...OPERATIONS_TABS]
        : [...TABS_BASE, ...OPERATIONS_TABS],
    [showOccupancy],
  );

  const normalized = React.useMemo<TabKey>(() => {
    const lookup = tabs.find((t) => t.key === initialTab);
    return lookup ? lookup.key : "overview";
  }, [initialTab, tabs]);

  const [active, setActive] = React.useState<TabKey>(normalized);

  // Keep local state in sync with URL when the user navigates with
  // back/forward buttons.
  React.useEffect(() => {
    const t = searchParams?.get("tab") ?? "overview";
    const match = tabs.find((x) => x.key === t);
    const next = match ? match.key : "overview";
    setActive(next);
  }, [searchParams, tabs]);

  const selectTab = (key: TabKey) => {
    if (key === active) return;
    setActive(key);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (key === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", key);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <nav
        aria-label="Property sections"
        className="flex flex-nowrap gap-1 border-b border-border overflow-x-auto scrollbar-hide"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => selectTab(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 px-3 py-2.5 text-[13px] border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div>
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <div
              key={tab.key}
              role="tabpanel"
              hidden={!isActive}
              className={isActive ? undefined : "hidden"}
            >
              {panels[tab.key]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PropertyTabs(
  props: React.ComponentProps<typeof PropertyTabsInner>,
) {
  return (
    <Suspense fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}>
      <PropertyTabsInner {...props} />
    </Suspense>
  );
}
