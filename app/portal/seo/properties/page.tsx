import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireScope } from "@/lib/tenancy/scope";
import { marketablePropertyWhere } from "@/lib/properties/marketable";
import { PageHeader } from "@/components/admin/page-header";

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

// Enterprise-blue scoring scale. State carried by primary saturation +
// weight, not by hue. Matches the marketplace + intelligence + AEO
// treatment so we never break the single-blue rhythm.
function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 75) return "text-primary font-semibold";
  if (score >= 50) return "text-primary/70";
  return "text-muted-foreground";
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

type SortKey = "name" | "score" | "recs" | "sync";
const VALID_SORTS: SortKey[] = ["name", "score", "recs", "sync"];

export default async function SeoPortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; filter?: string }>;
}) {
  const scope = await requireScope();
  const sp = await searchParams;
  const sort: SortKey = VALID_SORTS.includes(sp.sort as SortKey)
    ? (sp.sort as SortKey)
    : "score";
  const filter = sp.filter === "open" ? "open" : "all";

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
      <div className="space-y-5 w-full">
        <Link
          href="/portal/seo/agent"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          &larr; SEO Agent
        </Link>
        <PageHeader eyebrow="Portfolio" title="SEO across your properties" />
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

      <PageHeader
        eyebrow="Portfolio"
        title="SEO across your properties"
        description="One row per property with composite score, open recommendations, top-10 ranking queries, drafts pending, and last sync. Click any property to drill into its SEO Agent dashboard."
      />

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

      {/* Sort + filter chips. URL-driven so the state is bookmarkable. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground mr-1 self-center">
            Sort
          </span>
          {(
            [
              { value: "score", label: "Score" },
              { value: "recs", label: "Open recs" },
              { value: "sync", label: "Last sync" },
              { value: "name", label: "Name" },
            ] as const
          ).map((opt) => {
            const params = new URLSearchParams();
            params.set("sort", opt.value);
            if (filter !== "all") params.set("filter", filter);
            return (
              <Link
                key={opt.value}
                href={`/portal/seo/properties?${params.toString()}`}
                className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  sort === opt.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
        <span aria-hidden="true" className="h-4 w-px bg-border" />
        <Link
          href={(() => {
            const params = new URLSearchParams();
            params.set("sort", sort);
            if (filter !== "open") params.set("filter", "open");
            return `/portal/seo/properties?${params.toString()}`;
          })()}
          className={`inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
            filter === "open"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          {filter === "open" ? "Showing: has open recs ×" : "Filter: has open recs"}
        </Link>
      </div>

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
              {(() => {
                // Apply URL-driven sort + filter without re-querying Prisma.
                // recsTotal computed inline so the sort key matches what
                // operators see in the chip cluster.
                const recsTotalFor = (id: string): number => {
                  const r = recsByProperty.get(id);
                  if (!r) return 0;
                  return r.critical + r.high + r.medium + r.low;
                };
                let working = properties.slice();
                if (filter === "open") {
                  working = working.filter((p) => recsTotalFor(p.id) > 0);
                }
                if (sort === "score") {
                  working.sort(
                    (a, b) =>
                      (scoreByProperty.get(b.id) ?? -1) -
                      (scoreByProperty.get(a.id) ?? -1),
                  );
                } else if (sort === "recs") {
                  working.sort((a, b) => {
                    const ar = recsByProperty.get(a.id);
                    const br = recsByProperty.get(b.id);
                    const aw = (ar?.critical ?? 0) * 3 + (ar?.high ?? 0);
                    const bw = (br?.critical ?? 0) * 3 + (br?.high ?? 0);
                    return bw - aw;
                  });
                } else if (sort === "sync") {
                  working.sort((a, b) => {
                    const at = lastSyncByProperty.get(a.id)?.getTime() ?? 0;
                    const bt = lastSyncByProperty.get(b.id)?.getTime() ?? 0;
                    return bt - at;
                  });
                } else {
                  working.sort((a, b) => a.name.localeCompare(b.name));
                }
                if (working.length === 0) {
                  return (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-[12px] text-muted-foreground"
                      >
                        No properties match this filter.
                      </td>
                    </tr>
                  );
                }
                return working.map((p) => {
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
                            <span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground font-semibold">
                              {recs.critical}
                            </span>
                          ) : null}
                          {recs.high > 0 ? (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
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
              });
              })()}
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
  // Tone reads from primary saturation + weight, not from hue. Keeps
  // the portfolio KPI strip cohesive with the rest of the portal.
  const valueClass =
    tone === "positive"
      ? "text-primary font-semibold"
      : tone === "danger"
        ? "text-destructive"
        : tone === "warning"
          ? "text-primary/70"
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
