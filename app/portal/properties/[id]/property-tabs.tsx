"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  LayoutDashboard,
  Megaphone,
  Sparkles,
  Wrench,
  TrendingUp,
  Users,
  BarChart3,
  MessageSquare,
  Star,
  Building2,
  Home,
  CalendarClock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PropertyTabs — restructured from a flat 10-tab nav into a two-level
// category system. Primary tabs (Overview / Acquisition / Engagement /
// Operations) compress the navigation surface from 10 items to 4. The
// underlying panels are unchanged; secondary sub-tabs appear under the
// active primary when the category has multiple children.
//
// URL contract preserved: ?tab=X still works for every existing key. The
// category for a given tab is looked up from CATEGORIES.
// ---------------------------------------------------------------------------

type TabKey =
  | "overview"
  | "onboarding"
  | "traffic"
  | "leads"
  | "ads"
  | "chatbot"
  | "reputation"
  | "occupancy"
  | "residents"
  | "renewals"
  | "work-orders";

type SubTab = { key: TabKey; label: string; icon: LucideIcon };

type Category = {
  id: "overview" | "acquisition" | "engagement" | "operations";
  label: string;
  icon: LucideIcon;
  /** First tab a click on the primary lands on. */
  defaultTab: TabKey;
  /** Sub-tabs that render under the active primary. Empty array means the
      primary has no sub-nav (Overview). */
  subs: SubTab[];
};

const CATEGORIES: Category[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    defaultTab: "overview",
    subs: [],
  },
  {
    id: "acquisition",
    label: "Acquisition",
    icon: Megaphone,
    defaultTab: "leads",
    subs: [
      { key: "leads",   label: "Leads",   icon: Users },
      { key: "traffic", label: "Traffic", icon: TrendingUp },
      { key: "ads",     label: "Ads",     icon: BarChart3 },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    icon: Sparkles,
    defaultTab: "chatbot",
    subs: [
      { key: "chatbot",    label: "Chatbot",    icon: MessageSquare },
      { key: "reputation", label: "Reputation", icon: Star },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Wrench,
    defaultTab: "residents",
    subs: [
      { key: "residents", label: "Residents", icon: Home },
      { key: "renewals",  label: "Renewals",  icon: CalendarClock },
      { key: "occupancy", label: "Occupancy", icon: Building2 },
    ],
  },
];

// Map every TabKey → category id for quick lookup when ?tab= is set.
const TAB_TO_CATEGORY: Record<TabKey, Category["id"]> = {
  overview:     "overview",
  onboarding:   "overview", // Onboarding panel lives under Overview now.
  leads:        "acquisition",
  traffic:      "acquisition",
  ads:          "acquisition",
  chatbot:      "engagement",
  reputation:   "engagement",
  residents:    "operations",
  renewals:     "operations",
  occupancy:    "operations",
  "work-orders": "operations",
};

function PropertyTabsInner({
  initialTab,
  showOccupancy,
  panels,
}: {
  initialTab: string;
  showOccupancy: boolean;
  panels: Partial<Record<TabKey, React.ReactNode>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve the active tab from URL or fall back.
  const normalizedTab = React.useMemo<TabKey>(() => {
    const all = Object.keys(TAB_TO_CATEGORY) as TabKey[];
    return (all.includes(initialTab as TabKey) ? initialTab : "overview") as TabKey;
  }, [initialTab]);

  const [active, setActive] = React.useState<TabKey>(normalizedTab);

  React.useEffect(() => {
    const t = (searchParams?.get("tab") ?? "overview") as TabKey;
    const all = Object.keys(TAB_TO_CATEGORY) as TabKey[];
    setActive(all.includes(t) ? t : "overview");
  }, [searchParams]);

  // Drop occupancy sub from the operations category when no units configured.
  const categories = React.useMemo<Category[]>(() => {
    return CATEGORIES.map((cat) => {
      if (cat.id !== "operations") return cat;
      return {
        ...cat,
        subs: showOccupancy
          ? cat.subs
          : cat.subs.filter((s) => s.key !== "occupancy"),
      };
    });
  }, [showOccupancy]);

  const activeCategoryId = TAB_TO_CATEGORY[active];
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? categories[0];
  const subs = activeCategory.subs;

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

  const selectCategory = (cat: Category) => {
    selectTab(cat.defaultTab);
  };

  return (
    <div className="space-y-4">
      {/* Primary nav — 4 categories. Single visual element. */}
      <nav
        aria-label="Property sections"
        className="flex flex-nowrap gap-1 border-b border-border overflow-x-auto scrollbar-hide"
      >
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = cat.id === activeCategoryId;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => selectCategory(cat)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {cat.label}
            </button>
          );
        })}
      </nav>

      {/* Secondary nav — sub-tabs for the active category. Hidden when the
          category has no sub-nav (Overview). */}
      {subs.length > 0 ? (
        <nav
          aria-label={`${activeCategory.label} subsections`}
          className="flex flex-nowrap gap-1 overflow-x-auto scrollbar-hide"
        >
          {subs.map((sub) => {
            const Icon = sub.icon;
            const isActive = active === sub.key;
            return (
              <button
                key={sub.key}
                type="button"
                onClick={() => selectTab(sub.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {sub.label}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* Panels — render every panel that was passed, hide non-active. */}
      <div>
        {(Object.keys(panels) as TabKey[]).map((tabKey) => {
          const isActive = active === tabKey;
          return (
            <div
              key={tabKey}
              role="tabpanel"
              hidden={!isActive}
              className={isActive ? undefined : "hidden"}
            >
              {panels[tabKey]}
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
