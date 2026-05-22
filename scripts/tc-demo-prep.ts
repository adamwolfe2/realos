/**
 * tc-demo-prep — idempotent script that fills the demo gaps for SG Real
 * Estate / Telegraph Commons ahead of the operator demo.
 *
 * What it does:
 *   1. Flips 5 of the 8 pre-generated ContentDraft rows from GENERATING
 *      → PENDING_REVIEW so the admin queue (/admin/content-drafts) opens
 *      with real content waiting, and the operator's content surface
 *      still has 3 "ready to submit" drafts.
 *   2. Creates a MonthlyContentQuota row for the current UTC month with
 *      realistic per-format usage (matches the drafts we just flipped).
 *   3. Backfills 14 realistic-looking leads for Telegraph Commons spread
 *      across the last 28 days so the dashboard "Leads (28d)" tile isn't
 *      anemic. Sources distribute across CHATBOT, ORGANIC, REFERRAL,
 *      PIXEL_OUTREACH, DIRECT — matching what the actual integrations
 *      would surface.
 *   4. Seeds 6 Tour rows linked to a subset of those leads so the
 *      conversion funnel actually fills out (NEW → CONTACTED →
 *      TOUR_SCHEDULED → TOURED).
 *
 * Idempotent: each step checks current state and only inserts what's
 * missing. Safe to re-run.
 *
 * All seeded rows carry a `notes` or `externalSystem` marker
 * ("tc-demo-prep") so they can be filtered out or cleaned up if needed.
 *
 * Run:
 *   DATABASE_URL=<unpooled-prod-url> pnpm exec tsx scripts/tc-demo-prep.ts
 */

import { prisma } from "../lib/db";
import {
  DraftStatus,
  LeadSource,
  LeadStatus,
  TourStatus,
} from "@prisma/client";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons
const MARKER = "tc-demo-prep";

// ---------------------------------------------------------------------------
// Step 1: promote drafts to PENDING_REVIEW
// ---------------------------------------------------------------------------
async function promoteDrafts() {
  console.log("\n[1/4] Promoting drafts to PENDING_REVIEW…");

  // Pick the 5 drafts most relevant to the demo narrative (the AEO-counter
  // post, the international-student angle, the head-term ranking play, the
  // walking-distance map, and the Southside neighborhood page).
  const candidates = await prisma.contentDraft.findMany({
    where: {
      orgId: ORG_ID,
      status: DraftStatus.GENERATING,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, targetQuery: true, format: true },
  });

  if (candidates.length === 0) {
    console.log("  No GENERATING drafts found — already promoted or never seeded. Skipping.");
    return;
  }

  console.log(`  Found ${candidates.length} GENERATING drafts:`);
  for (const d of candidates) {
    console.log(`    · ${d.format} — ${d.targetQuery}`);
  }

  // Promote the first 5. Use stable sort (createdAt asc) so this is
  // deterministic across runs.
  const toPromote = candidates.slice(0, 5);
  const ids = toPromote.map((d) => d.id);

  const result = await prisma.contentDraft.updateMany({
    where: { id: { in: ids } },
    data: {
      status: DraftStatus.PENDING_REVIEW,
      submittedAt: new Date(),
    },
  });
  console.log(
    `  ✓ Promoted ${result.count} drafts to PENDING_REVIEW. Admin queue will populate.`,
  );
  console.log(
    `  ↳ Remaining ${candidates.length - result.count} drafts stay GENERATING — visible on operator's /portal/content as "ready to submit".`,
  );
}

// ---------------------------------------------------------------------------
// Step 2: configure MonthlyContentQuota
// ---------------------------------------------------------------------------
async function configureQuota() {
  console.log("\n[2/4] Configuring MonthlyContentQuota…");

  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  // Match real usage: 5 blogs + 3 neighborhood pages prefilled.
  const blogPostsUsed = await prisma.contentDraft.count({
    where: { orgId: ORG_ID, format: "BLOG_POST" },
  });
  const neighborhoodPagesUsed = await prisma.contentDraft.count({
    where: { orgId: ORG_ID, format: "NEIGHBORHOOD_PAGE" },
  });

  const existing = await prisma.monthlyContentQuota.findUnique({
    where: {
      orgId_periodStart: { orgId: ORG_ID, periodStart },
    },
  });

  if (existing) {
    await prisma.monthlyContentQuota.update({
      where: { id: existing.id },
      data: {
        blogPostsUsed,
        neighborhoodPagesUsed,
      },
    });
    console.log(
      `  ✓ Refreshed existing quota row: blogs=${blogPostsUsed}, neighborhoods=${neighborhoodPagesUsed}`,
    );
  } else {
    await prisma.monthlyContentQuota.create({
      data: {
        orgId: ORG_ID,
        periodStart,
        blogPostsUsed,
        neighborhoodPagesUsed,
      },
    });
    console.log(
      `  ✓ Created quota row for ${periodStart.toISOString().slice(0, 7)}: blogs=${blogPostsUsed}, neighborhoods=${neighborhoodPagesUsed}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Step 3: seed leads across last 28 days
// ---------------------------------------------------------------------------
const SAMPLE_LEADS: Array<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: LeadSource;
  sourceDetail: string;
  status: LeadStatus;
  score: number;
  intent: "hot" | "warm" | "cold";
  budgetMin: number;
  budgetMax: number;
  preferredUnitType: string;
  daysAgo: number;
}> = [
  {
    firstName: "Maya",
    lastName: "Chen",
    email: "maya.chen@berkeley.edu",
    phone: "(510) 555-0142",
    source: LeadSource.CHATBOT,
    sourceDetail: "Telegraph Commons chatbot",
    status: LeadStatus.TOUR_SCHEDULED,
    score: 87,
    intent: "hot",
    budgetMin: 2200,
    budgetMax: 2800,
    preferredUnitType: "1BR",
    daysAgo: 2,
  },
  {
    firstName: "Jordan",
    lastName: "Patel",
    email: "jpatel.ucb@gmail.com",
    phone: "(510) 555-0198",
    source: LeadSource.ORGANIC,
    sourceDetail: "google: telegraph commons berkeley",
    status: LeadStatus.CONTACTED,
    score: 72,
    intent: "warm",
    budgetMin: 1800,
    budgetMax: 2400,
    preferredUnitType: "Studio",
    daysAgo: 4,
  },
  {
    firstName: "Aiko",
    lastName: "Tanaka",
    email: "aiko.tanaka@waseda.jp",
    phone: "+81 80-1234-5678",
    source: LeadSource.ORGANIC,
    sourceDetail: "google: international student apartment berkeley",
    status: LeadStatus.NEW,
    score: 91,
    intent: "hot",
    budgetMin: 2500,
    budgetMax: 3500,
    preferredUnitType: "1BR",
    daysAgo: 1,
  },
  {
    firstName: "Marcus",
    lastName: "Johnson",
    email: "mjohnson.cal@gmail.com",
    phone: "(510) 555-0167",
    source: LeadSource.CHATBOT,
    sourceDetail: "Telegraph Commons chatbot",
    status: LeadStatus.TOURED,
    score: 78,
    intent: "warm",
    budgetMin: 2000,
    budgetMax: 2600,
    preferredUnitType: "Studio",
    daysAgo: 9,
  },
  {
    firstName: "Sofia",
    lastName: "Reyes",
    email: "sofia.reyes@berkeley.edu",
    phone: "(510) 555-0211",
    source: LeadSource.PIXEL_OUTREACH,
    sourceDetail: "Identified visitor — high intent",
    status: LeadStatus.APPLIED,
    score: 94,
    intent: "hot",
    budgetMin: 2400,
    budgetMax: 3000,
    preferredUnitType: "1BR",
    daysAgo: 14,
  },
  {
    firstName: "Ethan",
    lastName: "Lee",
    email: "ethan.lee@berkeley.edu",
    phone: "(510) 555-0188",
    source: LeadSource.REFERRAL,
    sourceDetail: "Referred by existing resident",
    status: LeadStatus.CONTACTED,
    score: 81,
    intent: "warm",
    budgetMin: 2100,
    budgetMax: 2700,
    preferredUnitType: "Studio",
    daysAgo: 5,
  },
  {
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.s@stanford.edu",
    phone: "(650) 555-0109",
    source: LeadSource.ORGANIC,
    sourceDetail: "google: berkeley apartment lease guide",
    status: LeadStatus.NEW,
    score: 68,
    intent: "warm",
    budgetMin: 2200,
    budgetMax: 2800,
    preferredUnitType: "1BR",
    daysAgo: 3,
  },
  {
    firstName: "David",
    lastName: "Kim",
    email: "dkim.ucb@gmail.com",
    phone: "(510) 555-0152",
    source: LeadSource.CHATBOT,
    sourceDetail: "Telegraph Commons chatbot",
    status: LeadStatus.TOUR_SCHEDULED,
    score: 84,
    intent: "hot",
    budgetMin: 2300,
    budgetMax: 2900,
    preferredUnitType: "1BR",
    daysAgo: 7,
  },
  {
    firstName: "Olivia",
    lastName: "Garcia",
    email: "ogarcia.berkeley@gmail.com",
    phone: "(510) 555-0173",
    source: LeadSource.DIRECT,
    sourceDetail: "Direct visit — telegraphcommons.com",
    status: LeadStatus.CONTACTED,
    score: 76,
    intent: "warm",
    budgetMin: 1900,
    budgetMax: 2500,
    preferredUnitType: "Studio",
    daysAgo: 11,
  },
  {
    firstName: "Liam",
    lastName: "O'Brien",
    email: "liam.obrien@trinity.edu.ie",
    phone: "+353 87 555 0144",
    source: LeadSource.ORGANIC,
    sourceDetail: "google: walking distance UC Berkeley apartments",
    status: LeadStatus.NEW,
    score: 73,
    intent: "warm",
    budgetMin: 2400,
    budgetMax: 3200,
    preferredUnitType: "1BR",
    daysAgo: 16,
  },
  {
    firstName: "Zara",
    lastName: "Ahmed",
    email: "zara.ahmed@berkeley.edu",
    phone: "(510) 555-0220",
    source: LeadSource.CHATBOT,
    sourceDetail: "Telegraph Commons chatbot",
    status: LeadStatus.APPLICATION_SENT,
    score: 89,
    intent: "hot",
    budgetMin: 2500,
    budgetMax: 3000,
    preferredUnitType: "1BR",
    daysAgo: 19,
  },
  {
    firstName: "Noah",
    lastName: "Williams",
    email: "noah.williams.ucb@gmail.com",
    phone: "(510) 555-0135",
    source: LeadSource.PIXEL_OUTREACH,
    sourceDetail: "Identified visitor — returning",
    status: LeadStatus.LOST,
    score: 58,
    intent: "cold",
    budgetMin: 1700,
    budgetMax: 2100,
    preferredUnitType: "Studio",
    daysAgo: 22,
  },
  {
    firstName: "Hannah",
    lastName: "Martinez",
    email: "hmartinez@berkeley.edu",
    phone: "(510) 555-0199",
    source: LeadSource.CHATBOT,
    sourceDetail: "Telegraph Commons chatbot",
    status: LeadStatus.TOURED,
    score: 82,
    intent: "warm",
    budgetMin: 2200,
    budgetMax: 2700,
    preferredUnitType: "1BR",
    daysAgo: 25,
  },
  {
    firstName: "Wei",
    lastName: "Zhang",
    email: "wei.zhang@pku.edu.cn",
    phone: "+86 138 1234 5678",
    source: LeadSource.ORGANIC,
    sourceDetail: "google: international student housing UC Berkeley",
    status: LeadStatus.SIGNED,
    score: 96,
    intent: "hot",
    budgetMin: 2800,
    budgetMax: 3500,
    preferredUnitType: "1BR",
    daysAgo: 27,
  },
];

async function seedLeads() {
  console.log("\n[3/4] Seeding leads across last 28 days…");

  const existing = await prisma.lead.findMany({
    where: { orgId: ORG_ID, externalSystem: MARKER },
    select: { id: true, email: true },
  });
  const existingEmails = new Set(existing.map((l) => l.email?.toLowerCase()));

  let inserted = 0;
  for (const l of SAMPLE_LEADS) {
    if (existingEmails.has(l.email.toLowerCase())) continue;
    const createdAt = new Date(Date.now() - l.daysAgo * 24 * 60 * 60 * 1000);
    const moveIn = new Date();
    moveIn.setMonth(moveIn.getMonth() + 2); // 2 months from now
    await prisma.lead.create({
      data: {
        orgId: ORG_ID,
        propertyId: PROPERTY_ID,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        source: l.source,
        sourceDetail: l.sourceDetail,
        status: l.status,
        score: l.score,
        intent: l.intent,
        desiredMoveIn: moveIn,
        budgetMinCents: l.budgetMin * 100,
        budgetMaxCents: l.budgetMax * 100,
        preferredUnitType: l.preferredUnitType,
        externalSystem: MARKER,
        externalId: `${MARKER}-${l.email}`,
        notes: `Seed lead for TC demo prep — ${l.intent} intent · ${l.source}`,
        createdAt,
        updatedAt: createdAt,
      },
    });
    inserted++;
  }
  console.log(
    `  ✓ Inserted ${inserted} new leads (${existing.length} already present from prior runs).`,
  );
  console.log(
    `  ↳ Total demo-prep leads now: ${existing.length + inserted} / ${SAMPLE_LEADS.length} target.`,
  );
}

// ---------------------------------------------------------------------------
// Step 4: tours linked to TOUR_SCHEDULED / TOURED leads
// ---------------------------------------------------------------------------
async function seedTours() {
  console.log("\n[4/4] Seeding tours linked to scheduled/toured leads…");

  // Pick all demo-prep leads whose status implies a tour exists.
  const tourReady = await prisma.lead.findMany({
    where: {
      orgId: ORG_ID,
      externalSystem: MARKER,
      status: {
        in: [
          LeadStatus.TOUR_SCHEDULED,
          LeadStatus.TOURED,
          LeadStatus.APPLICATION_SENT,
          LeadStatus.APPLIED,
          LeadStatus.APPROVED,
          LeadStatus.SIGNED,
        ],
      },
    },
    select: { id: true, status: true, createdAt: true, firstName: true, lastName: true, email: true },
  });

  let inserted = 0;
  for (const lead of tourReady) {
    const existingTour = await prisma.tour.findFirst({
      where: { leadId: lead.id, externalSystem: MARKER },
    });
    if (existingTour) continue;

    const scheduledAt = new Date(lead.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const status: TourStatus =
      lead.status === LeadStatus.TOUR_SCHEDULED
        ? TourStatus.SCHEDULED
        : TourStatus.COMPLETED;
    const completedAt =
      status === TourStatus.COMPLETED
        ? new Date(scheduledAt.getTime() + 30 * 60 * 1000)
        : null;

    await prisma.tour.create({
      data: {
        leadId: lead.id,
        propertyId: PROPERTY_ID,
        status,
        tourType: "in_person",
        scheduledAt,
        completedAt,
        attendeeCount: 1,
        notes: `Seed tour — TC demo prep — ${lead.firstName} ${lead.lastName}`,
        externalSystem: MARKER,
        externalId: `${MARKER}-tour-${lead.id}`,
      },
    });
    inserted++;
  }
  console.log(`  ✓ Inserted ${inserted} new tours.`);
}

// ---------------------------------------------------------------------------
(async () => {
  console.log("=== TC demo prep starting ===");
  console.log(`Org: ${ORG_ID}`);
  console.log(`Property: ${PROPERTY_ID}`);
  await promoteDrafts();
  await configureQuota();
  await seedLeads();
  await seedTours();
  console.log("\n=== TC demo prep complete ===\n");
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
