"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightCard, type InsightCardData } from "./insight-card";

// ----------------------------------------------------------------------------
// RecommendationsDrawer — preserves the existing open-insights list (config
// items: "Connect GA4", "Draft counter-page", etc.) but tucks it behind a
// collapsible toggle below the heatmap. The headline insights surface above;
// these are useful-but-not-urgent housekeeping recommendations.
// ----------------------------------------------------------------------------

export function RecommendationsDrawer({
  insights,
  defaultOpen = false,
}: {
  insights: InsightCardData[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const count = insights.length;

  if (count === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-5 py-3 text-left",
          "hover:bg-secondary transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
        aria-expanded={open}
      >
        <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            {count} open recommendation{count === 1 ? "" : "s"}
          </div>
          <div className="text-xs text-muted-foreground">
            Housekeeping and config the platform suggests you tackle when you
            have a minute.
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open ? (
        <div className="border-t border-border p-4 sm:p-5 bg-secondary">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
