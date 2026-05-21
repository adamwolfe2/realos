import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";

export const metadata: Metadata = { title: "SEO portfolio" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /portal/seo/properties — side-by-side view of every property in the
// portfolio with their SEO health summary. Useful for operators
// answering "which property needs my attention next?" without flipping
// through the property switcher.
//
// Columns: property | score | open crit / high | top-10 queries |
//          drafts pending | last scan
// Single org query + small joins; cheap.
// ---------------------------------------------------------------------------

function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function fmtAge(d: Date | null): string {
  if (!d) return "—";
  const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default async function SeoPortfolioPage() {
  const scope = await requireScope();

  // Constrain to marketable + property-RBAC. Same set as /portal/seo/agent.
  const propertyWhere: Record<string, unknown> = {
    ...marketablePropertyWhere(scope.orgId),
  };
  if (scope.allowedPropertyIds) {
    propertyWhere.id = { in: scope.allowedPropertyIds };
  }

  const properties = await prisma.property.findMany({
    where: propertyWhere as never,
    orderBy: [{ launchStatus: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      launchStatus: true,
    },
    take: 200,
  });

  if (properties.length === 0) {
    return (
      <div className="space-y-5 max-w-4xl">
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; SEO Agent
        </Link>
        <header>
          <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
            Portfolio
          </p>
          <h1 className="text-2xl font-semibold text-foreground">
            SEO across your properties
          </h1>
        </header>
        <p className="text-[12px] text-muted-foreground">
          No properties yet. Add one in{" "}
          <Link href="/portal/properties" className="text-primary hover:underline">
            /portal/properties
          </Link>
          .
        </p>
      </div>
    );
  }

  const propertyIds = properties.map((p) => p.id);

  // Parallel fetch every signal we need to compose one summary row per property.
  const [
    scoreRows,
    recRows,
    rankRows,
    draftCounts,
    syncRows,
  ] = await Promise.all([
    // Latest score per property (we sort, then dedupe in app).
    prisma.seoScoreHistory.findMany({
      where: { propertyId: { in: propertyIds } },
      orderBy: { weekOf: "desc" },
      select: { propertyId: true, compositeScore: true },
    }),
    // Open + in-progress recs grouped by property+severity.
    prisma.seoActionRecommendation.groupBy({
      by: ["propertyId", "severity"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      _count: { _all: true },
    }),
    // Top-10 ranked queries per property in the last 7 days.
    prisma.serpRanking.findMany({
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        date: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        ourRank: { not: null, lte: 10 },
      },
      distinct: ["propertyId", "query"],
      select: { propertyId: true },
    }),
    // Pending drafts per property.
    prisma.contentDraft.groupBy({
      by: ["propertyId"],
      where: {
        orgId: scope.orgId,
        propertyId: { in: propertyIds },
        status: { in: ["PENDING_REVIEW", "CHANGES_REQUESTED"] },
      },
      _count: { _all: true },
    }),
    // Last successful sync per property (latest SerpRanking date).
    prisma.serpRanking.findMany({
      where: { orgId: scope.orgId, propertyId: { in: propertyIds } },
      orderBy: { date: "desc" },
      distinct: ["propertyId"],
      select: { propertyId: true, date: true },
    }),
  ]);

  const scoreByProperty = new Map<string, number>();
  for (const s of scoreRows) {
    if (s.propertyId && !scoreByProperty.has(s.propertyId)) {
      scoreByProperty.set(s.propertyId, s.compositeScore);
    }
  }

  type Sevs = { critical: number; high: number; medium: number; low: number };
  const recsByProperty = new Map<string, Sevs>();
  for (const r of recRows) {
    if (!r.propertyId) continue;
    const existing =
      recsByProperty.get(r.propertyId) ?? {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
    const sev = r.severity.toLowerCase() as keyof Sevs;
    if (sev in existing) existing[sev] += r._count._all;
    recsByProperty.set(r.propertyId, existing);
  }

  const top10ByProperty = new Map<string, number>();
  for (const r of rankRows) {
    if (!r.propertyId) continue;
    top10ByProperty.set(
      r.propertyId,
      (top10ByProperty.get(r.propertyId) ?? 0) + 1,
    );
  }

  const draftsByProperty = new Map<string, number>();
  for (const d of draftCounts) {
    if (d.propertyId)
      draftsByProperty.set(d.propertyId, d._count._all);
  }

  const lastSyncByProperty = new Map<string, Date>();
  for (const s of syncRows) {
    if (s.propertyId) lastSyncByProperty.set(s.propertyId, s.date);
  }

  return (
    <div className="space-y-5 max-w-[1200px]">
      <Link
        href="/portal/seo/agent"
        className="text-[11px] text-muted-foreground hover:text-foreground"
      >
        &larr; SEO Agent
      </Link>

      <header>
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-primary">
          Portfolio
        </p>
        <h1 className="text-2xl font-semibold text-foreground">
          SEO across your properties
        </h1>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-2xl">
          One row per property with composite score, open recommendations,
          top-10 ranking queries, drafts pending, and last sync. Click
          any property to drill into its SEO Agent dashboard.
        </p>
      </header>

      {(() => {
        // Portfolio rollup. Computed inline against the maps already built
        // above so we don't re-query Prisma. Skips properties with no score
        // when averaging so a fresh property doesn't drag the mean to 0.
        const scoresArr = Array.from(scoreByProperty.values());
        const avgScore =
          scoresArr.length > 0
            ? Math.round(scoresArr.reduce((a, b) => a + b, 0) / scoresArr.length)
            : null;
        let totalCritical = 0;
        let totalHigh = 0;
        let totalOther = 0;
        for (const sevs of recsByProperty.values()) {
          totalCritical += sevs.critical;
          totalHigh += sevs.high;
          totalOther += sevs.medium + sevs.low;
        }
        const totalDrafts = Array.from(draftsByProperty.values()).reduce(
          (a, b) => a + b,
          0,
        );
        const totalTop10 = Array.from(top10ByProperty.values()).reduce(
          (a, b) => a + b,
          0,
        );

        return (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-border/60">
              <KpiCell
                label="Properties"
                value={String(properties.length)}
                hint={`${scoresArr.length} with score`}
              />
              <KpiCell
                label="Avg score"
                value={avgScore != null ? String(avgScore) : "—"}
                hint={
                  avgScore != null
                    ? avgScore >= 75
                      ? "Healthy"
                      : avgScore >= 50
                        ? "Mixed"
                        : "Needs work"
                    : "Pending first snapshot"
                }
                tone={
                  avgScore == null
                    ? undefined
                    : avgScore >= 75
                      ? "positive"
                      : avgScore < 50
                        ? "danger"
                        : undefined
                }
              />
              <KpiCell
                label="Open recs"
                value={String(totalCritical + totalHigh + totalOther)}
                hint={`${totalCritical} crit · ${totalHigh} high · ${totalOther} other`}
                tone={totalCritical > 0 ? "danger" : undefined}
              />
              <KpiCell
                label="Top-10 queries"
                value={String(totalTop10)}
                hint="Across portfolio, 7d"
              />
              <KpiCell
                label="Pending drafts"
                value={String(totalDrafts)}
                hint={totalDrafts > 0 ? "Admin reviewing" : "All clear"}
                tone={totalDrafts > 0 ? "warning" : undefined}
              />
            </div>
          </div>
        );
      })()}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[760px]">
            <thead className="bg-muted/30 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Property</th>
                <th className="px-4 py-2.5 text-right font-medium">Score</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Open recs
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Top 10
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Pending drafts
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  Last sync
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {properties.map((p) => {
                const score = scoreByProperty.get(p.id);
                const recs = recsByProperty.get(p.id) ?? {
                  critical: 0,
                  high: 0,
                  medium: 0,
                  low: 0,
                };
                const top10 = top10ByProperty.get(p.id) ?? 0;
                const drafts = draftsByProperty.get(p.id) ?? 0;
                const lastSync = lastSyncByProperty.get(p.id) ?? null;
                return (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/portal/seo/agent?propertyId=${p.id}`}
                        className="block group"
                      >
                        <p className="font-medium text-foreground group-hover:text-primary truncate">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                          {[p.city, p.state].filter(Boolean).join(", ") || "—"}
                          {p.launchStatus !== "LIVE" ? (
                            <span className="ml-1.5 rounded px-1 py-0.5 bg-muted text-[9.5px] font-mono uppercase">
                              {p.launchStatus.toLowerCase()}
                            </span>
                          ) : null}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span
                        className={`text-[15px] font-mono font-semibold tabular-nums ${scoreTone(score ?? null)}`}
                      >
                        {score ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {recs.critical + recs.high + recs.medium + recs.low > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono">
                          {recs.critical > 0 ? (
                            <span className="rounded bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 text-red-700 dark:text-red-300">
                              {recs.critical}
                            </span>
                          ) : null}
                          {recs.high > 0 ? (
                            <span className="rounded bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 text-amber-800 dark:text-amber-300">
                              {recs.high}
                            </span>
                          ) : null}
                          {recs.medium + recs.low > 0 ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              {recs.medium + recs.low}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {top10 > 0 ? top10 : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {drafts > 0 ? (
                        <Link
                          href="/portal/seo/drafts"
                          className="text-primary hover:underline font-medium"
                        >
                          {drafts}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                      {fmtAge(lastSync)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Score lives weekly via the Monday 05:00 UTC snapshot. Recs and ranks
        refresh daily via the 04:00 UTC sync.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiCell — small stat cell for the portfolio KPI strip. Tone tints the
// value color so wins/losses scan in two seconds.
// ---------------------------------------------------------------------------
function KpiCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "danger" | "warning";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-600"
      : tone === "danger"
        ? "text-red-600"
        : tone === "warning"
          ? "text-amber-600"
          : "text-foreground";
  return (
    <div className="px-4 py-3 first:rounded-l-2xl last:rounded-r-2xl">
      <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-muted-foreground leading-tight">
        {label}
      </p>
      <p
        className={`mt-1 text-[20px] font-display font-medium tabular-nums leading-none ${valueClass}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[10.5px] text-muted-foreground leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
