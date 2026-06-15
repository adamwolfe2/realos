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
  Star,
  BookOpen,
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
  | "knowledge-base"
  | "reputation"
  | "occupancy"
  | "residents"
  | "renewals"
  | "work-orders";

type Category = {
  /** The category IS the tab — flat, one tab per nav item. */
  id: TabKey;
  label: string;
  icon: LucideIcon;
};

// Flat top-level tabs (2026-06-09): the prior two-level system buried
// Chatbot / Reputation / Traffic under Acquisition + Engagement pill
// sub-tabs, which operators couldn't find. Each is now its own primary
// tab. URL contract (?tab=X) is unchanged — every key still resolves.
const CATEGORIES: Category[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "traffic", label: "Traffic", icon: TrendingUp },
  { id: "ads", label: "Ads", icon: BarChart3 },
  { id: "chatbot", label: "Chatbot", icon: MessageSquare },
  { id: "knowledge-base", label: "Knowledge Base", icon: BookOpen },
  { id: "reputation", label: "Reputation", icon: Star },
];

// Map every TabKey → the top-level tab it belongs to. Visible tabs map to
// themselves; hidden Operations-group tabs (residents/renewals/occupancy/
// work-orders) + onboarding fall back to overview so deep links don't 404.
const TAB_TO_CATEGORY: Record<TabKey, TabKey> = {
  overview: "overview",
  onboarding: "overview",
  leads: "leads",
  traffic: "traffic",
  ads: "ads",
  chatbot: "chatbot",
  "knowledge-base": "knowledge-base",
  reputation: "reputation",
  residents: "overview",
  renewals: "overview",
  occupancy: "overview",
  "work-orders": "overview",
};

function PropertyTabsInner({
  initialTab,
  showOccupancy,
  showAds,
  panels,
}: {
  initialTab: string;
  showOccupancy: boolean;
  /** When both moduleGoogleAds and moduleMetaAds are off for the org we
   *  hide the Ads sub-tab entirely — an Acquisition group of "Leads ·
   *  Traffic · Ads(empty)" looks broken; "Leads · Traffic" reads clean. */
  showAds: boolean;
  panels: Partial<Record<TabKey, React.ReactNode>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Resolve the active tab from URL or fall back.
  const normalizedTab = React.useMemo<TabKey>(() => {
    const all = Object.keys(TAB_TO_CATEGORY) as TabKey[];
    return (
      all.includes(initialTab as TabKey) ? initialTab : "overview"
    ) as TabKey;
  }, [initialTab]);

  const [active, setActive] = React.useState<TabKey>(normalizedTab);

  React.useEffect(() => {
    const t = (searchParams?.get("tab") ?? "overview") as TabKey;
    const all = Object.keys(TAB_TO_CATEGORY) as TabKey[];
    setActive(all.includes(t) ? t : "overview");
  }, [searchParams]);

  // Hide the Ads tab when both ad modules are off org-wide — an empty Ads
  // tab reads as broken. showOccupancy is retained for API compatibility
  // with the (currently hidden) Operations tabs.
  void showOccupancy;
  const categories = React.useMemo<Category[]>(
    () => (showAds ? CATEGORIES : CATEGORIES.filter((c) => c.id !== "ads")),
    [showAds],
  );

  const activeCategoryId = TAB_TO_CATEGORY[active];

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
              onClick={() => selectTab(cat.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-foreground"
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

      {/* Panels — render ONLY the active panel. Bundle-analyzer pass
          (2026-06-04) revealed every panel was mounted simultaneously
          with `hidden={!isActive}`, shipping the JS for ScannerPanel
          + MetricsPanel (recharts donut) + every other tab even when
          the operator only ever sees Overview. Single-panel rendering
          drops the /portal/properties/[id] route bundle dramatically.
          Tradeoff: switching tabs is now a remount + re-fetch, which
          is fine because each tab's data is already URL-driven and
          server-cached at the page level. */}
      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}

export function PropertyTabs(
  props: React.ComponentProps<typeof PropertyTabsInner>,
) {
  return (
    <Suspense
      fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}
    >
      <PropertyTabsInner {...props} />
    </Suspense>
  );
}
