import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { SeoActionStatus } from "@prisma/client";
import { ReopenForm } from "./reopen-form";

export const metadata: Metadata = { title: "Recommendation history" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/seo/recommendations — operator archive of every terminal
// recommendation (COMPLETED, DISMISSED, EXPIRED) grouped by month.
// Lets operators see their wins over time and reopen anything that
// was prematurely closed.
//
// Status filter chips switch between groups. Per-row Reopen button
// flips status back to OPEN via the existing PATCH endpoint.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: Array<{
  value: SeoActionStatus | "ALL_TERMINAL";
  label: string;
}> = [
  { value: "ALL_TERMINAL", label: "All terminal" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "EXPIRED", label: "Expired" },
];

const SEV_TONE: Record<string, string> = {
  CRITICAL: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  HIGH: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  MEDIUM: "bg-muted text-muted-foreground",
  LOW: "bg-muted/60 text-muted-foreground",
};

const STATUS_TONE: Record<string, string> = {
  COMPLETED:
    "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  DISMISSED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted/60 text-muted-foreground",
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function whichDate(r: {
  completedAt: Date | null;
  dismissedAt: Date | null;
  updatedAt: Date;
}): Date {
  return r.completedAt ?? r.dismissedAt ?? r.updatedAt;
}

export default async function RecommendationHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const filter = STATUS_OPTIONS.find((o) => o.value === sp.status)
    ? (sp.status as (typeof STATUS_OPTIONS)[number]["value"])
    : "ALL_TERMINAL";

  const terminalStatuses: SeoActionStatus[] = [
    "COMPLETED",
    "DISMISSED",
    "EXPIRED",
  ];

  const where: Record<string, unknown> = { ...tenantWhere(scope) };
  if (scope.allowedPropertyIds) {
    where.propertyId = { in: scope.allowedPropertyIds };
  }
  if (filter === "ALL_TERMINAL") {
    where.status = { in: terminalStatuses };
  } else {
    where.status = filter as SeoActionStatus;
  }

  // 90-day archive window — beyond that, the queue grew unbounded and
  // operators were never going to scroll that far anyway.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  where.updatedAt = { gte: since };

  const [rows, statusCounts] = await Promise.all([
    prisma.seoActionRecommendation.findMany({
      where: where as never,
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        category: true,
        severity: true,
        title: true,
        detail: true,
        status: true,
        completedAt: true,
        dismissedAt: true,
        dismissedReason: true,
        updatedAt: true,
        property: { select: { id: true, name: true } },
      },
    }),
    prisma.seoActionRecommendation.groupBy({
      by: ["status"],
      where: {
        ...tenantWhere(scope),
        ...(scope.allowedPropertyIds
          ? { propertyId: { in: scope.allowedPropertyIds } }
          : {}),
        status: { in: terminalStatuses },
        updatedAt: { gte: since },
      },
      _count: { _all: true },
    }),
  ]);

  const countMap = new Map(statusCounts.map((c) => [c.status, c._count._all]));
  const totalTerminal = Array.from(countMap.values()).reduce((a, b) => a + b, 0);

  // Group by month for the section headers.
  const byMonth = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = monthKey(whichDate(r));
    const existing = byMonth.get(key);
    if (existing) existing.push(r);
    else byMonth.set(key, [r]);
  }
  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; SEO Agent
        </Link>
      </div>

      <header>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          Archive
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          Recommendation history
        </h1>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
          Every recommendation you completed, dismissed, or expired in the
          last 90 days. Grouped by month so you see your wins.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = opt.value === filter;
          const count =
            opt.value === "ALL_TERMINAL"
              ? totalTerminal
              : (countMap.get(opt.value as SeoActionStatus) ?? 0);
          return (
            <Link
              key={opt.value}
              href={`/portal/seo/recommendations?status=${opt.value}`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                isActive
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-[13px] font-medium text-foreground">
            {filter === "ALL_TERMINAL"
              ? "No archived recommendations yet."
              : `No ${STATUS_OPTIONS.find((o) => o.value === filter)?.label.toLowerCase()} recommendations in the last 90 days.`}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Open recs live on{" "}
            <Link
              href="/portal/seo/agent"
              className="text-primary hover:underline"
            >
              the agent dashboard
            </Link>
            . As you complete or dismiss them, they appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthKeys.map((key) => {
            const monthRows = byMonth.get(key)!;
            return (
              <section key={key} className="space-y-2">
                <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {monthLabel(key)} · {monthRows.length} rec
                  {monthRows.length === 1 ? "" : "s"}
                </h2>
                <ul className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
                  {monthRows.map((r) => (
                    <li key={r.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${SEV_TONE[r.severity]}`}
                        >
                          {r.severity.toLowerCase()}
                        </span>
                        <span
                          className={`mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide shrink-0 ${STATUS_TONE[r.status] ?? STATUS_TONE.DISMISSED}`}
                        >
                          {r.status.toLowerCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-foreground leading-snug">
                            {r.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                            {r.detail}
                          </p>
                          <p className="mt-1 text-[10.5px] text-muted-foreground">
                            {r.property?.name ? `${r.property.name} · ` : ""}
                            <span className="font-mono uppercase tracking-wide">
                              {r.category.toLowerCase().replace(/_/g, " ")}
                            </span>
                            {" · "}
                            {whichDate(r).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                            {r.dismissedReason
                              ? ` · ${r.dismissedReason.slice(0, 80)}`
                              : ""}
                          </p>
                        </div>
                        <ReopenForm id={r.id} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

