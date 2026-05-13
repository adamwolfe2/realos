import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { requireAgency } from "@/lib/tenancy/scope";
import { prisma } from "@/lib/db";
import { OrgType } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDistanceToNow } from "date-fns";

export const metadata: Metadata = { title: "Cross-portfolio insights" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/insights — agency-wide rolled-up view of every actionable insight
// across every CLIENT org. The agency uses this to triage portfolio-wide
// fires before clients see them: "this week 7 of our 12 clients have CPL
// spikes — let's get ahead of it."
//
// Design: NOT a copy of /portal/insights. The agency view is denser
// (table-shaped, sorted by severity + recency) and includes the org name
// + "Open" deep-link that impersonates straight into the client portal
// at the relevant page. No filter chrome — just the action queue.
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; org?: string }>;
}) {
  await requireAgency();
  const sp = await searchParams;
  const severityFilter = sp.severity;
  const orgFilter = sp.org;

  // Pull every open + acknowledged insight across CLIENT orgs in the
  // last 14 days, ranked by severity then recency. Cap at 200 — beyond
  // that the agency should drill into a specific org instead.
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [insights, orgsWithInsights, severityCounts] = await Promise.all([
    prisma.insight.findMany({
      where: {
        status: { in: ["open", "acknowledged"] },
        createdAt: { gte: since },
        ...(severityFilter && severityFilter in SEVERITY_RANK
          ? { severity: severityFilter }
          : {}),
        ...(orgFilter ? { orgId: orgFilter } : {}),
        org: { orgType: OrgType.CLIENT },
        OR: [{ snoozeUntil: null }, { snoozeUntil: { lt: new Date() } }],
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        kind: true,
        category: true,
        severity: true,
        title: true,
        body: true,
        suggestedAction: true,
        href: true,
        createdAt: true,
        orgId: true,
        propertyId: true,
        org: { select: { id: true, name: true, slug: true } },
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.insight.groupBy({
      by: ["orgId"],
      where: {
        status: { in: ["open", "acknowledged"] },
        createdAt: { gte: since },
        org: { orgType: OrgType.CLIENT },
      },
      _count: { _all: true },
    }),
    prisma.insight.groupBy({
      by: ["severity"],
      where: {
        status: { in: ["open", "acknowledged"] },
        createdAt: { gte: since },
        org: { orgType: OrgType.CLIENT },
      },
      _count: { _all: true },
    }),
  ]);

  const severityCountMap = new Map<string, number>();
  for (const r of severityCounts) {
    severityCountMap.set(r.severity, r._count._all);
  }
  const critical = severityCountMap.get("critical") ?? 0;
  const warning = severityCountMap.get("warning") ?? 0;
  const info = severityCountMap.get("info") ?? 0;
  const totalActionable = critical + warning;

  // Rank orgs by total open-or-ack insights to surface the most-on-fire
  // clients at the top.
  const orgRankings = orgsWithInsights
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8);

  const orgNameLookup = new Map(
    insights.map((i) => [i.orgId, i.org.name]),
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Cross-portfolio insights"
        description={
          totalActionable === 0
            ? "All clients are quiet — no critical or warning insights in the last 14 days."
            : `${totalActionable} actionable signal${totalActionable === 1 ? "" : "s"} across ${orgsWithInsights.length} client${orgsWithInsights.length === 1 ? "" : "s"} in the last 14 days. Triage what matters most.`
        }
      />

      {/* Severity strip + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChip
          label="All"
          active={!severityFilter}
          href={orgFilter ? `/admin/insights?org=${orgFilter}` : "/admin/insights"}
        />
        <FilterChip
          label={`Critical · ${critical}`}
          tone="danger"
          active={severityFilter === "critical"}
          href={`/admin/insights?severity=critical${orgFilter ? `&org=${orgFilter}` : ""}`}
        />
        <FilterChip
          label={`Warning · ${warning}`}
          tone="warn"
          active={severityFilter === "warning"}
          href={`/admin/insights?severity=warning${orgFilter ? `&org=${orgFilter}` : ""}`}
        />
        <FilterChip
          label={`Info · ${info}`}
          tone="info"
          active={severityFilter === "info"}
          href={`/admin/insights?severity=info${orgFilter ? `&org=${orgFilter}` : ""}`}
        />
        {orgFilter ? (
          <Link
            href={severityFilter ? `/admin/insights?severity=${severityFilter}` : "/admin/insights"}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear org filter ({orgNameLookup.get(orgFilter) ?? "?"}) ×
          </Link>
        ) : null}
      </div>

      {/* Top orgs by insight load — quick triage shortcut */}
      {orgRankings.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4">
          <header className="mb-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Most on fire
            </p>
            <h2 className="text-sm font-semibold text-foreground mt-0.5">
              Client portfolios with the most actionable insights
            </h2>
          </header>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {orgRankings.map((o) => {
              const name = orgNameLookup.get(o.orgId) ?? "Unknown";
              return (
                <Link
                  key={o.orgId}
                  href={`/admin/insights?org=${o.orgId}`}
                  className="group flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 hover:border-primary/40 hover:bg-primary/[0.03] transition-colors"
                >
                  <span className="text-sm font-medium text-foreground truncate">
                    {name}
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-primary shrink-0">
                    {o._count._all}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Insight feed */}
      {insights.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
          <h2 className="mt-3 text-base font-semibold text-foreground">
            {severityFilter || orgFilter
              ? "No insights match these filters"
              : "All quiet on the portfolio front"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {severityFilter || orgFilter
              ? "Try widening the filters."
              : "Insights surface here as detectors find actionable patterns in client data. Empty is good — it means everyone's portfolio is healthy."}
          </p>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 text-[9px] tracking-widest uppercase font-semibold text-muted-foreground">
            <div className="w-20 shrink-0">Severity</div>
            <div className="w-40 shrink-0">Client</div>
            <div className="flex-1 min-w-0">Insight</div>
            <div className="w-32 shrink-0">Property</div>
            <div className="w-24 shrink-0 text-right">When</div>
            <div className="w-16 shrink-0" />
          </div>
          <ul className="divide-y divide-border">
            {insights.map((i) => (
              <li key={i.id}>
                <div className="flex flex-wrap lg:flex-nowrap items-start lg:items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="w-20 shrink-0">
                    <StatusBadge
                      tone={
                        i.severity === "critical"
                          ? "danger"
                          : i.severity === "warning"
                            ? "warning"
                            : "info"
                      }
                    >
                      {i.severity}
                    </StatusBadge>
                  </div>
                  <div className="w-full lg:w-40 shrink-0 min-w-0">
                    <Link
                      href={`/admin/clients/${i.org.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary truncate block"
                    >
                      {i.org.name}
                    </Link>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {i.category}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {i.title}
                    </p>
                    <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {i.body}
                    </p>
                  </div>
                  <div className="w-32 shrink-0 text-xs text-muted-foreground truncate">
                    {i.property?.name ?? "—"}
                  </div>
                  <div className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {formatDistanceToNow(i.createdAt, { addSuffix: false })}
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    <Link
                      href={`/admin/clients/${i.org.id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  href,
  tone,
}: {
  label: string;
  active: boolean;
  href: string;
  tone?: "danger" | "warn" | "info";
}) {
  void tone;
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors " +
        (active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.03]")
      }
    >
      {label}
    </Link>
  );
}
