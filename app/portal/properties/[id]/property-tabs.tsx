"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type PanelKey =
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

// No tabs (Adam 2026-10-28: tabs and sub-tabs were overwhelming). The
// property page shows the "at a glance" cards (one per area, with the logos
// of the tools behind it) above the overview. A card opens that one area on
// its own via ?tab=..., with a link back. Old deep links (?tab=traffic,
// ?tab=knowledge-base) open the area that contains them.
const AREAS: Array<{ id: string; title: string; panels: PanelKey[] }> = [
  { id: "leads", title: "Leads", panels: ["leads"] },
  { id: "chatbot", title: "Chatbot", panels: ["chatbot", "knowledge-base"] },
  { id: "marketing", title: "Marketing", panels: ["traffic", "ads", "reputation"] },
  { id: "residents", title: "Residents", panels: ["occupancy", "residents", "renewals", "work-orders"] },
  { id: "onboarding", title: "Setup", panels: ["onboarding"] },
];

function PropertySectionsInner({
  showOccupancy,
  showAds,
  panels,
  glance,
  propertyName,
}: {
  initialTab?: string;
  showOccupancy: boolean;
  showAds: boolean;
  panels: Partial<Record<PanelKey, React.ReactNode>>;
  glance: React.ReactNode;
  propertyName: string;
}) {
  const pathname = usePathname();
  const requested = useSearchParams()?.get("tab");
  const area = AREAS.find((a) => a.id === requested || a.panels.includes(requested as PanelKey));
  const shown = (key: PanelKey) =>
    panels[key] != null && (key !== "ads" || showAds) && (key !== "occupancy" || showOccupancy);

  React.useEffect(() => {
    if (requested && area && requested !== area.id) {
      document.getElementById(requested)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [requested, area]);

  if (!area) {
    return (
      <div className="space-y-8">
        {glance}
        {panels.overview}
      </div>
    );
  }

  const keys = area.panels.filter(shown);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[13px]">
        <Link href={pathname ?? "#"} className="text-muted-foreground hover:text-foreground">
          {propertyName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{area.title}</span>
      </div>
      {keys.map((k) => (
        <div key={k} id={k} className="scroll-mt-6 space-y-3">
          {keys.length > 1 ? (
            <h2 className="text-[15px] font-semibold text-foreground">
              {k === "knowledge-base" ? "Knowledge base" : k === "work-orders" ? "Work orders" : k.charAt(0).toUpperCase() + k.slice(1)}
            </h2>
          ) : null}
          {panels[k]}
        </div>
      ))}
    </div>
  );
}

export function PropertyTabs(
  props: React.ComponentProps<typeof PropertySectionsInner>,
) {
  return (
    <Suspense fallback={<div className="h-10 animate-pulse bg-muted" />}>
      <PropertySectionsInner {...props} />
    </Suspense>
  );
}
