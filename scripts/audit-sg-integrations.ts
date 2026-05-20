/**
 * scripts/audit-sg-integrations.ts
 *
 * READ-ONLY pre-launch audit of SG Real Estate's marketing-data
 * integrations. SG goes live Friday and has NO Google Ads / Meta Ads
 * accounts wired — their entire post-launch data story is GA4 + GSC +
 * Reputation + AEO. This script prints, for SG specifically:
 *
 *   - GA4: connected? property ID? last sync? row count last 7d?
 *   - GSC: connected? site URL? last sync? clicks/impressions last 7d?
 *   - Reputation sources: how many properties have GBP / Yelp / Reddit
 *     configured? Last scan? mention count?
 *   - AEO: any AeoCitationCheck rows? last queryRunAt? overall citation
 *     rate (last 30d)?
 *   - Neighborhood pages: how many PUBLISHED?
 *
 * No mutations. Pattern: scripts/diagnose-visitors.mjs +
 * scripts/provision-sg-real-estate.ts (read-only branches).
 *
 * Usage:
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/audit-sg-integrations.ts
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set. Source .env.local first.");

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(url, {} as HTTPQueryOptions<boolean, boolean>),
});

const SG_LOOKUP_SLUGS = ["sg-real-estate", "sgrealestate", "sg", "sg-realty"];
const SG_LOOKUP_NAMES = ["SG Real Estate", "SG Realty", "SG"];

const DAY_MS = 24 * 60 * 60 * 1000;

const log = {
  info: (msg: string) => console.log(`[audit-sg] ${msg}`),
  section: (title: string) => console.log(`\n[audit-sg] === ${title} ===`),
  ok: (msg: string) => console.log(`[audit-sg]   OK   ${msg}`),
  warn: (msg: string) => console.log(`[audit-sg]   WARN ${msg}`),
  miss: (msg: string) => console.log(`[audit-sg]   --   ${msg}`),
};

function fmtAge(date: Date | null | undefined): string {
  if (!date) return "never";
  const ms = Date.now() - date.getTime();
  const h = Math.floor(ms / (60 * 60 * 1000));
  if (h < 1) return `${Math.floor(ms / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function findSg() {
  const exact = await prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { in: SG_LOOKUP_SLUGS } },
        { name: { in: SG_LOOKUP_NAMES } },
      ],
    },
  });
  if (exact) return exact;
  return prisma.organization.findFirst({
    where: {
      OR: [
        { slug: { startsWith: "sg-" } },
        { name: { startsWith: "SG " } },
        { name: { contains: "SG Real Estate" } },
      ],
    },
  });
}

async function main() {
  log.info("starting read-only audit");

  const org = await findSg();
  if (!org) {
    log.warn(
      `SG org not found. Searched slugs=[${SG_LOOKUP_SLUGS.join(", ")}] and names.`,
    );
    log.warn("Run scripts/provision-sg-real-estate.ts first (or seed the org).");
    return;
  }
  log.info(
    `org: "${org.name}" (slug=${org.slug}, id=${org.id}, status=${org.status})`,
  );
  log.info(
    `modules: SEO=${org.moduleSEO} Pixel=${org.modulePixel} Chatbot=${org.moduleChatbot} Email=${org.moduleEmail} GoogleAds=${org.moduleGoogleAds} MetaAds=${org.moduleMetaAds}`,
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);

  // ──────────────────────────────────────────────────────────────────
  // GA4
  // ──────────────────────────────────────────────────────────────────
  log.section("GA4");
  const ga4Rows = await prisma.seoIntegration.findMany({
    where: {
      orgId: org.id,
      provider: "GA4",
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
    },
    select: {
      id: true,
      propertyId: true,
      propertyIdentifier: true,
      serviceAccountEmail: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
    },
  });
  if (ga4Rows.length === 0) {
    log.miss("no GA4 integration rows for SG");
  } else {
    for (const r of ga4Rows) {
      const scope = r.propertyId ? `propertyId=${r.propertyId}` : "ORG-WIDE";
      log.ok(
        `GA4 ${r.propertyIdentifier} (${scope}) sa=${r.serviceAccountEmail ?? "—"} status=${r.status} last=${fmtAge(r.lastSyncAt)}`,
      );
      if (r.lastSyncError) log.warn(`  lastSyncError: ${r.lastSyncError}`);
    }
  }
  const ga4SnapshotsLast7d = await prisma.seoSnapshot.count({
    where: { orgId: org.id, date: { gte: sevenDaysAgo } },
  });
  const ga4Pages7d = await prisma.seoLandingPage.count({
    where: { orgId: org.id, date: { gte: sevenDaysAgo } },
  });
  log.info(
    `data: ${ga4SnapshotsLast7d} SeoSnapshot rows, ${ga4Pages7d} SeoLandingPage rows (last 7d)`,
  );

  // ──────────────────────────────────────────────────────────────────
  // GSC
  // ──────────────────────────────────────────────────────────────────
  log.section("GSC");
  const gscRows = await prisma.seoIntegration.findMany({
    where: {
      orgId: org.id,
      provider: "GSC",
      serviceAccountJsonEncrypted: { not: "DEMO_SEED" },
    },
    select: {
      id: true,
      propertyId: true,
      propertyIdentifier: true,
      serviceAccountEmail: true,
      status: true,
      lastSyncAt: true,
      lastSyncError: true,
    },
  });
  if (gscRows.length === 0) {
    log.miss("no GSC integration rows for SG");
  } else {
    for (const r of gscRows) {
      const scope = r.propertyId ? `propertyId=${r.propertyId}` : "ORG-WIDE";
      log.ok(
        `GSC ${r.propertyIdentifier} (${scope}) sa=${r.serviceAccountEmail ?? "—"} status=${r.status} last=${fmtAge(r.lastSyncAt)}`,
      );
      if (r.lastSyncError) log.warn(`  lastSyncError: ${r.lastSyncError}`);
    }
  }
  const gscAgg = await prisma.seoSnapshot.aggregate({
    where: { orgId: org.id, date: { gte: sevenDaysAgo } },
    _sum: { totalClicks: true, totalImpressions: true },
  });
  log.info(
    `data: ${gscAgg._sum.totalClicks ?? 0} clicks / ${gscAgg._sum.totalImpressions ?? 0} impressions (last 7d, from SeoSnapshot)`,
  );

  // ──────────────────────────────────────────────────────────────────
  // Reputation
  // ──────────────────────────────────────────────────────────────────
  log.section("Reputation");
  const properties = await prisma.property.findMany({
    where: { orgId: org.id },
    select: {
      id: true,
      name: true,
      googlePlaceId: true,
      googleReviewUrl: true,
      yelpBusinessId: true,
      redditSubreddits: true,
    },
  });
  const withGoogle = properties.filter((p) => !!p.googlePlaceId || !!p.googleReviewUrl);
  const withYelp = properties.filter((p) => !!p.yelpBusinessId);
  const withReddit = properties.filter(
    (p) => Array.isArray(p.redditSubreddits) && p.redditSubreddits.length > 0,
  );
  log.info(`properties total: ${properties.length}`);
  log.info(
    `sources configured: Google=${withGoogle.length}/${properties.length} Yelp=${withYelp.length}/${properties.length} Reddit=${withReddit.length}/${properties.length}`,
  );
  if (withGoogle.length === 0) {
    log.warn("no properties have a Google Business Profile configured — reputation scans will only hit Tavily/Reddit/Yelp.");
  }

  const lastScan = await prisma.reputationScan.findFirst({
    where: { orgId: org.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, status: true, propertyId: true },
  });
  if (lastScan) {
    log.ok(`last scan: ${fmtAge(lastScan.createdAt)} status=${lastScan.status} propertyId=${lastScan.propertyId}`);
  } else {
    log.miss("no ReputationScan rows for SG — has never been scanned");
  }
  const mentionsCount = await prisma.propertyMention.count({
    where: { orgId: org.id },
  });
  const mentions7d = await prisma.propertyMention.count({
    where: { orgId: org.id, createdAt: { gte: sevenDaysAgo } },
  });
  log.info(`mentions: ${mentionsCount} total, ${mentions7d} new in last 7d`);

  // ──────────────────────────────────────────────────────────────────
  // AEO
  // ──────────────────────────────────────────────────────────────────
  log.section("AEO (AI search visibility)");
  const aeoLast = await prisma.aeoCitationCheck.findFirst({
    where: { orgId: org.id },
    orderBy: { queryRunAt: "desc" },
    select: { queryRunAt: true, engine: true, status: true },
  });
  if (!aeoLast) {
    log.miss("no AeoCitationCheck rows — never scanned. Weekly cron fires Mondays 02:00 UTC.");
  } else {
    log.ok(`last check: ${fmtAge(aeoLast.queryRunAt)} engine=${aeoLast.engine}`);
  }
  const aeo30 = await prisma.aeoCitationCheck.findMany({
    where: { orgId: org.id, queryRunAt: { gte: thirtyDaysAgo } },
    select: { status: true, engine: true },
  });
  if (aeo30.length > 0) {
    const cited = aeo30.filter((r) => r.status === "CITED").length;
    const byEngine = new Map<string, { total: number; cited: number }>();
    for (const r of aeo30) {
      const e = byEngine.get(r.engine) ?? { total: 0, cited: 0 };
      e.total += 1;
      if (r.status === "CITED") e.cited += 1;
      byEngine.set(r.engine, e);
    }
    log.info(
      `30d: ${cited}/${aeo30.length} cited (${((cited / aeo30.length) * 100).toFixed(0)}%)`,
    );
    for (const [eng, v] of byEngine.entries()) {
      log.info(`  ${eng}: ${v.cited}/${v.total}`);
    }
  }
  const engineKeys = {
    CLAUDE: !!process.env.ANTHROPIC_API_KEY,
    CHATGPT: !!process.env.OPENAI_API_KEY,
    PERPLEXITY: !!process.env.PERPLEXITY_API_KEY,
    GEMINI: !!process.env.GOOGLE_GEMINI_API_KEY || !!process.env.GEMINI_API_KEY,
  };
  log.info(
    `engine keys present: ${Object.entries(engineKeys)
      .map(([k, v]) => `${k}=${v ? "yes" : "no"}`)
      .join(" ")}`,
  );

  // ──────────────────────────────────────────────────────────────────
  // Neighborhood pages
  // ──────────────────────────────────────────────────────────────────
  log.section("Neighborhood pages");
  const nbGrouped = await prisma.neighborhoodPage.groupBy({
    by: ["status"],
    where: { orgId: org.id },
    _count: { _all: true },
  });
  if (nbGrouped.length === 0) {
    log.miss("no NeighborhoodPage rows for SG");
  } else {
    for (const g of nbGrouped) {
      log.info(`  ${g.status}: ${g._count._all}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Cron sanity — last successful run of seo-sync / aeo-scan
  // ──────────────────────────────────────────────────────────────────
  log.section("Cron health");
  for (const job of ["seo-sync", "aeo-scan"] as const) {
    const lastRun = await prisma.cronRun
      .findFirst({
        where: { jobName: job },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, status: true, recordsProcessed: true, error: true },
      })
      .catch(() => null);
    if (!lastRun) {
      log.warn(`${job}: no CronRun rows — has the cron ever fired?`);
    } else {
      const tag = lastRun.status === "ok" ? "OK  " : lastRun.status.toUpperCase();
      log.info(
        `${job}: ${tag} ${fmtAge(lastRun.startedAt)} records=${lastRun.recordsProcessed ?? 0}${lastRun.error ? ` err="${lastRun.error.slice(0, 80)}"` : ""}`,
      );
    }
  }

  log.info("\ndone.");
}

main()
  .catch((err) => {
    console.error("[audit-sg] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
