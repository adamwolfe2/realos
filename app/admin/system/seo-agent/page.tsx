import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { redirect } from "next/navigation";
import { OrgType } from "@prisma/client";
import { PageHeader, SectionCard } from "@/components/admin/page-header";
import { StatCard } from "@/components/admin/stat-card";
import { AdminRefreshAllButton } from "@/components/admin/seo-agent/refresh-all-button";

export const metadata: Metadata = { title: "SEO Agent metrics" };
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// /admin/system/seo-agent — agency-wide observability for the SEO Agent
// pipeline. Helps Adam see at a glance:
//   - Volume of drafts in flight + turnaround time
//   - Open recommendations by severity across all client orgs
//   - DataforSEO API usage proxied by SerpRanking + OnPageAudit row counts
//   - Score improvement across the portfolio (this week vs 4 weeks ago)
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtAvg(numerator: number, denominator: number): string {
  if (denominator === 0) return "—";
  return (numerator / denominator).toFixed(1);
}

function fmtHours(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export default async function AdminSeoAgentMetrics() {
  const { error } = await requireAdmin();
  if (error) redirect("/sign-in");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * DAY_MS);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    draftsByStatus,
    draftsLast7d,
    reviewedDrafts,
    recsByStatusAndSeverity,
    serpThisMonth,
    auditsThisMonth,
    backlinksThisMonth,
    aeoChecksThisMonth,
    scoresThisWeek,
    scoresFourWeeksAgo,
    targetQueriesActive,
    clientOrgsCount,
  ] = await Promise.all([
    prisma.contentDraft.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.contentDraft.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.contentDraft.findMany({
      where: {
        reviewedAt: { not: null },
        submittedAt: { not: null },
        createdAt: { gte: twentyEightDaysAgo },
      },
      select: { submittedAt: true, reviewedAt: true },
      take: 500,
    }),
    prisma.seoActionRecommendation.groupBy({
      by: ["status", "severity"],
      where: { org: { orgType: OrgType.CLIENT } },
      _count: { _all: true },
    }),
    prisma.serpRanking.count({
      where: { date: { gte: startOfMonth } },
    }),
    prisma.onPageAudit.count({
      where: { date: { gte: startOfMonth } },
    }),
    prisma.backlinkSummary.count({
      where: { date: { gte: startOfMonth } },
    }),
    prisma.aeoCitationCheck.count({
      where: { queryRunAt: { gte: startOfMonth } },
    }),
    prisma.seoScoreHistory.findMany({
      where: {
        weekOf: { gte: sevenDaysAgo },
        org: { orgType: OrgType.CLIENT },
      },
      select: { compositeScore: true, orgId: true, propertyId: true },
    }),
    prisma.seoScoreHistory.findMany({
      where: {
        weekOf: {
          gte: new Date(now.getTime() - 35 * DAY_MS),
          lt: new Date(now.getTime() - 28 * DAY_MS),
        },
        org: { orgType: OrgType.CLIENT },
      },
      select: { compositeScore: true, orgId: true, propertyId: true },
    }),
    prisma.seoTargetQuery.count({
      where: { active: true, org: { orgType: OrgType.CLIENT } },
    }),
    prisma.organization.count({
      where: { orgType: OrgType.CLIENT },
    }),
  ]);

  // Turnaround: median + mean review time (submittedAt → reviewedAt).
  const turnaroundMs = reviewedDrafts
    .map((d) =>
      d.submittedAt && d.reviewedAt
        ? d.reviewedAt.getTime() - d.submittedAt.getTime()
        : null,
    )
    .filter((v): v is number => v !== null && v > 0);
  const meanTurnaround =
    turnaroundMs.length > 0
      ? turnaroundMs.reduce((a, b) => a + b, 0) / turnaroundMs.length
      : 0;
  const sortedTurnaround = [...turnaroundMs].sort((a, b) => a - b);
  const medianTurnaround =
    sortedTurnaround.length > 0
      ? sortedTurnaround[Math.floor(sortedTurnaround.length / 2)]
      : 0;

  const draftStatusMap = new Map(
    draftsByStatus.map((d) => [d.status, d._count._all]),
  );
  const pendingReview = draftStatusMap.get("PENDING_REVIEW") ?? 0;
  const inGeneration = draftStatusMap.get("GENERATING") ?? 0;
  const totalShipped = draftStatusMap.get("SHIPPED") ?? 0;
  const totalApproved = draftStatusMap.get("APPROVED") ?? 0;
  const totalRejected = draftStatusMap.get("REJECTED") ?? 0;

  // SEO recs by severity (across OPEN + IN_PROGRESS)
  const openRecsBySev: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  for (const r of recsByStatusAndSeverity) {
    if (r.status === "OPEN" || r.status === "IN_PROGRESS") {
      openRecsBySev[r.severity] =
        (openRecsBySev[r.severity] ?? 0) + r._count._all;
    }
  }

  // Score deltas
  function avg(rows: { compositeScore: number }[]): number {
    if (rows.length === 0) return 0;
    return rows.reduce((a, b) => a + b.compositeScore, 0) / rows.length;
  }
  const scoreNow = avg(scoresThisWeek);
  const scoreFourWeeksAgo = avg(scoresFourWeeksAgo);
  const scoreDelta = scoreFourWeeksAgo > 0 ? scoreNow - scoreFourWeeksAgo : 0;

  const totalApiCalls =
    serpThisMonth + auditsThisMonth + backlinksThisMonth + aeoChecksThisMonth;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          title="SEO Agent metrics"
          description="Cross-tenant observability for the SEO Agent pipeline. Drafts, recommendations, API volume, score movement."
        />
        <AdminRefreshAllButton />
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Drafts pending review"
          value={String(pendingReview)}
          hint={
            inGeneration > 0
              ? `${inGeneration} generating`
              : `${draftsLast7d} created in last 7d`
          }
          tone={pendingReview > 5 ? "danger" : undefined}
        />
        <StatCard
          label="Median review turnaround"
          value={fmtHours(medianTurnaround)}
          hint={`mean ${fmtHours(meanTurnaround)}, ${turnaroundMs.length} drafts`}
          tone={medianTurnaround > 48 * 60 * 60 * 1000 ? "danger" : undefined}
        />
        <StatCard
          label="Avg composite score"
          value={scoreNow > 0 ? Math.round(scoreNow).toString() : "—"}
          hint={
            scoreFourWeeksAgo > 0
              ? `${scoreDelta >= 0 ? "+" : ""}${scoreDelta.toFixed(1)} vs 4w ago`
              : "Insufficient history"
          }
          tone={scoreDelta < -3 ? "danger" : scoreDelta > 3 ? "success" : undefined}
        />
        <StatCard
          label="Active client orgs"
          value={String(clientOrgsCount)}
          hint={`${targetQueriesActive} active target queries`}
        />
      </div>

      {/* Draft pipeline breakdown */}
      <SectionCard
        label="Content draft pipeline"
        description="Funnel through approval. Audit-only — bulk operations live on /admin/content-drafts."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <DraftStatCell label="Generating" value={inGeneration} />
          <DraftStatCell label="Pending" value={pendingReview} />
          <DraftStatCell
            label="Changes req"
            value={draftStatusMap.get("CHANGES_REQUESTED") ?? 0}
          />
          <DraftStatCell label="Approved" value={totalApproved} />
          <DraftStatCell label="Shipped" value={totalShipped} tone="success" />
          <DraftStatCell label="Rejected" value={totalRejected} />
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground">
          <Link
            href="/admin/content-drafts"
            className="font-medium text-primary hover:underline"
          >
            Open queue →
          </Link>
        </p>
      </SectionCard>

      {/* SEO recommendations across portfolio */}
      <SectionCard
        label="Open SEO recommendations"
        description="Across every client org. OPEN + IN_PROGRESS. Terminal states (DISMISSED, COMPLETED, EXPIRED) excluded."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <RecStatCell
            label="Critical"
            value={openRecsBySev.CRITICAL}
            tone="critical"
          />
          <RecStatCell label="High" value={openRecsBySev.HIGH} tone="high" />
          <RecStatCell
            label="Medium"
            value={openRecsBySev.MEDIUM}
            tone="medium"
          />
          <RecStatCell label="Low" value={openRecsBySev.LOW} tone="medium" />
        </div>
        <p className="mt-4 text-[12px] text-muted-foreground">
          Average{" "}
          <strong className="text-foreground">
            {fmtAvg(
              openRecsBySev.CRITICAL + openRecsBySev.HIGH,
              clientOrgsCount,
            )}
          </strong>{" "}
          critical + high per client.
        </p>
      </SectionCard>

      {/* DataforSEO usage (proxied by row counts) */}
      <SectionCard
        label="DataforSEO usage this month"
        description="Row counts proxy API call volume. Each row ≈ one paid API call (varies by endpoint)."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <UsageCell
            label="SERP rankings"
            value={serpThisMonth}
            unitCost="$0.0006"
          />
          <UsageCell
            label="Lighthouse audits"
            value={auditsThisMonth}
            unitCost="$0.0010"
          />
          <UsageCell
            label="Backlink summaries"
            value={backlinksThisMonth}
            unitCost="$0.0200"
          />
          <UsageCell
            label="AEO citation checks"
            value={aeoChecksThisMonth}
            unitCost="$0.0050"
          />
        </div>
        <p className="mt-4 text-[11.5px] text-muted-foreground">
          Approximate spend: <strong className="text-foreground">
            ${(
              serpThisMonth * 0.0006 +
              auditsThisMonth * 0.001 +
              backlinksThisMonth * 0.02 +
              aeoChecksThisMonth * 0.005
            ).toFixed(2)}
          </strong>{" "}
          across {totalApiCalls.toLocaleString()} rows. Unit costs are
          provider-list-price estimates — actual billing may differ.
        </p>
      </SectionCard>
    </div>
  );
}

function DraftStatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "success" ? "text-green-600" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function RecStatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium";
}) {
  const tones: Record<typeof tone, string> = {
    critical: "text-red-700 dark:text-red-300",
    high: "text-amber-700 dark:text-amber-300",
    medium: "text-foreground",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tones[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function UsageCell({
  label,
  value,
  unitCost,
}: {
  label: string;
  value: number;
  unitCost: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
        ~{unitCost}/row
      </p>
    </div>
  );
}
