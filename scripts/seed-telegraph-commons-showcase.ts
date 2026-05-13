/**
 * scripts/seed-telegraph-commons-showcase.ts
 *
 * Companion to scripts/seed-telegraph-commons.ts. The original seed lays
 * down the foundation (domain, listings, leads, visitors, chatbot,
 * tours, creative). This script extends Telegraph Commons into a fully
 * populated SHOWCASE so Norman can walk prospects through every page
 * and see polished data instead of empty states.
 *
 * Adds:
 *   - Residents + Leases + WorkOrders     (Operations pages)
 *   - VisitorSession + VisitorEvent       (Visitor detail surfaces)
 *   - AdAccount + AdCampaign + 28d AdMetricDaily (Ads + Attribution)
 *   - SeoIntegration + 28d SeoSnapshot + SeoQuery + SeoLandingPage
 *   - ReputationScan + PropertyMention    (Reputation page)
 *   - Insight                             (Briefing + Insights cards)
 *   - ClientReport                        (Reports page + /r/[token])
 *   - Notification                        (Notifications page)
 *
 * Run order:
 *   pnpm db:seed                                    # Agency org + Telegraph
 *   pnpm exec tsx scripts/seed-telegraph-commons.ts # Foundation
 *   pnpm exec tsx scripts/seed-telegraph-commons-showcase.ts # Showcase
 *
 * Idempotent: safe to re-run. Uses upsert / skip-if-exists everywhere.
 *
 * PRODUCTION SAFETY: triple-guarded against running in production. Same
 * guard pattern as seed-telegraph-commons.ts so a slipped command line
 * can't pollute Norman's real org with synthetic data.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  Prisma,
  ResidentStatus,
  LeaseStatus,
  WorkOrderStatus,
  WorkOrderPriority,
  SeoProvider,
  SeoSyncStatus,
  ReputationScanStatus,
  MentionSource,
  Sentiment,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";
import { createHash, randomBytes } from "node:crypto";

// -----------------------------------------------------------------------------
// PRODUCTION SAFETY — same triple-guard as the foundation seed.
// -----------------------------------------------------------------------------

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "[seed-telegraph-commons-showcase] Refusing to run when NODE_ENV=production. Aborting.",
  );
}
if (process.env.VERCEL_ENV === "production") {
  throw new Error(
    "[seed-telegraph-commons-showcase] Refusing to run against a Vercel production environment. Aborting.",
  );
}
if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "[seed-telegraph-commons-showcase] Demo seeding is disabled. Set ALLOW_DEMO_SEED=true to bypass — but only do so when DATABASE_URL points at a throwaway DB.",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
}
{
  const lower = connectionString.toLowerCase();
  const looksProd = ["prod", "production", "live", "primary"].some((k) =>
    lower.includes(k),
  );
  if (looksProd && process.env.I_KNOW_THIS_IS_NOT_PROD !== "true") {
    throw new Error(
      `[seed-telegraph-commons-showcase] DATABASE_URL contains a production-looking token. ` +
        `Set I_KNOW_THIS_IS_NOT_PROD=true to override after triple-checking the connection string.`,
    );
  }
}

const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const ORG_SLUG = "telegraph-commons";

const daysAgo = (days: number, hours = 0): Date => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d;
};

const daysFromNow = (days: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
};

const dateOnly = (d: Date): Date => {
  // Normalize to UTC midnight so `@db.Date` columns don't fight us.
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const sortedToken = () => randomBytes(12).toString("base64url");

// Deterministic pseudo-random so re-runs produce stable curves rather
// than jittering the chart wildly each demo refresh.
function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    include: {
      properties: { orderBy: { createdAt: "asc" } },
      tenantSiteConfig: true,
    },
  });
  if (!org) {
    throw new Error(
      `Organization with slug "${ORG_SLUG}" not found. Run prisma/seed.ts first.`,
    );
  }
  const property = org.properties[0];
  if (!property) {
    throw new Error(
      `No Property found for org "${ORG_SLUG}". Run prisma/seed.ts and seed-telegraph-commons.ts first.`,
    );
  }
  const orgId = org.id;
  const propertyId = property.id;

  console.log(
    `Seeding showcase data for Telegraph Commons (${orgId} / property ${propertyId})…`,
  );

  // ---------------------------------------------------------------------------
  // 1. Listings — make sure unit numbers exist for residents to reference.
  //    The foundation seed creates 3 listings (1-bed, 2-bed, 3-bed); we
  //    don't want to add more, just record the IDs.
  // ---------------------------------------------------------------------------
  const listings = await prisma.listing.findMany({
    where: { propertyId },
    orderBy: { createdAt: "asc" },
  });

  // ---------------------------------------------------------------------------
  // 2. Residents + Leases (12 residents — enough to populate the roster
  //    but not so many the table requires pagination during a demo).
  //
  //    Mix of statuses so every column on the Residents page lights up:
  //      - 8 ACTIVE
  //      - 2 NOTICE_GIVEN  (drives the renewals "next out" surface)
  //      - 2 PAST          (proves the page handles archived rows)
  //
  //    Each ACTIVE / NOTICE_GIVEN resident gets a Lease pointed at one
  //    of the listings, with end dates spread across the next 120 days
  //    so the Renewals pipeline columns (0-30, 31-60, 61-90, 91-120)
  //    all populate.
  // ---------------------------------------------------------------------------

  type ResidentSpec = {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    status: ResidentStatus;
    unit: string;
    monthlyRentCents: number;
    moveInDaysAgo: number;
    /** Days from today the lease ends (negative = past). */
    leaseEndInDays: number;
    /** Optional notice-given offset (only for NOTICE_GIVEN). */
    noticeGivenDaysAgo?: number;
  };

  const RESIDENTS: ResidentSpec[] = [
    // Renewals across the four pipeline buckets ----------------------------
    { firstName: "Maya",    lastName: "Patel",     email: "maya.p@berkeley.edu",     phone: "+1-510-555-0102", status: "ACTIVE",        unit: "204", monthlyRentCents: 195000, moveInDaysAgo: 410, leaseEndInDays: 18 },
    { firstName: "Jordan",  lastName: "Kim",       email: "jordan.kim@berkeley.edu", phone: "+1-510-555-0103", status: "ACTIVE",        unit: "318", monthlyRentCents: 215000, moveInDaysAgo: 380, leaseEndInDays: 41 },
    { firstName: "Priya",   lastName: "Shah",      email: "priya.shah@berkeley.edu", phone: "+1-510-555-0104", status: "ACTIVE",        unit: "121", monthlyRentCents: 168000, moveInDaysAgo: 360, leaseEndInDays: 75 },
    { firstName: "Ethan",   lastName: "Nguyen",    email: "ethan.n@berkeley.edu",    phone: "+1-510-555-0105", status: "ACTIVE",        unit: "402", monthlyRentCents: 235000, moveInDaysAgo: 350, leaseEndInDays: 102 },
    // Notice given ---------------------------------------------------------
    { firstName: "Lena",    lastName: "Okafor",    email: "lena.o@berkeley.edu",     phone: "+1-510-555-0106", status: "NOTICE_GIVEN",  unit: "215", monthlyRentCents: 198000, moveInDaysAgo: 395, leaseEndInDays: 22, noticeGivenDaysAgo: 8 },
    { firstName: "Marcus",  lastName: "Reyes",     email: "marcus.r@berkeley.edu",   phone: "+1-510-555-0107", status: "NOTICE_GIVEN",  unit: "104", monthlyRentCents: 175000, moveInDaysAgo: 370, leaseEndInDays: 9,  noticeGivenDaysAgo: 12 },
    // Active long-tail -----------------------------------------------------
    { firstName: "Sara",    lastName: "Lopez",     email: "sara.lopez@berkeley.edu", phone: "+1-510-555-0108", status: "ACTIVE",        unit: "302", monthlyRentCents: 220000, moveInDaysAgo: 220, leaseEndInDays: 160 },
    { firstName: "Daniel",  lastName: "Park",      email: "daniel.p@berkeley.edu",   phone: "+1-510-555-0109", status: "ACTIVE",        unit: "211", monthlyRentCents: 195000, moveInDaysAgo: 200, leaseEndInDays: 175 },
    { firstName: "Aisha",   lastName: "Mohamed",   email: "aisha.m@berkeley.edu",    phone: "+1-510-555-0110", status: "ACTIVE",        unit: "117", monthlyRentCents: 168000, moveInDaysAgo: 180, leaseEndInDays: 195 },
    { firstName: "Wesley",  lastName: "Gomez",     email: "wesley.g@berkeley.edu",   phone: "+1-510-555-0111", status: "ACTIVE",        unit: "405", monthlyRentCents: 240000, moveInDaysAgo: 150, leaseEndInDays: 215 },
    // Past residents -------------------------------------------------------
    { firstName: "Hannah",  lastName: "Werner",    email: "hannah.w@berkeley.edu",   phone: "+1-510-555-0112", status: "PAST",          unit: "108", monthlyRentCents: 165000, moveInDaysAgo: 730, leaseEndInDays: -45 },
    { firstName: "Tyler",   lastName: "Brennan",   email: "tyler.b@berkeley.edu",    phone: "+1-510-555-0113", status: "PAST",          unit: "224", monthlyRentCents: 195000, moveInDaysAgo: 700, leaseEndInDays: -90 },
  ];

  let residentsCreated = 0;
  for (const spec of RESIDENTS) {
    const existing = await prisma.resident.findFirst({
      where: { orgId, email: spec.email },
    });
    if (existing) continue;

    const listing = listings[Math.floor(Math.random() * Math.max(1, listings.length))] ?? null;

    const resident = await prisma.resident.create({
      data: {
        orgId,
        propertyId,
        listingId: listing?.id ?? null,
        firstName: spec.firstName,
        lastName: spec.lastName,
        email: spec.email,
        phone: spec.phone,
        status: spec.status,
        unitNumber: spec.unit,
        moveInDate: daysAgo(spec.moveInDaysAgo),
        moveOutDate:
          spec.status === "PAST" ? daysFromNow(spec.leaseEndInDays) : null,
        noticeGivenDate:
          spec.status === "NOTICE_GIVEN" && spec.noticeGivenDaysAgo
            ? daysAgo(spec.noticeGivenDaysAgo)
            : null,
        monthlyRentCents: spec.monthlyRentCents,
        externalSystem: "demo",
        externalId: `tc-${spec.email}`,
      },
    });

    // Lease for this resident — only for ACTIVE / NOTICE_GIVEN. PAST
    // residents already have moveOutDate populated; their lease history
    // is implicit. Skipping past leases keeps the renewals pipeline clean.
    if (spec.status === "ACTIVE" || spec.status === "NOTICE_GIVEN") {
      const leaseStatus: LeaseStatus =
        spec.status === "NOTICE_GIVEN"
          ? "EXPIRING"
          : spec.leaseEndInDays <= 30
            ? "EXPIRING"
            : "ACTIVE";

      const lease = await prisma.lease.create({
        data: {
          orgId,
          propertyId,
          listingId: listing?.id ?? null,
          residentId: resident.id,
          status: leaseStatus,
          startDate: daysAgo(spec.moveInDaysAgo),
          endDate: daysFromNow(spec.leaseEndInDays),
          monthlyRentCents: spec.monthlyRentCents,
          securityDepositCents: spec.monthlyRentCents,
          termMonths: 12,
          noticeGivenAt:
            spec.status === "NOTICE_GIVEN" && spec.noticeGivenDaysAgo
              ? daysAgo(spec.noticeGivenDaysAgo)
              : null,
          externalSystem: "demo",
          externalId: `tc-lease-${spec.email}`,
        },
      });

      await prisma.resident.update({
        where: { id: resident.id },
        data: { currentLeaseId: lease.id },
      });
    }

    residentsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 3. WorkOrders — 8 spread across statuses + priorities so the page
  //    has a real mix to scan.
  // ---------------------------------------------------------------------------

  type WorkOrderSpec = {
    number: string;
    title: string;
    description: string;
    category: string;
    priority: WorkOrderPriority;
    status: WorkOrderStatus;
    unit: string;
    reportedDaysAgo: number;
    completedDaysAgo?: number;
    vendorName?: string;
    estimatedCostCents?: number;
  };

  const WORK_ORDERS: WorkOrderSpec[] = [
    { number: "WO-2026-0142", title: "Bedroom AC unit not cooling",      description: "Unit 318 reports the in-room AC blows warm air after 5 minutes. Filter looks fine.", category: "HVAC",       priority: "HIGH",   status: "IN_PROGRESS", unit: "318", reportedDaysAgo: 2, vendorName: "Bay HVAC Pros", estimatedCostCents: 35000 },
    { number: "WO-2026-0141", title: "Kitchen sink slow drain",           description: "Resident notes water pools 4-5 inches before draining. Started this week.",        category: "Plumbing",   priority: "NORMAL", status: "SCHEDULED",   unit: "204", reportedDaysAgo: 3, vendorName: "RotoRapid",     estimatedCostCents: 18000 },
    { number: "WO-2026-0140", title: "Dishwasher leaking from base",      description: "Small puddle on first cycle. Tray underneath is full each morning.",                  category: "Appliance",  priority: "HIGH",   status: "NEW",         unit: "402", reportedDaysAgo: 1 },
    { number: "WO-2026-0139", title: "Hallway light fixture flickering",  description: "Common-area fixture between 215 and 217 flickers when motion-sensor triggers.",        category: "Electrical", priority: "NORMAL", status: "NEW",         unit: "215", reportedDaysAgo: 4 },
    { number: "WO-2026-0138", title: "Replace bedroom door knob",         description: "Knob loose, doesn't latch securely. Tenant requested ASAP for security.",              category: "General",    priority: "NORMAL", status: "COMPLETED",   unit: "121", reportedDaysAgo: 6, completedDaysAgo: 1, vendorName: "Onsite team" },
    { number: "WO-2026-0137", title: "Bathroom exhaust fan loud",         description: "Operates but loud bearing rattle on startup. Resident reports it at night.",            category: "HVAC",       priority: "LOW",    status: "ON_HOLD",     unit: "302", reportedDaysAgo: 9 },
    { number: "WO-2026-0136", title: "Closet door off track",             description: "Bypass door slipped, will not slide closed.",                                            category: "General",    priority: "LOW",    status: "COMPLETED",   unit: "211", reportedDaysAgo: 11, completedDaysAgo: 2 },
    { number: "WO-2026-0135", title: "Lobby door auto-close not engaging", description: "Front entry door stays propped open after rush hours. Security concern.",               category: "Security",   priority: "URGENT", status: "COMPLETED",   unit: "117", reportedDaysAgo: 14, completedDaysAgo: 8, vendorName: "ProAccess Doors", estimatedCostCents: 65000 },
  ];

  let workOrdersCreated = 0;
  for (const spec of WORK_ORDERS) {
    const exists = await prisma.workOrder.findFirst({
      where: { orgId, workOrderNumber: spec.number },
    });
    if (exists) continue;

    await prisma.workOrder.create({
      data: {
        orgId,
        propertyId,
        workOrderNumber: spec.number,
        status: spec.status,
        priority: spec.priority,
        category: spec.category,
        title: spec.title,
        description: spec.description,
        unitNumber: spec.unit,
        vendorName: spec.vendorName ?? null,
        reportedAt: daysAgo(spec.reportedDaysAgo),
        completedAt:
          spec.completedDaysAgo != null ? daysAgo(spec.completedDaysAgo) : null,
        estimatedCostCents: spec.estimatedCostCents ?? null,
        externalSystem: "demo",
        externalId: `tc-${spec.number}`,
      },
    });
    workOrdersCreated++;
  }

  // ---------------------------------------------------------------------------
  // 4. VisitorSessions + VisitorEvents — give the existing visitors real
  //    pageview history so the visitor detail drawer and the dashboard
  //    "recent identified visitors" surface have something to render.
  // ---------------------------------------------------------------------------

  const visitors = await prisma.visitor.findMany({
    where: { orgId },
    take: 10,
    orderBy: { lastSeenAt: "desc" },
  });

  let sessionsCreated = 0;
  for (let i = 0; i < visitors.length; i++) {
    const v = visitors[i];
    const existing = await prisma.visitorSession.findFirst({
      where: { orgId, visitorId: v.id },
    });
    if (existing) continue;

    const startedAt = daysAgo(i + 1, Math.floor(Math.random() * 8));
    const session = await prisma.visitorSession.create({
      data: {
        orgId,
        visitorId: v.id,
        anonymousId: `anon-${v.id.slice(0, 12)}`,
        sessionToken: `tok-${v.id}-${i}`,
        deviceHash: sha256(`${v.id}-${i}-ua`),
        firstUrl: "https://telegraphcommons.com/",
        firstReferrer:
          i % 3 === 0
            ? "https://www.google.com/"
            : i % 3 === 1
              ? "https://www.instagram.com/"
              : "direct",
        utmSource: v.utmSource ?? (i % 2 === 0 ? "google" : "instagram"),
        utmMedium: v.utmMedium ?? (i % 2 === 0 ? "cpc" : "social"),
        utmCampaign: v.utmCampaign ?? "fall-fill",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        country: "US",
        language: "en-US",
        pageviewCount: 4 + (i % 5),
        totalTimeSeconds: 60 + i * 17,
        maxScrollDepth: Math.min(100, 35 + i * 8),
        startedAt,
        lastEventAt: new Date(startedAt.getTime() + (60 + i * 17) * 1000),
      },
    });

    // Synthesize 4-7 pageview events per session in chronological order.
    const eventCount = 4 + (i % 4);
    const PAGES = [
      { url: "https://telegraphcommons.com/", title: "Telegraph Commons — Berkeley Student Housing" },
      { url: "https://telegraphcommons.com/floor-plans/", title: "Floor Plans" },
      { url: "https://telegraphcommons.com/amenities/", title: "Amenities" },
      { url: "https://telegraphcommons.com/availabilities/", title: "Current Availabilities" },
      { url: "https://telegraphcommons.com/tour/", title: "Schedule a Tour" },
      { url: "https://telegraphcommons.com/contact/", title: "Contact" },
    ];
    for (let j = 0; j < eventCount; j++) {
      const page = PAGES[j % PAGES.length];
      await prisma.visitorEvent.create({
        data: {
          orgId,
          sessionId: session.id,
          visitorId: v.id,
          type: "pageview",
          url: page.url,
          path: new URL(page.url).pathname,
          title: page.title,
          referrer: j === 0 ? session.firstReferrer : page.url,
          scrollDepth: Math.min(100, 25 + j * 18),
          timeOnPageSeconds: 22 + j * 9,
          occurredAt: new Date(startedAt.getTime() + j * 25 * 1000),
        },
      });
    }
    sessionsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 5. AdAccount + AdCampaign + 28 days of AdMetricDaily — populate the
  //    Ads page with two real campaigns (Google Search + Meta Awareness)
  //    and 28 days of metrics so the line charts render with shape.
  // ---------------------------------------------------------------------------

  // Google Ads account + Search campaign --------------------------------
  const googleAccount = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId,
        platform: "GOOGLE_ADS",
        externalAccountId: "8472019333",
      },
    },
    update: {
      displayName: "Telegraph Commons — Google Search",
      accessStatus: "active",
      lastSyncAt: new Date(),
    },
    create: {
      orgId,
      platform: "GOOGLE_ADS",
      externalAccountId: "8472019333",
      displayName: "Telegraph Commons — Google Search",
      accessStatus: "active",
      currency: "USD",
      autoSyncEnabled: true,
      lastSyncAt: new Date(),
    },
  });

  const googleCampaign = await prisma.adCampaign.upsert({
    where: {
      adAccountId_externalCampaignId: {
        adAccountId: googleAccount.id,
        externalCampaignId: "tc-search-fall-fill",
      },
    },
    update: {
      name: "TC Search · Fall Fill",
      status: "ENABLED",
      monthlyBudgetCents: 180000,
      dailyBudgetCents: 6000,
      orgId,
      propertyId,
    },
    create: {
      orgId,
      propertyId,
      adAccountId: googleAccount.id,
      externalCampaignId: "tc-search-fall-fill",
      name: "TC Search · Fall Fill",
      platform: "GOOGLE_ADS",
      status: "ENABLED",
      objective: "SEARCH",
      monthlyBudgetCents: 180000,
      dailyBudgetCents: 6000,
      startDate: daysAgo(60),
    },
  });

  // Meta account + awareness campaign -----------------------------------
  const metaAccount = await prisma.adAccount.upsert({
    where: {
      orgId_platform_externalAccountId: {
        orgId,
        platform: "META",
        externalAccountId: "1029384756",
      },
    },
    update: {
      displayName: "Telegraph Commons — Meta",
      accessStatus: "active",
      lastSyncAt: new Date(),
    },
    create: {
      orgId,
      platform: "META",
      externalAccountId: "1029384756",
      displayName: "Telegraph Commons — Meta",
      accessStatus: "active",
      currency: "USD",
      autoSyncEnabled: true,
      lastSyncAt: new Date(),
    },
  });

  const metaCampaign = await prisma.adCampaign.upsert({
    where: {
      adAccountId_externalCampaignId: {
        adAccountId: metaAccount.id,
        externalCampaignId: "tc-meta-awareness",
      },
    },
    update: {
      name: "TC Meta · Campus Awareness",
      status: "ACTIVE",
      monthlyBudgetCents: 90000,
      dailyBudgetCents: 3000,
      orgId,
      propertyId,
    },
    create: {
      orgId,
      propertyId,
      adAccountId: metaAccount.id,
      externalCampaignId: "tc-meta-awareness",
      name: "TC Meta · Campus Awareness",
      platform: "META",
      status: "ACTIVE",
      objective: "OUTCOME_AWARENESS",
      monthlyBudgetCents: 90000,
      dailyBudgetCents: 3000,
      startDate: daysAgo(45),
    },
  });

  // 28 days of metrics for both campaigns. Seeded RNG so the chart
  // shape is stable across re-runs (matters when capturing screenshots
  // for marketing collateral).
  const metricsRng = seededRandom(8472019333);
  let metricsCreated = 0;
  for (const camp of [
    { campaign: googleCampaign, account: googleAccount, baseImpr: 2400, baseCpc: 215, ctr: 0.045 },
    { campaign: metaCampaign,   account: metaAccount,   baseImpr: 5800, baseCpc: 95,  ctr: 0.012 },
  ]) {
    for (let dayOffset = 27; dayOffset >= 0; dayOffset--) {
      const date = dateOnly(daysAgo(dayOffset));
      // ±25% jitter on impressions, ±15% on CPC.
      const impr = Math.round(camp.baseImpr * (0.75 + metricsRng() * 0.5));
      const clicks = Math.round(impr * camp.ctr * (0.85 + metricsRng() * 0.3));
      const cpcCents = Math.round(camp.baseCpc * (0.85 + metricsRng() * 0.3));
      const spendCents = clicks * cpcCents;
      const conversions = Math.round(clicks * 0.045 * (0.6 + metricsRng() * 0.8));
      const conversionValueCents = conversions * 195000; // est. lifetime value

      await prisma.adMetricDaily
        .upsert({
          where: {
            campaignId_date: {
              campaignId: camp.campaign.id,
              date,
            },
          },
          update: {
            impressions: impr,
            clicks,
            spendCents,
            conversions,
            conversionValueCents,
            ctr: clicks / Math.max(1, impr),
            cpcCents,
            costPerConversionCents:
              conversions > 0 ? Math.round(spendCents / conversions) : 0,
          },
          create: {
            orgId,
            adAccountId: camp.account.id,
            campaignId: camp.campaign.id,
            date,
            impressions: impr,
            clicks,
            spendCents,
            conversions,
            conversionValueCents,
            ctr: clicks / Math.max(1, impr),
            cpcCents,
            costPerConversionCents:
              conversions > 0 ? Math.round(spendCents / conversions) : 0,
          },
        })
        .catch(() => null);
      metricsCreated++;
    }
  }

  // Roll campaign-level totals from the 28-day window so the cards on
  // /portal/campaigns show real spend/clicks/conversions instead of 0.
  for (const camp of [googleCampaign, metaCampaign]) {
    const agg = await prisma.adMetricDaily.aggregate({
      where: { campaignId: camp.id },
      _sum: { impressions: true, clicks: true, spendCents: true, conversions: true },
    });
    await prisma.adCampaign.update({
      where: { id: camp.id },
      data: {
        impressions: agg._sum.impressions ?? 0,
        clicks: agg._sum.clicks ?? 0,
        conversions: Math.round(agg._sum.conversions ?? 0),
        spendToDateCents: agg._sum.spendCents ?? 0,
        lastStatsAt: new Date(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. SeoIntegration + SeoSnapshot + SeoQuery + SeoLandingPage — populate
  //    the SEO page with 28 days of data + top queries/pages so the page
  //    looks alive instead of "Connect GSC to begin".
  // ---------------------------------------------------------------------------

  // GA4 + GSC integration shells. credentialsEncrypted is intentionally
  // a placeholder string — never used at runtime since the demo SEO data
  // comes from the seeded snapshots, not a live OAuth call.
  // Composite unique on SeoIntegration is (orgId, propertyId, provider).
  // Status enum is IDLE | SYNCING | ERROR — there's no "READY", so we
  // use IDLE to mean "connected but not actively syncing right now."
  await prisma.seoIntegration
    .upsert({
      where: {
        orgId_propertyId_provider: {
          orgId,
          propertyId,
          provider: SeoProvider.GA4,
        },
      },
      update: {
        status: SeoSyncStatus.IDLE,
        lastSyncAt: new Date(),
        propertyIdentifier: "demo-ga4-properties/452817390",
      },
      create: {
        orgId,
        propertyId,
        provider: SeoProvider.GA4,
        propertyIdentifier: "demo-ga4-properties/452817390",
        serviceAccountEmail:
          "leasestack-demo@telegraphcommons.iam.gserviceaccount.com",
        serviceAccountJsonEncrypted: "demo-only-not-real-credentials",
        status: SeoSyncStatus.IDLE,
        lastSyncAt: new Date(),
      },
    })
    .catch((e) => {
      console.warn(
        "[seed-showcase] GA4 SeoIntegration upsert skipped:",
        String(e).slice(0, 160),
      );
    });

  await prisma.seoIntegration
    .upsert({
      where: {
        orgId_propertyId_provider: {
          orgId,
          propertyId,
          provider: SeoProvider.GSC,
        },
      },
      update: {
        status: SeoSyncStatus.IDLE,
        lastSyncAt: new Date(),
        propertyIdentifier: "sc-domain:telegraphcommons.com",
      },
      create: {
        orgId,
        propertyId,
        provider: SeoProvider.GSC,
        propertyIdentifier: "sc-domain:telegraphcommons.com",
        serviceAccountEmail:
          "leasestack-demo@telegraphcommons.iam.gserviceaccount.com",
        serviceAccountJsonEncrypted: "demo-only-not-real-credentials",
        status: SeoSyncStatus.IDLE,
        lastSyncAt: new Date(),
      },
    })
    .catch((e) => {
      console.warn(
        "[seed-showcase] GSC SeoIntegration upsert skipped:",
        String(e).slice(0, 160),
      );
    });

  // 28 days of SEO snapshots
  const seoRng = seededRandom(99443211);
  for (let dayOffset = 27; dayOffset >= 0; dayOffset--) {
    const date = dateOnly(daysAgo(dayOffset));
    const baseSessions = 95 + seoRng() * 60;
    const baseImpr = 3200 + seoRng() * 1400;
    const clicks = Math.round(baseSessions * (0.7 + seoRng() * 0.4));
    await prisma.seoSnapshot.upsert({
      where: { orgId_date: { orgId, date } },
      update: {
        organicSessions: Math.round(baseSessions),
        organicUsers: Math.round(baseSessions * 0.78),
        totalImpressions: Math.round(baseImpr),
        totalClicks: clicks,
        avgCtr: clicks / Math.max(1, baseImpr),
        avgPosition: 14 - seoRng() * 4,
      },
      create: {
        orgId,
        date,
        organicSessions: Math.round(baseSessions),
        organicUsers: Math.round(baseSessions * 0.78),
        totalImpressions: Math.round(baseImpr),
        totalClicks: clicks,
        avgCtr: clicks / Math.max(1, baseImpr),
        avgPosition: 14 - seoRng() * 4,
      },
    });
  }

  // Top organic queries (last 7 days, what the SEO page surfaces).
  const TOP_QUERIES: Array<{ q: string; impr: number; ctr: number; pos: number }> = [
    { q: "uc berkeley student housing",     impr: 4200, ctr: 0.061, pos: 4.2 },
    { q: "berkeley dorms near campus",       impr: 3100, ctr: 0.055, pos: 5.8 },
    { q: "telegraph commons berkeley",       impr: 2800, ctr: 0.184, pos: 1.4 },
    { q: "private dorm berkeley",            impr: 1950, ctr: 0.048, pos: 7.1 },
    { q: "channing way housing",             impr: 1420, ctr: 0.092, pos: 3.6 },
    { q: "berkeley student apartments fall", impr: 1310, ctr: 0.038, pos: 9.4 },
    { q: "furnished housing berkeley",       impr: 1080, ctr: 0.045, pos: 8.2 },
    { q: "all inclusive student housing berkeley", impr: 870, ctr: 0.062, pos: 6.4 },
  ];
  for (const dayOffset of [0, 7]) {
    const date = dateOnly(daysAgo(dayOffset));
    for (const row of TOP_QUERIES) {
      const clicks = Math.round(row.impr * row.ctr);
      await prisma.seoQuery
        .upsert({
          where: {
            orgId_date_query: { orgId, date, query: row.q },
          },
          update: {
            impressions: row.impr,
            clicks,
            ctr: row.ctr,
            position: row.pos,
          },
          create: {
            orgId,
            date,
            query: row.q,
            impressions: row.impr,
            clicks,
            ctr: row.ctr,
            position: row.pos,
          },
        })
        .catch(() => null);
    }
  }

  // Top landing pages
  const TOP_PAGES = [
    { url: "https://telegraphcommons.com/",                  sessions: 612, bounce: 0.41, dwell: 64 },
    { url: "https://telegraphcommons.com/floor-plans/",      sessions: 318, bounce: 0.32, dwell: 121 },
    { url: "https://telegraphcommons.com/amenities/",        sessions: 205, bounce: 0.29, dwell: 95 },
    { url: "https://telegraphcommons.com/availabilities/",   sessions: 184, bounce: 0.24, dwell: 142 },
    { url: "https://telegraphcommons.com/tour/",             sessions: 96,  bounce: 0.18, dwell: 88  },
    { url: "https://telegraphcommons.com/about/",            sessions: 73,  bounce: 0.46, dwell: 47  },
  ];
  for (const dayOffset of [0, 7]) {
    const date = dateOnly(daysAgo(dayOffset));
    for (const p of TOP_PAGES) {
      await prisma.seoLandingPage
        .upsert({
          where: { orgId_date_url: { orgId, date, url: p.url } },
          update: {
            sessions: p.sessions,
            users: Math.round(p.sessions * 0.85),
            bounceRate: p.bounce,
            avgEngagementTime: p.dwell,
          },
          create: {
            orgId,
            date,
            url: p.url,
            sessions: p.sessions,
            users: Math.round(p.sessions * 0.85),
            bounceRate: p.bounce,
            avgEngagementTime: p.dwell,
          },
        })
        .catch(() => null);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. ReputationScan + PropertyMention — populate the Reputation page
  //    with a recent successful scan + a mix of positive/negative/neutral
  //    mentions across Google, Yelp, and Reddit.
  // ---------------------------------------------------------------------------

  let scan = await prisma.reputationScan.findFirst({
    where: { orgId, propertyId },
    orderBy: { createdAt: "desc" },
  });
  if (!scan || (scan.totalMentionCount ?? 0) === 0) {
    scan = await prisma.reputationScan.create({
      data: {
        orgId,
        propertyId,
        status: "SUCCEEDED" as ReputationScanStatus,
        sources: {
          google: { found: 18, newCount: 4, ok: true },
          yelp:   { found: 6,  newCount: 1, ok: true },
          reddit: { found: 3,  newCount: 0, ok: true },
        },
        newMentionCount: 5,
        totalMentionCount: 27,
        estCostCents: 8,
        durationMs: 4200,
        completedAt: daysAgo(0, 6),
      },
    });
  }

  type MentionSpec = {
    source: MentionSource;
    sourceUrl: string;
    title?: string;
    excerpt: string;
    authorName: string;
    publishedDaysAgo: number;
    rating?: number;
    sentiment: Sentiment;
    topics: string[];
  };

  const MENTIONS: MentionSpec[] = [
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-001", excerpt: "Lived here for two semesters and the location is unbeatable. Walked to every class and the front desk team always has a smile.", authorName: "Jamie L.",  publishedDaysAgo: 5,  rating: 5, sentiment: "POSITIVE", topics: ["location", "staff"] },
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-002", excerpt: "WiFi is fast and the study lounge is genuinely quiet. Great spot for finals week.", authorName: "Maya P.",   publishedDaysAgo: 9,  rating: 5, sentiment: "POSITIVE", topics: ["wifi", "amenities"] },
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-003", excerpt: "Furniture is solid and the rooms are fully ready when you move in. Made the transition easy.", authorName: "Daniel P.", publishedDaysAgo: 14, rating: 4, sentiment: "POSITIVE", topics: ["move-in", "furniture"] },
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-004", excerpt: "The hallways can get noisy on weekends but the staff responds quickly when you flag it.", authorName: "Aisha M.",  publishedDaysAgo: 18, rating: 3, sentiment: "MIXED",    topics: ["noise", "staff"] },
    { source: "YELP",          sourceUrl: "https://www.yelp.com/biz/telegraph-commons-berkeley",                                  excerpt: "Honestly the value for the location is hard to beat. Other Berkeley dorms charge way more for less.", authorName: "Sara L.",   publishedDaysAgo: 6,  rating: 5, sentiment: "POSITIVE", topics: ["pricing", "value"] },
    { source: "YELP",          sourceUrl: "https://www.yelp.com/biz/telegraph-commons-berkeley?hrid=zZ12",                       excerpt: "AC was slow to get fixed in the summer but maintenance eventually came through. 4/5.",                authorName: "Ethan N.",  publishedDaysAgo: 22, rating: 4, sentiment: "MIXED",    topics: ["maintenance", "hvac"] },
    { source: "REDDIT",        sourceUrl: "https://www.reddit.com/r/berkeley/comments/abc123/telegraph_commons_review",          excerpt: "Considering this place for fall — anyone live here recently? How's the kitchen situation?",            authorName: "u/transferstudent2026",  publishedDaysAgo: 3,             sentiment: "NEUTRAL",  topics: ["question"] },
    { source: "REDDIT",        sourceUrl: "https://www.reddit.com/r/berkeley/comments/def456/comment/ghi",                       excerpt: "I lived at TC last year. Common kitchen is small but well kept and you have a microwave/fridge in your room.", authorName: "u/calalum",      publishedDaysAgo: 4,             sentiment: "POSITIVE", topics: ["amenities", "kitchen"] },
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-005", excerpt: "Felt unsafe one weekend when the front door was propped open. Reported it and it was fixed within a day.", authorName: "Tyler B.",  publishedDaysAgo: 21, rating: 3, sentiment: "MIXED",    topics: ["security"] },
    { source: "GOOGLE_REVIEW", sourceUrl: "https://maps.google.com/?cid=tc-006", excerpt: "Front desk doesn't seem to know all the policies. Got conflicting answers about guests.",                  authorName: "Marcus R.", publishedDaysAgo: 27, rating: 2, sentiment: "NEGATIVE", topics: ["staff", "policy"] },
  ];

  let mentionsCreated = 0;
  for (const m of MENTIONS) {
    const urlHash = sha256(m.sourceUrl);
    const exists = await prisma.propertyMention.findFirst({
      where: { orgId, propertyId, urlHash },
    });
    if (exists) continue;

    await prisma.propertyMention.create({
      data: {
        orgId,
        propertyId,
        source: m.source,
        sourceUrl: m.sourceUrl,
        urlHash,
        title: m.title ?? null,
        excerpt: m.excerpt,
        authorName: m.authorName,
        publishedAt: daysAgo(m.publishedDaysAgo),
        rating: m.rating ?? null,
        sentiment: m.sentiment,
        topics: m.topics,
        firstSeenScanId: scan.id,
        lastSeenAt: new Date(),
      },
    });
    mentionsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 8. Insights — 6 detected anomalies / signals across categories so the
  //    Insights page + Briefing have real cards to show.
  // ---------------------------------------------------------------------------

  type InsightSpec = {
    kind: string;
    severity: "info" | "warning" | "critical";
    category: string;
    title: string;
    body: string;
    suggestedAction: string;
    href: string;
    /** Must satisfy Prisma's JSON input type — plain JSON-serialisable values. */
    context: Prisma.InputJsonObject;
    daysAgo: number;
  };

  const INSIGHTS: InsightSpec[] = [
    {
      kind: "traffic_spike",
      severity: "info",
      category: "traffic",
      title: "Organic traffic up 38% week over week",
      body: "Unique visitors from organic search rose from 412 to 569 over the last 7 days. The 'uc berkeley student housing' query is driving most of the lift — it climbed 1.6 positions in GSC.",
      suggestedAction: "Review which landing pages converted the new traffic and consider boosting that page in your sitemap.",
      href: "/portal/seo",
      context: { before: 412, after: 569, deltaPct: 38 },
      daysAgo: 1,
    },
    {
      kind: "cpl_spike",
      severity: "warning",
      category: "ads",
      title: "Cost per lead on Google Search up 27%",
      body: "Google Search CPL rose from $58 to $74 over the last 14 days. Click volume is steady but conversion rate slipped from 5.1% to 3.9%. Likely creative fatigue.",
      suggestedAction: "Refresh the top two ad copy variations or rotate in the campus-shuttle creative we shipped last month.",
      href: "/portal/campaigns",
      context: { beforeCents: 5800, afterCents: 7400, deltaPct: 27 },
      daysAgo: 2,
    },
    {
      kind: "chatbot_pattern",
      severity: "info",
      category: "chatbot",
      title: "5 chats this week asked about parking",
      body: "Multiple prospects asked variations of 'is there parking?' — your knowledge base does not currently mention parking. The bot defaulted to 'contact the leasing office' on each.",
      suggestedAction: "Add a parking section to your chatbot knowledge base. Telegraph Commons does not offer parking — saying so directly will prevent dropoff.",
      href: "/portal/chatbot",
      context: { sampleSize: 5 },
      daysAgo: 3,
    },
    {
      kind: "hot_visitor",
      severity: "warning",
      category: "leads",
      title: "Identified visitor returned for the 4th time",
      body: "Maya Patel (maya.p@berkeley.edu) viewed Floor Plans and Tour pages 4 times this week without booking. Currently your highest-intent unconverted visitor.",
      suggestedAction: "Send a personalized outreach via the lead detail drawer — current intent score is 87.",
      href: "/portal/visitors",
      context: { sessionCount: 4, intentScore: 87 },
      daysAgo: 0,
    },
    {
      kind: "pipeline_stall",
      severity: "warning",
      category: "leads",
      title: "3 leads have been Contacted but not Touring for >7 days",
      body: "Marcus, Lena, and Wesley all moved to Contacted >7 days ago and haven't progressed. Industry benchmark for student housing is 3 days max.",
      suggestedAction: "Reach back out with a tour scheduling link or call directly.",
      href: "/portal/leads?status=CONTACTED",
      context: { sampleSize: 3 },
      daysAgo: 4,
    },
    {
      kind: "keyword_drop",
      severity: "info",
      category: "seo",
      title: "Position dropped from 3.2 → 5.8 for 'berkeley student housing'",
      body: "GSC shows you slipped 2.6 positions on this query over the last 14 days. Three competitors gained: UC Apartments, Channing Way Living, and Cal Berkeley Housing.",
      suggestedAction: "Refresh the H1 and meta description on /berkeley-student-housing/ landing page.",
      href: "/portal/seo?tab=queries",
      context: { before: 3.2, after: 5.8, query: "berkeley student housing" },
      daysAgo: 5,
    },
  ];

  let insightsCreated = 0;
  for (const ins of INSIGHTS) {
    const dedupeKey = `${ins.kind}:${propertyId}:demo:${ins.daysAgo}`;
    await prisma.insight
      .upsert({
        where: { orgId_dedupeKey: { orgId, dedupeKey } },
        update: {
          severity: ins.severity,
          title: ins.title,
          body: ins.body,
          suggestedAction: ins.suggestedAction,
          href: ins.href,
          context: ins.context,
        },
        create: {
          orgId,
          propertyId,
          kind: ins.kind,
          severity: ins.severity,
          category: ins.category,
          title: ins.title,
          body: ins.body,
          suggestedAction: ins.suggestedAction,
          href: ins.href,
          context: ins.context,
          status: "open",
          dedupeKey,
          createdAt: daysAgo(ins.daysAgo),
        },
      })
      .catch(() => null);
    insightsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 9. ClientReports — 4 weekly snapshots so the Reports table has rows
  //    to show + each can be opened at /r/[token].
  // ---------------------------------------------------------------------------

  let reportsCreated = 0;
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    const periodEnd = daysAgo(weekOffset * 7);
    const periodStart = daysAgo(weekOffset * 7 + 7);
    const headline =
      weekOffset === 0
        ? "Strong week — traffic +38%, leads +12%"
        : weekOffset === 1
          ? "CPL ticking up — recommend creative refresh"
          : weekOffset === 2
            ? "Stable week, all KPIs within band"
            : "Soft week — single chatbot incident now resolved";

    const exists = await prisma.clientReport.findFirst({
      where: {
        orgId,
        kind: "weekly",
        periodEnd: {
          gte: dateOnly(daysAgo(weekOffset * 7 + 1)),
          lt: dateOnly(daysAgo(weekOffset * 7 - 1)),
        },
      },
    });
    if (exists) continue;

    await prisma.clientReport.create({
      data: {
        orgId,
        propertyId,
        kind: "weekly",
        periodStart,
        periodEnd,
        headline,
        notes:
          "Auto-generated weekly snapshot. The portal compares this week to the prior week across leads, ad spend, organic sessions, chatbot conversations, and reputation mentions.",
        snapshot: {
          kpis: {
            leads: { value: 28 + weekOffset, prior: 25 + weekOffset, deltaPct: 12 },
            adSpendCents: { value: 240000 - weekOffset * 8000, prior: 220000, deltaPct: 9 },
            organicSessions: { value: 612 + weekOffset * 18, prior: 444, deltaPct: 38 },
            occupancyPct: { value: 94, prior: 93, deltaPct: 1 },
          },
          leadSources: [
            { source: "Google Ads",  count: 12 },
            { source: "Organic",     count: 8 },
            { source: "Chatbot",     count: 5 },
            { source: "Direct",      count: 3 },
          ],
          topInsights: INSIGHTS.slice(0, 3).map((i) => ({
            title: i.title,
            severity: i.severity,
          })),
        },
        shareToken: sortedToken(),
        status: weekOffset === 0 ? "draft" : "shared",
        sharedAt: weekOffset === 0 ? null : daysAgo(weekOffset * 7 - 1),
        viewCount: weekOffset === 0 ? 0 : 4 + weekOffset,
      },
    });
    reportsCreated++;
  }

  // ---------------------------------------------------------------------------
  // 10. Notifications — populate the bell + notifications page so it
  //     has scrollable history, not a flat zero-state.
  // ---------------------------------------------------------------------------

  const NOTIFS = [
    { kind: "lead_created",      title: "New lead from Google Ads",                 body: "Maya Patel submitted the contact form on the floor-plans page.",                 href: "/portal/leads",     hoursAgo: 1.5 },
    { kind: "tour_scheduled",    title: "Tour scheduled for Saturday 11:00 AM",     body: "Jordan Kim booked a tour of the 2-bedroom floor plan.",                          href: "/portal/tours",     hoursAgo: 4 },
    { kind: "chatbot_lead",      title: "Chatbot captured a high-intent lead",      body: "Conversation with priya.shah@berkeley.edu — interested in fall move-in.",         href: "/portal/conversations", hoursAgo: 7 },
    { kind: "sync_complete",     title: "AppFolio sync completed",                  body: "12 residents · 8 work orders · 6 expiring leases pulled successfully.",          href: "/portal/connect",   hoursAgo: 12 },
    { kind: "integration_error", title: "Meta Ads token refresh failed",            body: "Meta access token expired — re-authentication required to resume sync.",        href: "/portal/connect",   hoursAgo: 18 },
    { kind: "lead_created",      title: "New lead from Organic Search",             body: "Aisha Mohamed found you via 'private dorm berkeley' on Google.",                href: "/portal/leads",     hoursAgo: 26 },
    { kind: "report_generated",  title: "Weekly report ready",                      body: "Your weekly LeaseStack report is published and ready to share.",                 href: "/portal/reports",   hoursAgo: 30 },
    { kind: "chatbot_lead",      title: "Chatbot flagged a missed handoff",         body: "Marcus asked about parking 3 times — knowledge base does not cover this topic.", href: "/portal/conversations", hoursAgo: 36 },
  ];

  let notifsCreated = 0;
  for (const n of NOTIFS) {
    // Notifications don't have a natural unique constraint we can upsert
    // on, so we de-dupe on (orgId + title) as a best effort.
    const exists = await prisma.notification.findFirst({
      where: { orgId, title: n.title },
    });
    if (exists) continue;

    await prisma.notification.create({
      data: {
        orgId,
        kind: n.kind,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.hoursAgo > 24 ? daysAgo(0, 12) : null,
        createdAt: daysAgo(0, n.hoursAgo),
      },
    });
    notifsCreated++;
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  const [
    residentCount,
    leaseCount,
    workOrderCount,
    sessionCount,
    eventCount,
    adCampaignCount,
    metricCount,
    snapshotCount,
    queryCount,
    landingPageCount,
    scanCount,
    mentionCount,
    insightCount,
    reportCount,
    notifCount,
  ] = await Promise.all([
    prisma.resident.count({ where: { orgId } }),
    prisma.lease.count({ where: { orgId } }),
    prisma.workOrder.count({ where: { orgId } }),
    prisma.visitorSession.count({ where: { orgId } }),
    prisma.visitorEvent.count({ where: { orgId } }),
    prisma.adCampaign.count({ where: { orgId } }),
    prisma.adMetricDaily.count({ where: { orgId } }),
    prisma.seoSnapshot.count({ where: { orgId } }),
    prisma.seoQuery.count({ where: { orgId } }),
    prisma.seoLandingPage.count({ where: { orgId } }),
    prisma.reputationScan.count({ where: { orgId } }),
    prisma.propertyMention.count({ where: { orgId } }),
    prisma.insight.count({ where: { orgId } }),
    prisma.clientReport.count({ where: { orgId } }),
    prisma.notification.count({ where: { orgId } }),
  ]);

  console.log(`
Telegraph Commons SHOWCASE seed complete.

Org:       ${org.name} (${ORG_SLUG})
Property:  ${property.name} (${propertyId})

Created in this run:
  Residents:           ${residentsCreated}
  Work orders:         ${workOrdersCreated}
  Visitor sessions:    ${sessionsCreated}
  Ad metrics:          ${metricsCreated}
  Reputation mentions: ${mentionsCreated}
  Insights:            ${insightsCreated}
  Reports:             ${reportsCreated}
  Notifications:       ${notifsCreated}

Totals on this tenant:
  Residents:           ${residentCount}
  Leases:              ${leaseCount}
  Work orders:         ${workOrderCount}
  Visitor sessions:    ${sessionCount}
  Visitor events:      ${eventCount}
  Ad campaigns:        ${adCampaignCount}
  Ad metric rows:      ${metricCount}
  SEO snapshots:       ${snapshotCount}
  SEO queries:         ${queryCount}
  SEO landing pages:   ${landingPageCount}
  Reputation scans:    ${scanCount}
  Property mentions:   ${mentionCount}
  Insights:            ${insightCount}
  Client reports:      ${reportCount}
  Notifications:       ${notifCount}
`);
}

main()
  .catch((e) => {
    console.error("Telegraph Commons showcase seed failed:", e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
