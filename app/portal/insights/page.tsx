import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import {
  effectivePropertyIds,
  isAccessDenied,
  parsePropertyFilter,
  propertyIdsToWhere,
  visibleProperties,
} from "@/lib/tenancy/property-filter";
import { PropertyMultiSelect } from "@/components/portal/property-multi-select";
import { PropertyAccessDeniedBanner } from "@/components/portal/access-denied-banner";
import { getInsightCounts, getOpenInsights } from "@/lib/insights/queries";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { RunDetectorsButton } from "@/components/portal/insights/run-detectors-button";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/portal/ui/empty-state";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const CATEGORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "traffic", label: "Traffic" },
  { value: "leads", label: "Leads" },
  { value: "ads", label: "Ads" },
  { value: "chatbot", label: "Chatbot" },
  { value: "seo", label: "SEO" },
  { value: "reputation", label: "Reputation" },
  { value: "renewals", label: "Renewals" },
  { value: "occupancy", label: "Occupancy" },
  { value: "portfolio", label: "Portfolio" },
];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    severity?: string;
    status?: string;
    property?: string;
    properties?: string;
  }>;
}) {
  const scope = await requireScope();
  const params = await searchParams;
  const category = params.category ?? "all";
  const severity = params.severity ?? "all";
  const status = params.status ?? "open";

  // Property gate: respect both URL multi-select AND the user's
  // UserPropertyAccess scope. Norman should only see Telegraph
  // Commons insights even if he removes the URL filter.
  const requestedIds = parsePropertyFilter(params);
  const accessDenied = isAccessDenied(scope, requestedIds);
  const effectiveIds = effectivePropertyIds(scope, requestedIds);
  const propertyClause = propertyIdsToWhere(effectiveIds);

  const [counts, rows, resolvedCount, allProperties] = await Promise.all([
    getInsightCounts(scope.orgId, { propertyIds: effectiveIds }),
    prisma.insight.findMany({
      where: {
        orgId: scope.orgId,
        ...propertyClause,
        ...(category !== "all" ? { category } : {}),
        ...(severity !== "all" ? { severity } : {}),
        ...(status === "open"
          ? {
              status: { in: ["open", "acknowledged"] },
              OR: [{ snoozeUntil: null }, { snoozeUntil: { lt: new Date() } }],
            }
          : status === "snoozed"
            ? { snoozeUntil: { gte: new Date() } }
            : { status }),
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        kind: true,
        category: true,
        severity: true,
        status: true,
        title: true,
        body: true,
        suggestedAction: true,
        href: true,
        context: true,
        createdAt: true,
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.insight.count({
      where: { orgId: scope.orgId, status: "acted", ...propertyClause },
    }),
    prisma.property.findMany({
      // Marketable filter — only ACTIVE properties surface in the
      // dropdown, no IMPORTED / EXCLUDED rows.
      where: marketablePropertyWhere(scope.orgId),
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const properties = visibleProperties(scope, allProperties);

  const casted: InsightCardData[] = rows.map((r) => ({
    ...r,
    context: (r.context as Record<string, unknown>) ?? null,
  }));

  return (
    <div className="space-y-5">
      {accessDenied ? <PropertyAccessDeniedBanner /> : null}
      <PageHeader
        eyebrow="Signal"
        title="Insights"
        description="What your platform flagged this week. Each insight is something we detected in your data that a human would otherwise miss. Acknowledge what you've seen, snooze the noise, and open the ones worth a call."
        actions={
          <>
            {properties.length > 1 ? (
              <PropertyMultiSelect properties={properties} orgId={scope.orgId} />
            ) : null}
            <StatBlock label="Critical" value={counts.critical} tone="critical" />
            <StatBlock label="Warning" value={counts.warning} tone="warning" />
            <StatBlock label="Info" value={counts.info} tone="info" />
            <StatBlock label="Resolved" value={resolvedCount} tone="muted" />
            <RunDetectorsButton />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup label="Category" param="category" value={category} options={CATEGORY_FILTERS} current={params} />
        <FilterGroup
          label="Severity"
          param="severity"
          value={severity}
          options={[
            { value: "all", label: "All" },
            { value: "critical", label: "Critical" },
            { value: "warning", label: "Warning" },
            { value: "info", label: "Info" },
          ]}
          current={params}
        />
        <FilterGroup
          label="Status"
          param="status"
          value={status}
          options={[
            { value: "open", label: "Open" },
            { value: "snoozed", label: "Snoozed" },
            { value: "acted", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]}
          current={params}
        />
      </div>

      {rows.length === 0 ? (
        counts.total === 0 && resolvedCount === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="You don't have any insights yet"
            body="Insights surface automatically once your data starts flowing. Connect AppFolio, Google Analytics, your ad accounts, and the pixel — each unlocks a new family of detectors that run continuously in the background."
            action={{ label: "Connect your data", href: "/portal/connect" }}
          />
        ) : (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No insights match those filters"
            body="Try widening the filters. Detectors run continuously plus on every data sync."
            action={{ label: "Clear filters", href: "/portal/insights" }}
          />
        )
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {casted.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </section>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "warning" | "info" | "muted";
}) {
  const map = {
    critical: "text-foreground",
    warning: "text-foreground",
    info: "text-foreground",
    muted: "text-muted-foreground",
  };
  return (
    <div className="min-w-16 rounded-xl border border-border bg-card px-3 py-2 hover:shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all">
      <div className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-xl font-semibold tabular-nums", map[tone])}>
        {value}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  param,
  value,
  options,
  current,
}: {
  label: string;
  param: string;
  value: string;
  options: { value: string; label: string }[];
  current: Record<string, string | undefined>;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground px-2">
        {label}
      </span>
      {options.map((opt) => {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(current)) {
          if (v && k !== param) params.set(k, v);
        }
        if (opt.value !== "all") params.set(param, opt.value);
        const href = `/portal/insights${params.toString() ? `?${params}` : ""}`;
        const active = value === opt.value;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
