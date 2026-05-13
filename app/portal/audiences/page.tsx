import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductLine } from "@prisma/client";
import { getScope } from "@/lib/tenancy/scope";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { KpiTile } from "@/components/portal/dashboard/kpi-tile";
import { DashboardSection } from "@/components/portal/dashboard/dashboard-section";
import { RefreshSegmentsButton } from "@/components/audiences/refresh-button";
import { AddSegmentButton } from "@/components/audiences/add-segment-button";
import { SegmentListView } from "@/components/audiences/segment-list-view";
import { TopLocations } from "@/components/audiences/top-locations";
import { RecentSyncs } from "@/components/audiences/recent-syncs";
import { FailureBanner, type FailureSummary } from "@/components/audiences/failure-banner";
import {
  Target,
  Users,
  Send,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience segments" };

const DAY = 24 * 60 * 60 * 1000;

function deterministicSpark(seed: string, base: number): number[] {
  // Stable per-segment 28d sparkline. Replace with real reach history once
  // we cache member counts over time.
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const arr: number[] = [];
  for (let i = 0; i < 28; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const noise = (h % 1000) / 1000;
    const trend = i / 28;
    arr.push(Math.max(0, Math.round(base * (0.7 + 0.3 * trend) * (0.85 + 0.3 * noise))));
  }
  return arr;
}

export default async function AudiencesPage() {
  const scope = await getScope();
  if (!scope) redirect("/sign-in");
  if (scope.productLine !== ProductLine.AUDIENCE_SYNC && !scope.isAlPartner) {
    redirect("/portal");
  }

  const since28d = new Date(Date.now() - 28 * DAY);
  const sincePrev28d = new Date(Date.now() - 56 * DAY);
  const since24h = new Date(Date.now() - DAY);

  const [
    segments,
    destinationCount,
    totalRunsAllTime,
    runs28d,
    runsPrev28d,
    recentRuns,
    destinationsBySegment,
    activeDestinations,
    failedRuns24h,
    orgKeyStatus,
  ] = await Promise.all([
    prisma.audienceSegment.findMany({
      where: { orgId: scope.orgId, visible: true },
      orderBy: [{ memberCount: "desc" }, { name: "asc" }],
      take: 100,
    }),
    prisma.audienceDestination.count({
      where: { orgId: scope.orgId, enabled: true },
    }),
    prisma.audienceSyncRun.count({
      where: { orgId: scope.orgId, status: "SUCCESS" },
    }),
    prisma.audienceSyncRun.aggregate({
      where: {
        orgId: scope.orgId,
        status: "SUCCESS",
        startedAt: { gte: since28d },
      },
      _sum: { memberCount: true },
      _count: { _all: true },
    }),
    prisma.audienceSyncRun.aggregate({
      where: {
        orgId: scope.orgId,
        status: "SUCCESS",
        startedAt: { gte: sincePrev28d, lt: since28d },
      },
      _sum: { memberCount: true },
      _count: { _all: true },
    }),
    prisma.audienceSyncRun.findMany({
      where: { orgId: scope.orgId },
      orderBy: { startedAt: "desc" },
      take: 8,
      include: {
        segment: { select: { id: true, name: true } },
        destination: { select: { name: true, type: true } },
      },
    }),
    prisma.audienceDestination.groupBy({
      by: ["segmentId"],
      where: { orgId: scope.orgId, enabled: true },
      _count: { _all: true },
    }),
    prisma.audienceDestination.findMany({
      where: { orgId: scope.orgId, enabled: true },
      select: { id: true, name: true, type: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.audienceSyncRun.findMany({
      where: {
        orgId: scope.orgId,
        status: "FAILED",
        startedAt: { gte: since24h },
      },
      orderBy: { startedAt: "desc" },
      include: {
        destination: { select: { name: true } },
      },
    }),
    prisma.organization.findUnique({
      where: { id: scope.orgId },
      select: { cursiveApiKeyOverride: true },
    }),
  ]);

  const usingCustomKey = !!orgKeyStatus?.cursiveApiKeyOverride;

  const destCountBySegment = new Map<string, number>();
  for (const row of destinationsBySegment) {
    if (row.segmentId) destCountBySegment.set(row.segmentId, row._count._all);
  }

  const totalReach = segments.reduce((sum, s) => sum + (s.memberCount ?? 0), 0);
  const reach28d = runs28d._sum.memberCount ?? 0;
  const reachPrev = runsPrev28d._sum.memberCount ?? 0;
  const reachDeltaPct =
    reachPrev > 0
      ? Math.round(((reach28d - reachPrev) / reachPrev) * 100)
      : reach28d > 0
        ? 100
        : null;
  const pushes28d = runs28d._count?._all ?? 0;

  const stateAgg = new Map<string, number>();
  for (const seg of segments) {
    const raw = seg.rawPayload as Record<string, unknown> | null;
    if (!raw) continue;
    const stateBreakdown = raw.top_states as
      | Array<{ state: string; count: number }>
      | undefined;
    if (!stateBreakdown) continue;
    for (const entry of stateBreakdown) {
      stateAgg.set(
        entry.state,
        (stateAgg.get(entry.state) ?? 0) + (entry.count ?? 0),
      );
    }
  }
  const topStates = Array.from(stateAgg.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const segmentRows = segments.map((s) => {
    const raw = (s.rawPayload as Record<string, unknown> | null) ?? null;
    const stateBreakdown = raw?.top_states as
      | Array<{ state: string; count: number }>
      | undefined;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      alSegmentId: s.alSegmentId,
      memberCount: s.memberCount,
      lastFetchedAt: s.lastFetchedAt ? s.lastFetchedAt.getTime() : null,
      spark: deterministicSpark(s.alSegmentId, s.memberCount),
      destinationCount: destCountBySegment.get(s.id) ?? 0,
      emailMatchRate:
        typeof raw?.email_match_rate === "number"
          ? (raw.email_match_rate as number)
          : null,
      phoneMatchRate:
        typeof raw?.phone_match_rate === "number"
          ? (raw.phone_match_rate as number)
          : null,
      topStates: stateBreakdown?.map((s) => s.state) ?? [],
    };
  });

  const availableStates = Array.from(stateAgg.keys()).sort();

  const recentSyncRows = recentRuns.map((r) => ({
    id: r.id,
    segmentId: r.segment.id,
    segmentName: r.segment.name,
    destinationName: r.destination.name,
    destinationType: r.destination.type,
    status: r.status,
    memberCount: r.memberCount,
    startedAt: r.startedAt,
    errorMessage: r.errorMessage,
  }));

  // Group failed runs by destination for the alert banner
  const failuresByDestination = new Map<
    string,
    { count: number; destinationName: string; lastError: string | null; lastFailedAt: Date }
  >();
  for (const run of failedRuns24h) {
    const key = run.destination.name;
    const existing = failuresByDestination.get(key);
    if (existing) {
      existing.count += 1;
      if (run.startedAt > existing.lastFailedAt) {
        existing.lastFailedAt = run.startedAt;
        existing.lastError = run.errorMessage;
      }
    } else {
      failuresByDestination.set(key, {
        count: 1,
        destinationName: key,
        lastError: run.errorMessage,
        lastFailedAt: run.startedAt,
      });
    }
  }
  const failureSummaries: FailureSummary[] = Array.from(
    failuresByDestination.values(),
  ).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-5">
      <FailureBanner
        totalFailedRuns={failedRuns24h.length}
        destinations={failureSummaries}
      />

      <PageHeader
        title="Audience segments"
        description="Live segments from your AudienceLab catalog. Push to ad accounts, CRMs, or download as CSV."
        meta={
          usingCustomKey ? (
            <>
              Using a custom AudienceLab key.{" "}
              <Link
                href="/portal/audiences/settings"
                className="underline-offset-2 hover:underline text-foreground"
              >
                Manage
              </Link>
            </>
          ) : null
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="rounded-md">
              <Link href="/portal/audiences/destinations">
                <Send />
                Destinations
              </Link>
            </Button>
            <RefreshSegmentsButton variant="outline" />
            <AddSegmentButton />
          </>
        }
      />

      <section
        aria-label="Audience metrics"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <KpiTile
          label="Active segments"
          value={segments.length.toLocaleString()}
          hint={
            segments.length > 0
              ? `${formatCount(totalReach)} total reach`
              : "Pull your AL catalog to begin"
          }
          icon={<Target className="h-3.5 w-3.5" />}
        />
        <KpiTile
          label="Pushed in 28d"
          value={reach28d.toLocaleString()}
          hint={`${pushes28d} successful pushes`}
          icon={<Users className="h-3.5 w-3.5" />}
          delta={
            reachDeltaPct != null
              ? {
                  value: `${reachDeltaPct >= 0 ? "+" : ""}${reachDeltaPct}%`,
                  trend:
                    reachDeltaPct > 0
                      ? "up"
                      : reachDeltaPct < 0
                        ? "down"
                        : "flat",
                }
              : undefined
          }
        />
        <KpiTile
          label="Sync destinations"
          value={destinationCount.toLocaleString()}
          hint="Connected ad accounts + webhooks"
          icon={<Send className="h-3.5 w-3.5" />}
          href="/portal/audiences/destinations"
        />
        <KpiTile
          label="Lifetime pushes"
          value={totalRunsAllTime.toLocaleString()}
          hint="All-time successful syncs"
          icon={<Activity className="h-3.5 w-3.5" />}
          href="/portal/audiences/history"
        />
      </section>

      <DashboardSection
        eyebrow="Live catalog"
        title="Available segments"
        description={
          segments.length === 0
            ? "Click Add segment to paste an AudienceLab segment ID. We validate it on save and unlock everything else from there."
            : `${segments.length} segment${segments.length === 1 ? "" : "s"} ready to push. Search, filter, and push inline without leaving the page.`
        }
        href="/portal/audiences/destinations"
        hrefLabel="Manage destinations"
      >
        <SegmentListView
          rows={segmentRows}
          destinations={activeDestinations}
          availableStates={availableStates}
        />
      </DashboardSection>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <DashboardSection
          eyebrow="Geographic reach"
          title="Top states"
          description="Member distribution across your active segments"
          className="lg:col-span-2"
        >
          <TopLocations
            rows={topStates}
            emptyHint="State breakdown will appear once segments include location data."
          />
        </DashboardSection>

        <DashboardSection
          eyebrow="Activity"
          title="Recent syncs"
          description="Latest pushes across all destinations"
          href="/portal/audiences/history"
          className="lg:col-span-3"
        >
          <RecentSyncs rows={recentSyncRows} />
        </DashboardSection>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
