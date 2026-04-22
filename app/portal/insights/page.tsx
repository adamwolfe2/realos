import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { getInsightCounts, getOpenInsights } from "@/lib/insights/queries";
import { InsightCard, type InsightCardData } from "@/components/portal/insights/insight-card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const CATEGORY_FILTERS = [
  { value: "all", label: "All" },
  { value: "traffic", label: "Traffic" },
  { value: "leads", label: "Leads" },
  { value: "ads", label: "Ads" },
  { value: "chatbot", label: "Chatbot" },
  { value: "seo", label: "SEO" },
];

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; severity?: string; status?: string }>;
}) {
  const scope = await requireScope();
  const params = await searchParams;
  const category = params.category ?? "all";
  const severity = params.severity ?? "all";
  const status = params.status ?? "open";

  const [counts, rows, resolvedCount] = await Promise.all([
    getInsightCounts(scope.orgId),
    prisma.insight.findMany({
      where: {
        orgId: scope.orgId,
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
    prisma.insight.count({ where: { orgId: scope.orgId, status: "acted" } }),
  ]);

  const casted: InsightCardData[] = rows.map((r) => ({
    ...r,
    context: (r.context as Record<string, unknown>) ?? null,
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Signal
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            What your platform flagged this week. Each insight is something we
            detected in your data that a human would otherwise miss. Acknowledge
            what you have seen, snooze the noise, and open the ones worth a call.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatBlock label="Critical" value={counts.critical} tone="critical" />
          <StatBlock label="Warning" value={counts.warning} tone="warning" />
          <StatBlock label="Info" value={counts.info} tone="info" />
          <StatBlock label="Resolved" value={resolvedCount} tone="muted" />
        </div>
      </header>

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
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            No insights match those filters
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Try widening the filters. Detectors run every 30 minutes and will
            surface anomalies as they appear.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
    critical: "text-rose-700",
    warning: "text-amber-700",
    info: "text-sky-700",
    muted: "text-muted-foreground",
  };
  return (
    <div className="min-w-16 rounded-lg border border-border bg-card px-3 py-2">
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
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
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
