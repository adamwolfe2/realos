"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  LayoutDashboard,
  MessageSquare,
  Rocket,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey =
  | "overview"
  | "onboarding"
  | "traffic"
  | "leads"
  | "ads"
  | "chatbot"
  | "knowledge-base"
  | "reputation"
  | "occupancy"
  | "residents"
  | "renewals"
  | "work-orders";

type GroupKey = "overview" | "marketing" | "leasing" | "operations";

type TabDefinition = {
  id: TabKey;
  label: string;
  icon: LucideIcon;
  group: GroupKey;
};

const TABS: TabDefinition[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, group: "overview" },
  { id: "leads", label: "Leads", icon: Users, group: "marketing" },
  { id: "traffic", label: "Traffic", icon: TrendingUp, group: "marketing" },
  { id: "ads", label: "Ads", icon: BarChart3, group: "marketing" },
  { id: "chatbot", label: "Chatbot", icon: MessageSquare, group: "marketing" },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen, group: "marketing" },
  { id: "reputation", label: "Reputation", icon: Star, group: "marketing" },
  { id: "residents", label: "Residents", icon: UserCheck, group: "leasing" },
  { id: "renewals", label: "Renewals", icon: CalendarClock, group: "leasing" },
  { id: "occupancy", label: "Occupancy", icon: Building2, group: "leasing" },
  { id: "onboarding", label: "Setup", icon: Rocket, group: "operations" },
  { id: "work-orders", label: "Work Orders", icon: Wrench, group: "operations" },
];

const GROUPS: Array<{ id: GroupKey; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "marketing", label: "Marketing" },
  { id: "leasing", label: "Leasing" },
  { id: "operations", label: "Operations" },
];

const TAB_TO_GROUP = Object.fromEntries(
  TABS.map((tab) => [tab.id, tab.group]),
) as Record<TabKey, GroupKey>;

function PropertyTabsInner({
  initialTab,
  showOccupancy,
  showAds,
  panels,
}: {
  initialTab: string;
  showOccupancy: boolean;
  showAds: boolean;
  panels: Partial<Record<TabKey, React.ReactNode>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = TABS.some((tab) => tab.id === initialTab)
    ? (initialTab as TabKey)
    : "overview";
  const [active, setActive] = React.useState<TabKey>(requestedTab);

  React.useEffect(() => {
    const requested = searchParams?.get("tab") ?? "overview";
    setActive(
      TABS.some((tab) => tab.id === requested)
        ? (requested as TabKey)
        : "overview",
    );
  }, [searchParams]);

  const visibleTabs = React.useMemo(
    () =>
      TABS.filter(
        (tab) =>
          (tab.id !== "ads" || showAds) &&
          (tab.id !== "occupancy" || showOccupancy),
      ),
    [showAds, showOccupancy],
  );
  const effectiveActive = visibleTabs.some((tab) => tab.id === active)
    ? active
    : "overview";
  const activeGroup = TAB_TO_GROUP[effectiveActive];
  const groupTabs = visibleTabs.filter((tab) => tab.group === activeGroup);

  const selectTab = React.useCallback(
    (key: TabKey) => {
      setActive(key);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (key === "overview") params.delete("tab");
      else params.set("tab", key);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      <div>
        {/* Level 1 — page-level section nav. Underline idiom, matching
            app/portal/seo/seo-tabs.tsx. The portal reserves the filled
            bg-primary treatment for segmented controls *inside* a card
            (components/portal/ui/tabbed-card.tsx); using it here made the
            property page read as a different product. */}
        <nav
          aria-label="Property section groups"
          className="flex gap-0.5 overflow-x-auto border-b border-border scrollbar-hide"
        >
          {GROUPS.map((group) => {
            const firstTab = visibleTabs.find((tab) => tab.group === group.id);
            if (!firstTab) return null;
            const isActive = group.id === activeGroup;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => selectTab(firstTab.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center px-3 text-[13px] font-medium",
                  "relative -mb-px border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {group.label}
              </button>
            );
          })}
        </nav>

        {groupTabs.length > 1 ? (
          <nav
            aria-label={`${GROUPS.find((group) => group.id === activeGroup)?.label} sections`}
            className="flex gap-0.5 overflow-x-auto pt-2.5 scrollbar-hide"
          >
            {groupTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = tab.id === effectiveActive;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    // Type matches .ls-eyebrow (mono 10px/600/0.12em). Set as
                    // utilities, not the class: .ls-eyebrow is defined after
                    // Tailwind in globals.css and its colour would win over
                    // the active/inactive state colour.
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[2px] px-2.5 py-1",
                    "ls-eyebrow",
                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        ) : null}
      </div>

      <div role="tabpanel">{panels[effectiveActive]}</div>
    </div>
  );
}

export function PropertyTabs(
  props: React.ComponentProps<typeof PropertyTabsInner>,
) {
  return (
    <Suspense fallback={<div className="h-10 animate-pulse bg-muted" />}>
      <PropertyTabsInner {...props} />
    </Suspense>
  );
}
