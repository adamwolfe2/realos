"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ClientTabs — converts the previously single-scroll admin client detail
// (3000+px) into a tabbed surface. Mirrors the proven property-tabs.tsx
// pattern: URL-resolved active tab (?tab=X), one-shot Suspense around
// useSearchParams, panels rendered hidden so server work isn't repeated on
// tab switch.
//
// URL contract:
//   no tab param            → overview
//   ?tab=properties|team|billing|activity → that tab
// ---------------------------------------------------------------------------

export type ClientTabKey =
  | "overview"
  | "properties"
  | "team"
  | "billing"
  | "activity";

export type ClientTabDef = {
  key: ClientTabKey;
  label: string;
  icon: LucideIcon;
};

function ClientTabsInner({
  initialTab,
  tabs,
  panels,
}: {
  initialTab: string;
  tabs: ClientTabDef[];
  panels: Partial<Record<ClientTabKey, React.ReactNode>>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const validKeys = React.useMemo(
    () => new Set(tabs.map((t) => t.key)),
    [tabs],
  );

  const normalized = React.useMemo<ClientTabKey>(() => {
    return validKeys.has(initialTab as ClientTabKey)
      ? (initialTab as ClientTabKey)
      : "overview";
  }, [initialTab, validKeys]);

  const [active, setActive] = React.useState<ClientTabKey>(normalized);

  React.useEffect(() => {
    const t = (searchParams?.get("tab") ?? "overview") as ClientTabKey;
    setActive(validKeys.has(t) ? t : "overview");
  }, [searchParams, validKeys]);

  const selectTab = (key: ClientTabKey) => {
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
    <div className="space-y-5">
      <nav
        aria-label="Client sections"
        className="flex flex-nowrap gap-1 border-b border-border overflow-x-auto scrollbar-hide"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div>
        {tabs.map((t) => {
          const isActive = active === t.key;
          const panel = panels[t.key];
          if (!panel) return null;
          return (
            <div
              key={t.key}
              role="tabpanel"
              hidden={!isActive}
              className={isActive ? undefined : "hidden"}
            >
              {panel}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ClientTabs(
  props: React.ComponentProps<typeof ClientTabsInner>,
) {
  return (
    <Suspense
      fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}
    >
      <ClientTabsInner {...props} />
    </Suspense>
  );
}
