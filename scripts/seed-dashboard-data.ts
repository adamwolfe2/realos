/**
 * scripts/seed-dashboard-data.ts
 *
 * Seeds the new dashboard tables (VisitorSession, VisitorEvent, SeoSnapshot,
 * SeoQuery, SeoLandingPage, AdAccount, AdCampaign, AdMetricDaily) with 30 days
 * of realistic-looking sample data for an existing tenant.
 *
 * Lets the operator dashboard at /portal show fully-populated tiles
 * immediately, without waiting for real pixel/ad/SEO data to flow in.
 *
 * Run:
 *   set -a; source .env.local; set +a; \
 *     pnpm exec tsx scripts/seed-dashboard-data.ts [--org=<slug>]
 *
 * Defaults to org slug "telegraph-commons" if --org not provided.
 *
 * Idempotent: deletes prior dashboard sample data for the org before re-seeding.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  AdPlatform,
  SeoProvider,
  SeoSyncStatus,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// PRODUCTION SAFETY — three independent guards must all clear before this
// script writes any rows. The Norman launch demanded NO MORE FAKE DATA in
// production. This used to allow a SEED_DEMO_DATA=1 backdoor that would let
// demo data flow into a live tenant; that backdoor is removed.
//
// If you need to seed dashboard data, point DATABASE_URL at a Neon branch
// or local DB and set ALLOW_DEMO_SEED=true.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "[seed-dashboard-data] Refusing to run when NODE_ENV=production. Aborting.",
  );
}
if (process.env.VERCEL_ENV === "production") {
  throw new Error(
    "[seed-dashboard-data] Refusing to run against a Vercel production environment. Aborting.",
  );
}
if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "[seed-dashboard-data] Demo seeding is disabled. Set ALLOW_DEMO_SEED=true to bypass — but only when DATABASE_URL points at a throwaway DB.",
  );
}

const connectionString = process.env.DATABASE_URL;

// Hostname heuristic — refuses any DATABASE_URL containing prod-sounding
// tokens unless the operator explicitly waives the guard. Catches the
// common "I forgot which .env was loaded" footgun.
if (connectionString) {
  const lower = connectionString.toLowerCase();
  const looksProd = ["prod", "production", "live", "primary"].some((k) =>
    lower.includes(k),
  );
  if (looksProd && process.env.I_KNOW_THIS_IS_NOT_PROD !== "true") {
    throw new Error(
      `[seed-dashboard-data] DATABASE_URL contains a production-looking token. ` +
        `Set I_KNOW_THIS_IS_NOT_PROD=true to override after triple-checking the connection string.`,
    );
  }
}
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}

const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

const orgSlug =
  process.argv.find((a) => a.startsWith("--org="))?.split("=")[1] ??
  "telegraph-commons";

function daysAgoMidnight(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function jitter(base: number, pct = 0.25): number {
  const span = base * pct;
  return Math.max(0, Math.round(base + (Math.random() * 2 - 1) * span));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const SAMPLE_PAGES = [
  "/",
  "/floor-plans",
  "/floor-plans/2-bed",
  "/floor-plans/1-bed",
  "/amenities",
  "/location",
  "/gallery",
  "/parents",
  "/contact",
];

const SAMPLE_REFERRERS = [
  "https://www.google.com/",
  "https://www.bing.com/",
  "direct",
  "https://www.instagram.com/",
  "https://www.reddit.com/r/berkeley",
  "https://duckduckgo.com/",
];

const SAMPLE_UTM = [
  { source: "google", medium: "cpc", campaign: "berkeley-housing-search" },
  { source: "meta", medium: "cpc", campaign: "spring-tour-promo" },
  { source: "google", medium: "organic", campaign: null },
  { source: null, medium: null, campaign: null },
  { source: "instagram", medium: "social", campaign: "campus-tours-q2" },
];

const SAMPLE_QUERIES = [
  "uc berkeley student housing",
  "telegraph commons berkeley",
  "berkeley off campus apartments",
  "student housing near uc berkeley",
  "furnished student apartments berkeley",
  "berkeley dorms private",
  "channing way berkeley apartments",
  "uc berkeley housing application",
  "telegraph avenue student housing",
  "berkeley student living",
];

async function main() {
  console.log(`Seeding dashboard sample data for org slug: ${orgSlug}`);

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    throw new Error(`Org with slug "${orgSlug}" not found. Run prisma seed first.`);
  }
  const orgId = org.id;
  console.log(`Found org: ${org.name} (${orgId})`);

  const properties = await prisma.property.findMany({
    where: { orgId },
    select: { id: true, name: true },
  });
  console.log(`Found ${properties.length} properties`);

  // Wipe prior sample data scoped to this org (idempotent)
  console.log("Clearing prior dashboard sample data...");
  await prisma.visitorEvent.deleteMany({ where: { orgId } });
  await prisma.visitorSession.deleteMany({ where: { orgId } });
  await prisma.seoQuery.deleteMany({ where: { orgId } });
  await prisma.seoLandingPage.deleteMany({ where: { orgId } });
  await prisma.seoSnapshot.deleteMany({ where: { orgId } });
  await prisma.adMetricDaily.deleteMany({ where: { orgId } });
  await prisma.adCampaign.deleteMany({ where: { orgId } });
  await prisma.adAccount.deleteMany({ where: { orgId } });

  // -------------------------------------------------------------------------
  // Visitor sessions + events (30 days)
  // -------------------------------------------------------------------------
  console.log("Seeding visitor sessions and events...");
  let sessionCount = 0;
  let eventCount = 0;
  for (let day = 30; day >= 0; day--) {
    const dayStart = daysAgoMidnight(day);
    const sessionsThisDay = jitter(28, 0.4);
    for (let i = 0; i < sessionsThisDay; i++) {
      const startedAt = new Date(
        dayStart.getTime() + Math.floor(Math.random() * 86400_000),
      );
      const utm = pick(SAMPLE_UTM);
      const pageviews = jitter(3, 0.6) || 1;
      const totalSeconds = jitter(120, 0.8);
      const maxScroll = Math.min(100, jitter(45, 0.6));
      const lastEventAt = new Date(startedAt.getTime() + totalSeconds * 1000);

      const session = await prisma.visitorSession.create({
        data: {
          orgId,
          anonymousId: `anon_${randomUUID().slice(0, 12)}`,
          sessionToken: `vst_${randomUUID()}`,
          firstUrl: `https://www.telegraphcommons.com${pick(SAMPLE_PAGES)}`,
          firstReferrer: pick(SAMPLE_REFERRERS),
          utmSource: utm.source,
          utmMedium: utm.medium,
          utmCampaign: utm.campaign,
          country: pick(["US", "US", "US", "US", "CA", "MX", "CN"]),
          language: "en-US",
          pageviewCount: pageviews,
          totalTimeSeconds: totalSeconds,
          maxScrollDepth: maxScroll,
          startedAt,
          lastEventAt,
          createdAt: startedAt,
          updatedAt: lastEventAt,
        },
        select: { id: true },
      });
      sessionCount++;

      // Per-session events (pageviews) — single-create to avoid HTTP-mode transactions
      for (let p = 0; p < pageviews; p++) {
        const occurredAt = new Date(
          startedAt.getTime() + (p * totalSeconds * 1000) / Math.max(pageviews, 1),
        );
        await prisma.visitorEvent.create({
          data: {
            orgId,
            sessionId: session.id,
            type: "pageview",
            url: `https://www.telegraphcommons.com${pick(SAMPLE_PAGES)}`,
            path: pick(SAMPLE_PAGES),
            occurredAt,
            createdAt: occurredAt,
          },
        });
        eventCount++;
      }
    }
  }
  console.log(`  Seeded ${sessionCount} sessions, ${eventCount} events`);

  // Inject ~5 "live now" sessions (lastEventAt within last 5 min)
  for (let i = 0; i < 5; i++) {
    const startedAt = new Date(Date.now() - Math.floor(Math.random() * 240_000));
    await prisma.visitorSession.create({
      data: {
        orgId,
        anonymousId: `anon_${randomUUID().slice(0, 12)}`,
        sessionToken: `vst_${randomUUID()}`,
        firstUrl: "https://www.telegraphcommons.com" + pick(SAMPLE_PAGES),
        firstReferrer: pick(SAMPLE_REFERRERS),
        utmSource: pick(SAMPLE_UTM).source,
        country: "US",
        language: "en-US",
        pageviewCount: jitter(2) + 1,
        totalTimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000),
        maxScrollDepth: jitter(40),
        startedAt,
        lastEventAt: new Date(),
        createdAt: startedAt,
        updatedAt: new Date(),
      },
    });
  }
  console.log("  Injected 5 live-now sessions");

  // -------------------------------------------------------------------------
  // SEO snapshots + queries + landing pages (30 days)
  // -------------------------------------------------------------------------
  console.log("Seeding SEO data...");

  // Mark integrations connected (so the dashboard shows green chips).
  // Demo seed writes to the legacy org-wide row (propertyId = NULL).
  // Manual find-then-update-or-create instead of upsert because Prisma
  // can't compound-key against a NULL propertyId leg.
  for (const provider of [SeoProvider.GSC, SeoProvider.GA4] as const) {
    const propertyIdentifier =
      provider === SeoProvider.GSC
        ? "https://www.telegraphcommons.com/"
        : "338445667";
    const existing = await prisma.seoIntegration.findFirst({
      where: { orgId, propertyId: null, provider },
      select: { id: true },
    });
    if (existing) {
      await prisma.seoIntegration.update({
        where: { id: existing.id },
        data: { status: SeoSyncStatus.IDLE, lastSyncAt: new Date() },
      });
    } else {
      await prisma.seoIntegration.create({
        data: {
          orgId,
          propertyId: null,
          provider,
          propertyIdentifier,
          serviceAccountEmail:
            "demo-seed@telegraphcommons.iam.gserviceaccount.com",
          serviceAccountJsonEncrypted: "DEMO_SEED",
          status: SeoSyncStatus.IDLE,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  for (let day = 30; day >= 0; day--) {
    const date = daysAgoMidnight(day);
    const impressions = jitter(420);
    const clicks = jitter(35);
    const sessions = jitter(58);
    const users = Math.max(1, Math.round(sessions * 0.86));
    await prisma.seoSnapshot.create({
      data: {
        orgId,
        date,
        organicSessions: sessions,
        organicUsers: users,
        totalImpressions: impressions,
        totalClicks: clicks,
        avgCtr: clicks / Math.max(impressions, 1),
        avgPosition: 8 + Math.random() * 6,
      },
    });

    // Top queries for the day (last 7 days only, to keep volume reasonable)
    if (day < 7) {
      for (const query of SAMPLE_QUERIES.slice(0, 8)) {
        const qImp = jitter(60);
        const qClk = jitter(5);
        await prisma.seoQuery.create({
          data: {
            orgId,
            date,
            query,
            impressions: qImp,
            clicks: qClk,
            ctr: qClk / Math.max(qImp, 1),
            position: 4 + Math.random() * 12,
          },
        });
      }
      for (const path of SAMPLE_PAGES.slice(0, 6)) {
        const url = `https://www.telegraphcommons.com${path}`;
        const sess = jitter(18);
        await prisma.seoLandingPage.create({
          data: {
            orgId,
            date,
            url,
            sessions: sess,
            users: Math.round(sess * 0.9),
            bounceRate: 0.3 + Math.random() * 0.4,
            avgEngagementTime: 30 + Math.random() * 90,
          },
        });
      }
    }
  }
  console.log("  Seeded 31 days of SEO snapshots + 7 days of queries/landing pages");

  // -------------------------------------------------------------------------
  // Ad accounts + campaigns + daily metrics (30 days)
  // -------------------------------------------------------------------------
  console.log("Seeding ad accounts, campaigns, and daily metrics...");

  const googleAccount = await prisma.adAccount.create({
    data: {
      orgId,
      platform: AdPlatform.GOOGLE_ADS,
      externalAccountId: "1234567890",
      displayName: "Telegraph Commons - Google Search",
      currency: "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncAt: new Date(),
    },
  });
  const metaAccount = await prisma.adAccount.create({
    data: {
      orgId,
      platform: AdPlatform.META,
      externalAccountId: "987654321098765",
      displayName: "Telegraph Commons - Meta Ads",
      currency: "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
      lastSyncAt: new Date(),
    },
  });

  const campaignSpecs = [
    {
      account: googleAccount,
      name: "UC Berkeley Housing - Search",
      objective: "SEARCH",
      dailyBudgetCents: 7500,
      avgDailySpend: 7200,
      avgClicks: 45,
      avgImpressions: 1800,
      avgConversions: 1.4,
    },
    {
      account: googleAccount,
      name: "Brand Campaign - Telegraph Commons",
      objective: "SEARCH",
      dailyBudgetCents: 3000,
      avgDailySpend: 2400,
      avgClicks: 28,
      avgImpressions: 600,
      avgConversions: 1.1,
    },
    {
      account: metaAccount,
      name: "Spring Tour Promo - IG Reels",
      objective: "OUTCOME_LEADS",
      dailyBudgetCents: 6000,
      avgDailySpend: 5800,
      avgClicks: 95,
      avgImpressions: 12000,
      avgConversions: 0.9,
    },
    {
      account: metaAccount,
      name: "Parents Audience - FB Feed",
      objective: "OUTCOME_TRAFFIC",
      dailyBudgetCents: 4000,
      avgDailySpend: 3700,
      avgClicks: 52,
      avgImpressions: 7500,
      avgConversions: 0.4,
    },
  ];

  const property = properties[0];
  for (const spec of campaignSpecs) {
    const campaign = await prisma.adCampaign.create({
      data: {
        orgId,
        propertyId: property?.id,
        adAccountId: spec.account.id,
        externalCampaignId: `c_${randomUUID().slice(0, 10)}`,
        name: spec.name,
        platform: spec.account.platform,
        status: "ENABLED",
        objective: spec.objective,
        dailyBudgetCents: spec.dailyBudgetCents,
        startDate: daysAgoMidnight(60),
      },
    });

    for (let day = 30; day >= 0; day--) {
      const date = daysAgoMidnight(day);
      const impressions = jitter(spec.avgImpressions);
      const clicks = Math.min(impressions, jitter(spec.avgClicks));
      const spendCents = jitter(spec.avgDailySpend);
      const conversions = Math.max(0, +(spec.avgConversions + (Math.random() - 0.5)).toFixed(2));
      const ctr = clicks / Math.max(impressions, 1);
      const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : 0;
      const costPerConversionCents =
        conversions > 0 ? Math.round(spendCents / conversions) : 0;

      await prisma.adMetricDaily.create({
        data: {
          orgId,
          adAccountId: spec.account.id,
          campaignId: campaign.id,
          date,
          impressions,
          clicks,
          spendCents,
          conversions,
          ctr,
          cpcCents,
          costPerConversionCents,
        },
      });
    }
  }
  console.log(`  Seeded ${campaignSpecs.length} campaigns, ~${campaignSpecs.length * 31} daily metrics`);

  console.log("\nDone. Visit /portal to see the populated dashboard.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
