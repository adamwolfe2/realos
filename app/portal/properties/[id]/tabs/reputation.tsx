import { prisma } from "@/lib/db";
import {
  ScannerPanel,
  type InitialScan,
} from "@/components/portal/reputation/scanner-panel";
import type { MentionView } from "@/components/portal/reputation/mention-card";
import { MetricsPanel } from "@/components/portal/reputation/metrics-panel";
import {
  loadReputationMetrics,
  type ReputationMetrics,
} from "@/lib/reputation/aggregate";

// ---------------------------------------------------------------------------
// Reputation tab — server component. Seeds the client scanner with the 20
// most recent mentions and the 10 most recent scans so first render is
// instant (no loading spinner) even if the user hasn't triggered a scan
// yet this session.
// ---------------------------------------------------------------------------

const INITIAL_PAGE_SIZE = 20;

export async function ReputationTab({
  orgId,
  propertyId,
  propertyName,
  propertyAddress,
}: {
  orgId: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string | null;
}) {
  // Defensive: the Reputation tab renders in the property-tabs panel set
  // even when inactive (CSS-hidden). If the schema migration for
  // PropertyMention/ReputationScan has not yet been applied in production,
  // we fall back to an empty initial state so the whole property page does
  // not 500. Once the migration is run, this block succeeds normally.
  let mentionRows: Array<{
    id: string;
    source: import("@prisma/client").MentionSource;
    sourceUrl: string;
    title: string | null;
    excerpt: string;
    authorName: string | null;
    publishedAt: Date | null;
    rating: number | null;
    sentiment: import("@prisma/client").Sentiment | null;
    topics: unknown;
    reviewedByUserId: string | null;
    flagged: boolean;
  }> = [];
  let scanRows: Array<{
    id: string;
    status: import("@prisma/client").ReputationScanStatus;
    createdAt: Date;
    totalMentionCount: number;
    newMentionCount: number;
  }> = [];
  let latestScan: { completedAt: Date | null } | null = null;
  let metrics: ReputationMetrics | null = null;
  try {
    [mentionRows, scanRows, latestScan, metrics] = await Promise.all([
      prisma.propertyMention.findMany({
        where: { orgId, propertyId },
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        take: INITIAL_PAGE_SIZE + 1,
        select: {
          id: true,
          source: true,
          sourceUrl: true,
          title: true,
          excerpt: true,
          authorName: true,
          publishedAt: true,
          rating: true,
          sentiment: true,
          topics: true,
          reviewedByUserId: true,
          flagged: true,
        },
      }),
      prisma.reputationScan.findMany({
        where: { orgId, propertyId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          createdAt: true,
          totalMentionCount: true,
          newMentionCount: true,
        },
      }),
      prisma.reputationScan.findFirst({
        where: {
          orgId,
          propertyId,
          completedAt: { not: null },
        },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
      loadReputationMetrics(orgId, propertyId),
    ]);
  } catch {
    // Schema not migrated yet, or transient DB error — render empty state.
  }

  const hasMore = mentionRows.length > INITIAL_PAGE_SIZE;
  const mentions = (hasMore ? mentionRows.slice(0, INITIAL_PAGE_SIZE) : mentionRows).map(
    (r): MentionView => ({
      id: r.id,
      source: r.source,
      sourceUrl: r.sourceUrl,
      title: r.title,
      excerpt: r.excerpt,
      authorName: r.authorName,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
      rating: r.rating,
      sentiment: r.sentiment,
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      reviewed: r.reviewedByUserId !== null,
      flagged: r.flagged,
    }),
  );

  const initialScans: InitialScan[] = scanRows.map((s) => ({
    id: s.id,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    totalMentionCount: s.totalMentionCount,
    newMentionCount: s.newMentionCount,
  }));

  // Bug #37 — when the operator lands on the Reputation tab and we
  // haven't scanned in the last 7 days (or ever), kick off a
  // background scan automatically so the surface feels live without
  // requiring an explicit "Search now" click. The auto-trigger only
  // fires on mount — subsequent visits within the freshness window
  // are no-ops.
  const STALE_DAYS = 7;
  const completedAt = latestScan?.completedAt ?? null;
  const isStale =
    completedAt == null ||
    Date.now() - completedAt.getTime() > STALE_DAYS * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {metrics ? <MetricsPanel metrics={metrics} /> : null}
      <ScannerPanel
        propertyId={propertyId}
        propertyName={propertyName}
        propertyAddress={propertyAddress}
        initialMentions={mentions}
        initialScans={initialScans}
        initialNextCursor={hasMore ? mentions[mentions.length - 1].id : null}
        lastScanAt={latestScan?.completedAt?.toISOString() ?? null}
        autoScanIfStale={isStale}
      />
    </div>
  );
}
