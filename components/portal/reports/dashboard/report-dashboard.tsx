"use client";

import * as React from "react";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReportSnapshot } from "@/lib/reports/generate";
import { cn } from "@/lib/utils";
import {
  type PropertyMeta,
  periodLabel,
  addressLine,
} from "../snapshot-shared";
import { SECTIONS, type SectionId } from "./sections";

// ---------------------------------------------------------------------------
// ReportDashboard — the interactive Marketing & Performance Snapshot. An
// Overview top level plus a top row of tabs that drill into each domain
// (Acquisition, Traffic & SEO, Ads, Leasing & Occupancy, Renewals, Reputation,
// AI Visibility, Insights). Tabs whose data is absent are hidden so a new or
// thin tenant never sees an empty section. URL-driven via ?section=, single
// panel rendered at a time (mirrors the property-tabs pattern). The printable
// PropertyOnePager remains the PDF/export surface (rendered alongside on the
// page, print-only).
// ---------------------------------------------------------------------------

function DashboardInner({
  snapshot,
  property,
}: {
  snapshot: ReportSnapshot;
  property: PropertyMeta;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Only the sections with data (plus Overview) become tabs.
  const sections = React.useMemo(
    () => SECTIONS.filter((sec) => sec.available(snapshot)),
    [snapshot],
  );
  const ids = React.useMemo(() => sections.map((s) => s.id), [sections]);

  const resolve = React.useCallback(
    (raw: string | null | undefined): SectionId =>
      raw && (ids as string[]).includes(raw) ? (raw as SectionId) : "overview",
    [ids],
  );

  const [active, setActive] = React.useState<SectionId>(() =>
    resolve(searchParams?.get("section")),
  );

  React.useEffect(() => {
    setActive(resolve(searchParams?.get("section")));
  }, [searchParams, resolve]);

  const selectTab = (id: SectionId) => {
    if (id === active) return;
    setActive(id);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (id === "overview") params.delete("section");
    else params.set("section", id);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const activeSection = sections.find((s) => s.id === active) ?? sections[0];
  const addr = addressLine(property);

  return (
    <div className="space-y-5 print:hidden">
      {/* Report header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-foreground">
            Marketing &amp; Performance Snapshot
          </h1>
          <p className="mt-1.5 text-[12.5px] font-medium text-muted-foreground">
            {property.name}
            {addr ? ` · ${addr}` : ""} · {periodLabel(snapshot)}
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Prepared by
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/leasestack-wordmark.png"
            alt="LeaseStack"
            className="ml-auto block h-7 w-auto"
          />
        </div>
      </header>

      {/* Tab row */}
      <nav
        aria-label="Report sections"
        className="flex flex-nowrap gap-1 overflow-x-auto border-b border-border scrollbar-hide"
      >
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isActive = sec.id === active;
          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => selectTab(sec.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[12.5px] font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {sec.label}
            </button>
          );
        })}
      </nav>

      {/* Active panel */}
      <div role="tabpanel">
        {activeSection?.render(snapshot, property, selectTab)}
      </div>
    </div>
  );
}

export function ReportDashboard(props: {
  snapshot: ReportSnapshot;
  property: PropertyMeta;
}) {
  return (
    <Suspense
      fallback={<div className="h-10 animate-pulse rounded-md bg-muted" />}
    >
      <DashboardInner {...props} />
    </Suspense>
  );
}
