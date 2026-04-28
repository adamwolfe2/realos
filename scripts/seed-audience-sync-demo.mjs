// One-off: ensure a demo AUDIENCE_SYNC org exists and is seeded with
// realistic-looking AL segment data, destinations, and recent sync runs so
// the dashboard shows real shapes (not empty states).
//
// Run: pnpm tsx scripts/seed-audience-sync-demo.mjs
// Idempotent — safe to re-run.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof WebSocket === "undefined") {
  neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

const SLUG = "audience-sync-demo";

const org = await prisma.organization.upsert({
  where: { slug: SLUG },
  create: {
    name: "Audience Sync Demo",
    slug: SLUG,
    orgType: "CLIENT",
    productLine: "AUDIENCE_SYNC",
    status: "ACTIVE",
    propertyType: "RESIDENTIAL",
  },
  update: {
    productLine: "AUDIENCE_SYNC",
    orgType: "CLIENT",
    status: "ACTIVE",
  },
});

const SEGMENTS = [
  {
    alSegmentId: "seg_active_buyers_bay_area",
    name: "Active Home Buyers — Bay Area",
    description:
      "High-intent buyers searching SF, Oakland, San Jose metro in last 30 days. Verified email + mobile match.",
    memberCount: 1_847_320,
    rawPayload: {
      email_match_rate: 0.71,
      phone_match_rate: 0.42,
      top_states: [
        { state: "CA", count: 1_847_320 },
      ],
      top_zips: [
        { zip: "94110", city: "San Francisco", count: 142_000 },
        { zip: "94612", city: "Oakland", count: 118_500 },
        { zip: "95126", city: "San Jose", count: 96_400 },
        { zip: "94704", city: "Berkeley", count: 81_200 },
        { zip: "94025", city: "Menlo Park", count: 58_300 },
      ],
    },
  },
  {
    alSegmentId: "seg_refinance_intent_ca",
    name: "Refinance Intent — California",
    description:
      "Homeowners researching refinance terms, current rate >5.5%. Income $150K+.",
    memberCount: 612_440,
    rawPayload: {
      email_match_rate: 0.82,
      phone_match_rate: 0.55,
      top_states: [{ state: "CA", count: 612_440 }],
      top_zips: [
        { zip: "90272", city: "Pacific Palisades", count: 38_900 },
        { zip: "94022", city: "Los Altos", count: 29_400 },
        { zip: "92660", city: "Newport Beach", count: 26_800 },
        { zip: "94027", city: "Atherton", count: 12_300 },
        { zip: "94010", city: "Hillsborough", count: 11_900 },
      ],
    },
  },
  {
    alSegmentId: "seg_investment_property_ny",
    name: "Investment Property Searchers — NY Tri-State",
    description:
      "Cash buyers + rental investors browsing multi-family listings across NY/NJ/CT.",
    memberCount: 284_910,
    rawPayload: {
      email_match_rate: 0.68,
      phone_match_rate: 0.38,
      top_states: [
        { state: "NY", count: 184_700 },
        { state: "NJ", count: 68_200 },
        { state: "CT", count: 32_010 },
      ],
      top_zips: [
        { zip: "10013", city: "New York", count: 28_400 },
        { zip: "11201", city: "Brooklyn", count: 24_900 },
        { zip: "07030", city: "Hoboken", count: 18_700 },
        { zip: "11215", city: "Brooklyn", count: 15_600 },
        { zip: "06830", city: "Greenwich", count: 11_200 },
      ],
    },
  },
  {
    alSegmentId: "seg_first_time_buyers_tx",
    name: "First-Time Buyers — Texas",
    description:
      "Renters age 26-38 searching Austin / Dallas / Houston. Active mortgage pre-qual interest.",
    memberCount: 942_800,
    rawPayload: {
      email_match_rate: 0.74,
      phone_match_rate: 0.48,
      top_states: [{ state: "TX", count: 942_800 }],
      top_zips: [
        { zip: "78704", city: "Austin", count: 88_400 },
        { zip: "75201", city: "Dallas", count: 76_200 },
        { zip: "77007", city: "Houston", count: 64_900 },
        { zip: "78745", city: "Austin", count: 51_600 },
        { zip: "75204", city: "Dallas", count: 47_300 },
      ],
    },
  },
  {
    alSegmentId: "seg_relocators_remote_workers",
    name: "Remote Worker Relocators — Sun Belt",
    description:
      "Tech / finance professionals leaving HCOL metros for FL, AZ, NC, TN. Verified employer.",
    memberCount: 421_650,
    rawPayload: {
      email_match_rate: 0.79,
      phone_match_rate: 0.41,
      top_states: [
        { state: "FL", count: 168_400 },
        { state: "AZ", count: 102_900 },
        { state: "NC", count: 84_300 },
        { state: "TN", count: 66_050 },
      ],
      top_zips: [
        { zip: "33139", city: "Miami Beach", count: 32_100 },
        { zip: "85254", city: "Scottsdale", count: 28_700 },
        { zip: "28203", city: "Charlotte", count: 22_400 },
        { zip: "37215", city: "Nashville", count: 19_800 },
        { zip: "33304", city: "Fort Lauderdale", count: 17_600 },
      ],
    },
  },
  {
    alSegmentId: "seg_luxury_buyers_3m_plus",
    name: "Luxury Buyers — $3M+",
    description:
      "Verified HNW shoppers viewing $3M+ listings in last 60 days. Estimated net worth $5M+.",
    memberCount: 84_200,
    rawPayload: {
      email_match_rate: 0.63,
      phone_match_rate: 0.71,
      top_states: [
        { state: "CA", count: 31_400 },
        { state: "NY", count: 18_900 },
        { state: "FL", count: 12_700 },
        { state: "MA", count: 8_400 },
        { state: "TX", count: 6_800 },
      ],
      top_zips: [
        { zip: "10075", city: "New York", count: 6_200 },
        { zip: "90210", city: "Beverly Hills", count: 5_800 },
        { zip: "33480", city: "Palm Beach", count: 4_400 },
        { zip: "94027", city: "Atherton", count: 3_900 },
        { zip: "02199", city: "Boston", count: 2_700 },
      ],
    },
  },
  {
    alSegmentId: "seg_commercial_office_lease",
    name: "Commercial Office Lease Intent",
    description:
      "Business decision-makers researching office leases 5-50 person teams. Last 45 days.",
    memberCount: 156_400,
    rawPayload: {
      email_match_rate: 0.84,
      phone_match_rate: 0.62,
      top_states: [
        { state: "CA", count: 42_300 },
        { state: "TX", count: 28_400 },
        { state: "NY", count: 26_700 },
        { state: "IL", count: 14_900 },
        { state: "MA", count: 11_800 },
      ],
      top_zips: [
        { zip: "94105", city: "San Francisco", count: 8_400 },
        { zip: "78701", city: "Austin", count: 6_900 },
        { zip: "10018", city: "New York", count: 5_700 },
        { zip: "60606", city: "Chicago", count: 4_200 },
        { zip: "02110", city: "Boston", count: 3_100 },
      ],
    },
  },
  {
    alSegmentId: "seg_senior_living_decision",
    name: "Senior Living Decision Makers",
    description:
      "Adult children researching independent / assisted living for parents. Income $100K+.",
    memberCount: 198_300,
    rawPayload: {
      email_match_rate: 0.88,
      phone_match_rate: 0.69,
      top_states: [
        { state: "FL", count: 48_400 },
        { state: "CA", count: 38_900 },
        { state: "TX", count: 27_300 },
        { state: "AZ", count: 21_100 },
        { state: "NY", count: 18_700 },
      ],
      top_zips: [
        { zip: "33458", city: "Jupiter", count: 6_100 },
        { zip: "85258", city: "Scottsdale", count: 4_900 },
        { zip: "92660", city: "Newport Beach", count: 4_200 },
        { zip: "78731", city: "Austin", count: 3_700 },
        { zip: "11743", city: "Huntington", count: 3_100 },
      ],
    },
  },
];

console.log(`Seeding ${SEGMENTS.length} segments…`);
const segmentIds = [];
for (const seg of SEGMENTS) {
  const upserted = await prisma.audienceSegment.upsert({
    where: {
      orgId_alSegmentId: { orgId: org.id, alSegmentId: seg.alSegmentId },
    },
    create: {
      orgId: org.id,
      alSegmentId: seg.alSegmentId,
      name: seg.name,
      description: seg.description,
      memberCount: seg.memberCount,
      rawPayload: seg.rawPayload,
      lastFetchedAt: new Date(Date.now() - randomMinutes(30, 720)),
    },
    update: {
      name: seg.name,
      description: seg.description,
      memberCount: seg.memberCount,
      rawPayload: seg.rawPayload,
      lastFetchedAt: new Date(Date.now() - randomMinutes(30, 720)),
    },
  });
  segmentIds.push({ id: upserted.id, name: upserted.name });
}

// Destinations — only seed if there are no destinations yet, so re-runs
// don't pile up duplicates.
const existingDestCount = await prisma.audienceDestination.count({
  where: { orgId: org.id },
});

let destinationRows = [];
if (existingDestCount === 0) {
  console.log("Seeding 3 destinations…");
  const csvDest = await prisma.audienceDestination.create({
    data: {
      orgId: org.id,
      type: "CSV_DOWNLOAD",
      name: "CSV download",
      enabled: true,
      lastUsedAt: new Date(Date.now() - randomMinutes(60, 240)),
    },
  });
  const webhookDest = await prisma.audienceDestination.create({
    data: {
      orgId: org.id,
      type: "WEBHOOK",
      name: "Demo webhook (webhook.site)",
      webhookUrl: "https://webhook.site/example-demo",
      enabled: true,
      lastUsedAt: new Date(Date.now() - randomMinutes(60, 360)),
    },
  });
  const metaDest = await prisma.audienceDestination.create({
    data: {
      orgId: org.id,
      type: "META_CUSTOM_AUDIENCE",
      name: "Meta — Bay Area Retargeting (preview)",
      enabled: false,
    },
  });
  destinationRows = [csvDest, webhookDest, metaDest];
} else {
  destinationRows = await prisma.audienceDestination.findMany({
    where: { orgId: org.id },
  });
}

// Sync runs — ensure ~15 recent runs exist for the activity feed. Skip if
// we already have a healthy history (idempotent re-run).
const existingRunCount = await prisma.audienceSyncRun.count({
  where: { orgId: org.id },
});

if (existingRunCount < 15) {
  console.log("Seeding sync runs…");
  const usableDestinations = destinationRows.filter(
    (d) => d.type === "CSV_DOWNLOAD" || d.type === "WEBHOOK",
  );
  const seedRuns = [
    { sIdx: 0, dIdx: 0, status: "SUCCESS", members: 1_847_320, startMin: 18 },
    { sIdx: 1, dIdx: 1, status: "SUCCESS", members: 612_440, startMin: 47 },
    { sIdx: 3, dIdx: 0, status: "SUCCESS", members: 942_800, startMin: 95 },
    { sIdx: 0, dIdx: 1, status: "SUCCESS", members: 142_000, startMin: 180, filter: { zipCodes: ["94110"] } },
    { sIdx: 4, dIdx: 0, status: "SUCCESS", members: 168_400, startMin: 240, filter: { states: ["FL"] } },
    { sIdx: 5, dIdx: 1, status: "SUCCESS", members: 84_200, startMin: 320 },
    { sIdx: 2, dIdx: 0, status: "SUCCESS", members: 184_700, startMin: 460, filter: { states: ["NY"] } },
    {
      sIdx: 6,
      dIdx: 1,
      status: "FAILED",
      members: 0,
      startMin: 540,
      error: "Webhook responded 502: Bad gateway. Retry queued.",
    },
    { sIdx: 6, dIdx: 1, status: "SUCCESS", members: 156_400, startMin: 720 },
    { sIdx: 7, dIdx: 0, status: "SUCCESS", members: 198_300, startMin: 1_200 },
    { sIdx: 0, dIdx: 0, status: "SUCCESS", members: 1_812_440, startMin: 1_800 },
    { sIdx: 1, dIdx: 1, status: "SUCCESS", members: 598_300, startMin: 2_400 },
    { sIdx: 3, dIdx: 0, status: "SUCCESS", members: 51_600, startMin: 3_100, filter: { zipCodes: ["78704"] } },
    { sIdx: 4, dIdx: 1, status: "SUCCESS", members: 102_900, startMin: 3_800, filter: { states: ["AZ"] } },
    { sIdx: 5, dIdx: 0, status: "SUCCESS", members: 84_200, startMin: 4_500 },
  ];
  for (const r of seedRuns) {
    if (!segmentIds[r.sIdx] || !usableDestinations[r.dIdx]) continue;
    const startedAt = new Date(Date.now() - r.startMin * 60_000);
    const finishedAt = new Date(startedAt.getTime() + randomMs(800, 4_500));
    await prisma.audienceSyncRun.create({
      data: {
        orgId: org.id,
        segmentId: segmentIds[r.sIdx].id,
        destinationId: usableDestinations[r.dIdx].id,
        status: r.status,
        memberCount: r.members,
        filterSnapshot: r.filter ?? undefined,
        startedAt,
        finishedAt,
        errorMessage: r.error ?? null,
      },
    });
  }
}

console.log("ok", {
  org: org.id,
  slug: org.slug,
  segments: SEGMENTS.length,
  destinations: destinationRows.length,
});
await prisma.$disconnect();

function randomMinutes(min, max) {
  return Math.floor(min + Math.random() * (max - min)) * 60 * 1000;
}

function randomMs(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}
