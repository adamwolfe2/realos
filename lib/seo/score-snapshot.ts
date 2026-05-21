import "server-only";

// ---------------------------------------------------------------------------
// Weekly score snapshot writer. Runs every Monday 05:00 UTC alongside
// the fact-table aggregation cron. Produces one SeoScoreHistory row per
// (orgId, propertyId, weekOf=Mon00:00UTC).
//
// Composite formula (0-100):
//   composite = 0.35*technical + 0.35*content + 0.30*authority
//
// Each sub-score is 0-100, derived from the last 7 days of cached data:
//
//   technicalScore   = avg(OnPageInstantAudit.seoScore) on a 0-100 scale,
//                      falling back to Lighthouse SEO score, falling back
//                      to 50 if neither is present.
//   contentScore     = (ranked queries in top 10) / (active target queries)
//                      * 100, clamped to [0, 100].
//   authorityScore   = backlinks.domainRank (0-1000 from DataforSEO)
//                      mapped to 0-100, else 0.
//   aeoCitationRate  = cited / total checks in the trailing 30d.
//   organicTrafficIdx = current 7d organic clicks / prior 7d clicks * 100
//                       (clamped 0-200, surfaced as index).
//   conversionRateIdx = same shape using sessions -> conversions when GA4
//                       events exist; 50 as a neutral default otherwise.
// ---------------------------------------------------------------------------

import { prisma } from "@/lib/db";
import { AeoCitationStatus } from "@prisma/client";

function mondayUtcOf(d: Date): Date {
  const out = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = out.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const delta = (dow + 6) % 7; // distance to most recent Monday
  out.setUTCDate(out.getUTCDate() - delta);
  return out;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function technicalScoreFor(
  orgId: string,
  propertyId: string,
): Promise<number> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const instant = await prisma.onPageInstantAudit
    .findFirst({
      where: { orgId, propertyId, date: { gte: since } },
      orderBy: { date: "desc" },
      select: {
        issuesCritical: true,
        issuesWarning: true,
        issuesNotice: true,
      },
    })
    .catch(() => null);
  if (instant) {
    // Composite penalty: critical = -5, warning = -2, notice = -1.
    const penalty =
      instant.issuesCritical * 5 +
      instant.issuesWarning * 2 +
      instant.issuesNotice * 1;
    return clamp(100 - penalty, 0, 100);
  }

  const lighthouse = await prisma.onPageAudit
    .findFirst({
      where: { orgId, propertyId, date: { gte: since } },
      orderBy: { date: "desc" },
      select: { seo: true },
    })
    .catch(() => null);
  if (lighthouse?.seo != null) {
    return clamp(Math.round(lighthouse.seo * 100), 0, 100);
  }
  return 50;
}

async function contentScoreFor(
  orgId: string,
  propertyId: string,
): Promise<number> {
  const active = await prisma.seoTargetQuery
    .count({
      where: { orgId, propertyId, active: true },
    })
    .catch(() => 0);
  if (active === 0) return 0;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const ranked = await prisma.serpRanking
    .findMany({
      where: {
        orgId,
        propertyId,
        date: { gte: since },
        ourRank: { not: null, lte: 10 },
      },
      distinct: ["query"],
      select: { query: true },
    })
    .catch(() => [] as Array<{ query: string }>);
  return clamp(Math.round((ranked.length / active) * 100), 0, 100);
}

async function authorityScoreFor(
  orgId: string,
  propertyId: string,
): Promise<number> {
  const latest = await prisma.backlinkSummary
    .findFirst({
      where: { orgId, propertyId },
      orderBy: { date: "desc" },
      select: { domainRank: true },
    })
    .catch(() => null);
  if (latest?.domainRank == null) return 0;
  return clamp(Math.round(latest.domainRank / 10), 0, 100);
}

async function aeoCitationRateFor(
  orgId: string,
  propertyId: string,
): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const total = await prisma.aeoCitationCheck
    .count({
      where: { orgId, propertyId, queryRunAt: { gte: since } },
    })
    .catch(() => 0);
  if (total === 0) return 0;
  const cited = await prisma.aeoCitationCheck
    .count({
      where: {
        orgId,
        propertyId,
        queryRunAt: { gte: since },
        status: AeoCitationStatus.CITED,
      },
    })
    .catch(() => 0);
  return Math.round((cited / total) * 1000) / 1000;
}

async function organicTrafficIdxFor(
  orgId: string,
  propertyId: string,
): Promise<number> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const current = await prisma.seoQuery
    .aggregate({
      where: { orgId, date: { gte: sevenDaysAgo } },
      _sum: { clicks: true },
    })
    .catch(() => ({ _sum: { clicks: null as number | null } }));
  const prior = await prisma.seoQuery
    .aggregate({
      where: { orgId, date: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _sum: { clicks: true },
    })
    .catch(() => ({ _sum: { clicks: null as number | null } }));
  void propertyId; // GSC is org-scoped today; per-property arrives with property mapping.
  const cur = current._sum.clicks ?? 0;
  const pri = prior._sum.clicks ?? 0;
  if (pri === 0) return cur > 0 ? 150 : 100;
  return clamp(Math.round((cur / pri) * 100), 0, 200);
}

export type ScoreSnapshot = {
  weekOf: Date;
  technicalScore: number;
  contentScore: number;
  authorityScore: number;
  aeoCitationRate: number;
  organicTrafficIdx: number;
  conversionRateIdx: number;
  compositeScore: number;
};

export async function computeScoreSnapshot(input: {
  orgId: string;
  propertyId: string;
  weekOf?: Date;
}): Promise<ScoreSnapshot> {
  const weekOf = mondayUtcOf(input.weekOf ?? new Date());
  const [technicalScore, contentScore, authorityScore, aeoCitationRate, organicTrafficIdx] =
    await Promise.all([
      technicalScoreFor(input.orgId, input.propertyId),
      contentScoreFor(input.orgId, input.propertyId),
      authorityScoreFor(input.orgId, input.propertyId),
      aeoCitationRateFor(input.orgId, input.propertyId),
      organicTrafficIdxFor(input.orgId, input.propertyId),
    ]);
  const conversionRateIdx = 50; // Neutral default until GA4 conversion mapping ships.
  const compositeScore = Math.round(
    0.35 * technicalScore + 0.35 * contentScore + 0.3 * authorityScore,
  );
  return {
    weekOf,
    technicalScore,
    contentScore,
    authorityScore,
    aeoCitationRate,
    organicTrafficIdx,
    conversionRateIdx,
    compositeScore,
  };
}

export async function writeScoreSnapshot(input: {
  orgId: string;
  propertyId: string;
  weekOf?: Date;
}): Promise<void> {
  const snapshot = await computeScoreSnapshot(input);
  await prisma.seoScoreHistory.upsert({
    where: {
      orgId_propertyId_weekOf: {
        orgId: input.orgId,
        propertyId: input.propertyId,
        weekOf: snapshot.weekOf,
      },
    },
    create: {
      orgId: input.orgId,
      propertyId: input.propertyId,
      weekOf: snapshot.weekOf,
      technicalScore: snapshot.technicalScore,
      contentScore: snapshot.contentScore,
      authorityScore: snapshot.authorityScore,
      aeoCitationRate: snapshot.aeoCitationRate,
      organicTrafficIdx: snapshot.organicTrafficIdx,
      conversionRateIdx: snapshot.conversionRateIdx,
      compositeScore: snapshot.compositeScore,
    },
    update: {
      technicalScore: snapshot.technicalScore,
      contentScore: snapshot.contentScore,
      authorityScore: snapshot.authorityScore,
      aeoCitationRate: snapshot.aeoCitationRate,
      organicTrafficIdx: snapshot.organicTrafficIdx,
      conversionRateIdx: snapshot.conversionRateIdx,
      compositeScore: snapshot.compositeScore,
    },
  });
}
