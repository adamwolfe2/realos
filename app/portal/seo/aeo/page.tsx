import * as React from "react";
import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { requireScope, tenantWhere } from "@/lib/tenancy/scope";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AeoScanButton } from "./aeo-scan-button";
import { RecentChecksTable, type CheckRow } from "./recent-checks-table";
import type { AeoEngine } from "@prisma/client";

export const metadata: Metadata = { title: "AI search visibility" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const ENGINES: AeoEngine[] = ["CHATGPT", "PERPLEXITY", "CLAUDE", "GEMINI"];

const ENGINE_LABELS: Record<AeoEngine, string> = {
  CHATGPT: "ChatGPT",
  PERPLEXITY: "Perplexity",
  CLAUDE: "Claude",
  GEMINI: "Gemini",
};

function fmtPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

function fmtNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

export default async function AeoPage() {
  const scope = await requireScope();
  const where = tenantWhere(scope);

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY_MS);
  const sixtyDaysAgo = new Date(now - 60 * DAY_MS);

  // Pull every check from the last 60d in one query, partition in memory.
  // For an org with N properties × M engines × 3 prompts/week ≈ a few hundred
  // rows at most — well below any pagination concern.
  const checks = await prisma.aeoCitationCheck.findMany({
    where: {
      ...where,
      queryRunAt: { gte: sixtyDaysAgo },
    },
    select: {
      id: true,
      engine: true,
      prompt: true,
      status: true,
      responseText: true,
      citedUrl: true,
      competitorsCited: true,
      queryRunAt: true,
      propertyId: true,
    },
    orderBy: { queryRunAt: "desc" },
    take: 2000,
  });

  // Resolve property names for the rows we'll display.
  const propertyIds = Array.from(
    new Set(checks.map((c) => c.propertyId).filter((p): p is string => !!p)),
  );
  const propertyNameMap = new Map<string, string>();
  if (propertyIds.length > 0) {
    const props = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true },
    });
    for (const p of props) propertyNameMap.set(p.id, p.name);
  }

  const last30 = checks.filter((c) => c.queryRunAt >= thirtyDaysAgo);
  const prior30 = checks.filter(
    (c) => c.queryRunAt < thirtyDaysAgo && c.queryRunAt >= sixtyDaysAgo,
  );

  const last30Cited = last30.filter((c) => c.status === "CITED").length;
  const last30Total = last30.length;
  const prior30Cited = prior30.filter((c) => c.status === "CITED").length;
  const prior30Total = prior30.length;

  const citationRate30 = last30Total > 0 ? last30Cited / last30Total : 0;
  const priorRate = prior30Total > 0 ? prior30Cited / prior30Total : 0;
  const trendDelta = citationRate30 - priorRate;

  // Per-engine breakdown over the last 30 days.
  const perEngine = ENGINES.map((engine) => {
    const forEngine = last30.filter((c) => c.engine === engine);
    const cited = forEngine.filter((c) => c.status === "CITED");
    const totalQ = forEngine.length;
    const rate = totalQ > 0 ? cited.length / totalQ : 0;
    const sampleCitedUrl =
      cited.find((c) => !!c.citedUrl)?.citedUrl ?? null;
    const lastScan = forEngine[0]?.queryRunAt ?? null;
    return { engine, totalQ, cited: cited.length, rate, sampleCitedUrl, lastScan };
  });

  // Competitors-cited rollup. Aggregate counts across rows where we WEREN'T
  // cited (NOT_CITED + COMPETITOR_CITED both reveal who the engine surfaced
  // instead of us).
  const competitorCounts = new Map<string, number>();
  for (const c of last30) {
    if (c.status === "CITED") continue;
    for (const name of c.competitorsCited) {
      const key = name.trim();
      if (!key) continue;
      competitorCounts.set(key, (competitorCounts.get(key) ?? 0) + 1);
    }
  }
  const topCompetitors = Array.from(competitorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Recent prompts list — most-recent 20.
  const recentRows: CheckRow[] = checks.slice(0, 20).map((c) => ({
    id: c.id,
    engine: c.engine,
    prompt: c.prompt,
    status: c.status,
    responseText: c.responseText,
    citedUrl: c.citedUrl,
    competitorsCited: c.competitorsCited,
    queryRunAt: c.queryRunAt.toISOString(),
    propertyName: c.propertyId
      ? propertyNameMap.get(c.propertyId) ?? null
      : null,
  }));

  const lastScanAt = checks[0]?.queryRunAt ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={
          <a href="/portal/seo" className="hover:text-foreground">
            ← SEO
          </a>
        }
        eyebrow="AI ENGINE OPTIMIZATION"
        title="AI search visibility"
        description="When prospective renters ask ChatGPT, Perplexity, Claude, or Gemini for apartment recommendations in your market, do they get your property? Scans run automatically every Monday."
        meta={
          lastScanAt
            ? `last scan ${formatDistanceToNow(lastScanAt, {
                addSuffix: true,
              })}`
            : "never scanned"
        }
        actions={<AeoScanButton />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Citation rate (30d)"
          value={fmtPercent(citationRate30)}
          hint={
            last30Total > 0
              ? `${last30Cited} of ${last30Total} queries cited you`
              : "No queries in window"
          }
          tone={citationRate30 >= 0.3 ? "success" : undefined}
        />
        <StatCard
          label="Citations (30d)"
          value={fmtNumber(last30Cited)}
          hint={`${fmtNumber(last30Total)} total queries`}
        />
        <StatCard
          label="Trend vs prior 30d"
          value={
            prior30Total === 0
              ? "—"
              : `${trendDelta >= 0 ? "+" : ""}${(trendDelta * 100).toFixed(0)}pp`
          }
          hint={
            prior30Total === 0
              ? "Need 60d of history"
              : `Prior period: ${fmtPercent(priorRate)}`
          }
          tone={trendDelta < -0.02 ? "danger" : undefined}
        />
        <StatCard
          label="Competitors named"
          value={fmtNumber(competitorCounts.size)}
          hint="Unique buildings surfaced when you weren't"
        />
      </div>

      {/* Per-engine breakdown */}
      <SectionCard
        label="Per-engine breakdown"
        description="Citation rate by AI assistant over the last 30 days."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {perEngine.map((row) => (
            <div
              key={row.engine}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">
                  {ENGINE_LABELS[row.engine]}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {fmtPercent(row.rate)}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {row.totalQ === 0
                  ? "No queries yet"
                  : `${row.cited} of ${row.totalQ} queries`}
              </div>
              {row.sampleCitedUrl ? (
                <a
                  href={row.sampleCitedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-primary hover:underline truncate"
                  title={row.sampleCitedUrl}
                >
                  {row.sampleCitedUrl}
                </a>
              ) : (
                <div className="text-[11px] text-muted-foreground italic">
                  No cited URL yet
                </div>
              )}
              <div className="text-[10px] text-muted-foreground mt-auto">
                {row.lastScan
                  ? `Last scan ${formatDistanceToNow(row.lastScan, {
                      addSuffix: true,
                    })}`
                  : "—"}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Recent prompts table + Competitors rollup, side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SectionCard
            label="Recent prompts"
            description="Most recent 20 AI queries and how each engine responded."
          >
            <RecentChecksTable rows={recentRows} />
          </SectionCard>
        </div>
        <div>
          <SectionCard
            label="Competitors cited"
            description="Buildings surfaced when your properties weren't (last 30 days)."
          >
            {topCompetitors.length === 0 ? (
              <div className="text-[13px] text-muted-foreground py-2">
                No competitor names extracted yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {topCompetitors.map(([name, count]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="truncate text-foreground" title={name}>
                      {name}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                      {count}×
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
