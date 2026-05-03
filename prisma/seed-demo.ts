/**
 * prisma/seed-demo.ts
 *
 * Creates a realistic demo organisation (Maple Ridge Apartments) with ~90 days
 * of data for use in sales calls.  Idempotent: if the slug "maple-ridge" already
 * exists the script skips creation of every child record that belongs to it.
 *
 * Run:
 *   pnpm seed:demo
 */

import {
  PrismaClient,
  OrgType,
  PropertyType,
  ResidentialSubtype,
  TenantStatus,
  SubscriptionTier,
  SubscriptionStatus,
  LeadSource,
  LeadStatus,
  TourStatus,
  ApplicationStatus,
  AdPlatform,
  ChatbotConversationStatus,
  VisitorIdentificationStatus,
  AuditAction,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

// ---------------------------------------------------------------------------
// Bootstrap Prisma (mirrors seed.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PRODUCTION SAFETY — three independent guards must all clear before this
// script touches the database. The Norman launch demands: NO MORE FAKE DATA
// IN PRODUCTION. If you genuinely need to seed demo content, set up a
// throwaway Neon branch and point DATABASE_URL at it explicitly.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "[seed-demo] Refusing to run when NODE_ENV=production. Aborting."
  );
}
if (process.env.VERCEL_ENV === "production") {
  throw new Error(
    "[seed-demo] Refusing to run against a Vercel production environment. Aborting."
  );
}
if (process.env.ALLOW_DEMO_SEED !== "true") {
  throw new Error(
    "[seed-demo] Demo seeding is disabled. Set ALLOW_DEMO_SEED=true to bypass — but only do so when DATABASE_URL points at a throwaway DB."
  );
}

const connectionString = process.env.DATABASE_URL;

// Best-effort production hostname guard. Trips on the most common Neon /
// Supabase / RDS production naming conventions ("prod", "production",
// "main"). False positives are recoverable; a false negative is a
// fake-data leak that destroys customer trust.
if (connectionString) {
  const lower = connectionString.toLowerCase();
  const looksProd = ["prod", "production", "live", "primary"].some((k) =>
    lower.includes(k)
  );
  if (looksProd && process.env.I_KNOW_THIS_IS_NOT_PROD !== "true") {
    throw new Error(
      `[seed-demo] DATABASE_URL contains a production-looking token. ` +
        `Set I_KNOW_THIS_IS_NOT_PROD=true to override after triple-checking the connection string.`
    );
  }
}
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaNeonHttp(
  connectionString,
  {} as HTTPQueryOptions<boolean, boolean>,
);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Tiny date helpers — no extra imports beyond the runtime
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Uniform integer in [min, max] inclusive */
function ri(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick one element at random */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Demo data constants
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Avery", "Blake", "Cameron", "Dakota", "Emerson",
  "Finley", "Harper", "Jordan", "Kennedy", "Logan",
  "Morgan", "Parker", "Quinn", "Riley", "Skylar",
  "Taylor", "Avery", "Bryce", "Casey", "Devon",
  "Evan", "Frankie", "Gray", "Hunter", "Iris",
  "Jamie", "Kai", "Lane", "Mason", "Noah",
  "Oakley", "Peyton", "Reese", "Sawyer", "Tatum",
  "Uri", "Vance", "Wren", "Xander", "Yael",
  "Zara", "Alex", "Bailey", "Charlie", "Drew",
  "Ellis", "Flynn", "Greer", "Hadley", "Indigo",
  "Jett", "Keegan", "Laken", "Marlowe", "Nolan",
  "Onyx", "Piper", "Remy", "Scout", "Tobin",
];

const LAST_NAMES = [
  "Anderson", "Baker", "Chen", "Davis", "Evans",
  "Foster", "Garcia", "Harris", "Iyer", "Jones",
  "Kim", "Lee", "Miller", "Nguyen", "Okafor",
  "Patel", "Quinn", "Roberts", "Singh", "Turner",
  "Ueda", "Vargas", "Wang", "Xavier", "Young",
  "Zhang", "Abbott", "Brennan", "Cruz", "Dixon",
  "Estes", "Flores", "Green", "Hayes", "Ingram",
  "Jackson", "Kaur", "Lopez", "Moore", "Nash",
  "Olsen", "Park", "Reed", "Santos", "Thomas",
  "Underwood", "Vega", "White", "Xiong", "Yamamoto",
];

// 60 unique name pairs — zip first/last by index
const LEAD_NAMES = Array.from({ length: 60 }, (_, i) => ({
  firstName: FIRST_NAMES[i % FIRST_NAMES.length],
  lastName: LAST_NAMES[i % LAST_NAMES.length],
}));

const LEAD_STATUS_DISTRIBUTION: LeadStatus[] = [
  ...Array(15).fill(LeadStatus.NEW),
  ...Array(12).fill(LeadStatus.CONTACTED),
  ...Array(8).fill(LeadStatus.TOUR_SCHEDULED),
  ...Array(7).fill(LeadStatus.TOURED),
  ...Array(5).fill(LeadStatus.APPLICATION_SENT),
  ...Array(4).fill(LeadStatus.APPLIED),
  ...Array(3).fill(LeadStatus.APPROVED),
  ...Array(4).fill(LeadStatus.SIGNED),
  ...Array(2).fill(LeadStatus.LOST),
];

const LEAD_SOURCE_WEIGHTS: { source: LeadSource; weight: number }[] = [
  { source: LeadSource.CHATBOT, weight: 30 },
  { source: LeadSource.GOOGLE_ADS, weight: 25 },
  { source: LeadSource.ORGANIC, weight: 20 },
  { source: LeadSource.REFERRAL, weight: 15 },
  { source: LeadSource.DIRECT, weight: 10 },
];

function randomSource(): LeadSource {
  const total = LEAD_SOURCE_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let rand = Math.random() * total;
  for (const { source, weight } of LEAD_SOURCE_WEIGHTS) {
    rand -= weight;
    if (rand <= 0) return source;
  }
  return LeadSource.DIRECT;
}

function scoreForStatus(status: LeadStatus): number {
  const floor: Record<LeadStatus, [number, number]> = {
    NEW: [20, 40],
    CONTACTED: [30, 55],
    TOUR_SCHEDULED: [50, 70],
    TOURED: [60, 80],
    APPLICATION_SENT: [65, 85],
    APPLIED: [70, 90],
    APPROVED: [80, 95],
    SIGNED: [85, 95],
    LOST: [20, 45],
    UNQUALIFIED: [10, 30],
  };
  const [lo, hi] = floor[status] ?? [20, 60];
  return ri(lo, hi);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Starting Maple Ridge demo seed…");

  // ------------------------------------------------------------------
  // 1. Organisation — idempotent
  // ------------------------------------------------------------------
  const existing = await prisma.organization.findUnique({
    where: { slug: "maple-ridge" },
  });

  if (existing) {
    console.log(
      `  Organisation "maple-ridge" already exists (id: ${existing.id}). Skipping all creation.`,
    );
    console.log(`\nDemo org ID: ${existing.id}`);
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Maple Ridge Apartments",
      shortName: "Maple Ridge",
      slug: "maple-ridge",
      orgType: OrgType.CLIENT,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.MULTIFAMILY,
      status: TenantStatus.ACTIVE,
      primaryContactName: "Sarah Chen",
      primaryContactEmail: "sarah@mapleridgeapts.com",
      primaryContactPhone: "(512) 555-0142",
      primaryContactRole: "Property Manager",
      hqAddressLine1: "2847 Maple Creek Drive",
      hqCity: "Austin",
      hqState: "TX",
      hqPostalCode: "78701",
      subscriptionTier: SubscriptionTier.GROWTH,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartedAt: daysAgo(120),
      mrrCents: 79900,
      // All modules on for a full demo
      moduleWebsite: true,
      modulePixel: true,
      moduleChatbot: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleSEO: true,
      moduleEmail: true,
      moduleOutboundEmail: true,
      moduleReferrals: true,
      moduleCreativeStudio: true,
      moduleLeadCapture: true,
      primaryColor: "#2E7D32",
      secondaryColor: "#F9A825",
    },
  });
  console.log(`  Created org: ${org.name} (${org.id})`);

  // ------------------------------------------------------------------
  // 2. Property
  // ------------------------------------------------------------------
  const property = await prisma.property.create({
    data: {
      orgId: org.id,
      name: "Maple Ridge",
      slug: "maple-ridge-main",
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.MULTIFAMILY,
      addressLine1: "2847 Maple Creek Drive",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
      latitude: 30.2672,
      longitude: -97.7431,
      totalUnits: 120,
      priceMin: 145000,
      priceMax: 310000,
      availableCount: 21,
      description:
        "Modern multifamily community in central Austin. Walk to restaurants, parks, and the Domain. All units fully furnished with smart-home features.",
      amenities: [
        "Resort-style pool",
        "24-hour fitness center",
        "Co-working lounge",
        "Dog park",
        "Package concierge",
        "Rooftop terrace",
        "EV charging stations",
        "In-unit washer/dryer",
      ],
      yearBuilt: 2019,
    },
  });
  console.log(`  Created property: ${property.name} (${property.id})`);

  // ------------------------------------------------------------------
  // 3. Listings (6 types — available + leased rows)
  // ------------------------------------------------------------------
  const listingDefs = [
    {
      unitType: "Studio",
      bedrooms: 0,
      bathrooms: 1,
      squareFeet: 520,
      priceCents: 145000,
      available: 4,
      leased: 16,
    },
    {
      unitType: "1BR/1BA",
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 720,
      priceCents: 175000,
      available: 6,
      leased: 32,
    },
    {
      unitType: "1BR/1BA Den",
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 850,
      priceCents: 195000,
      available: 3,
      leased: 18,
    },
    {
      unitType: "2BR/2BA",
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1050,
      priceCents: 235000,
      available: 5,
      leased: 28,
    },
    {
      unitType: "2BR/2BA Premium",
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 1180,
      priceCents: 265000,
      available: 2,
      leased: 14,
    },
    {
      unitType: "3BR/2BA",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1420,
      priceCents: 310000,
      available: 1,
      leased: 8,
    },
  ];

  let unitCounter = 100;
  const listings = await prisma.$transaction(
    listingDefs.flatMap((def) => {
      const rows = [];
      // Available units
      for (let i = 0; i < def.available; i++) {
        unitCounter++;
        rows.push(
          prisma.listing.create({
            data: {
              propertyId: property.id,
              unitType: def.unitType,
              unitNumber: String(unitCounter),
              bedrooms: def.bedrooms,
              bathrooms: def.bathrooms,
              squareFeet: def.squareFeet,
              priceCents: def.priceCents,
              isAvailable: true,
              availableFrom: daysFromNow(ri(0, 30)),
              leaseTermMonths: 12,
            },
          }),
        );
      }
      // Leased units
      for (let i = 0; i < def.leased; i++) {
        unitCounter++;
        rows.push(
          prisma.listing.create({
            data: {
              propertyId: property.id,
              unitType: def.unitType,
              unitNumber: String(unitCounter),
              bedrooms: def.bedrooms,
              bathrooms: def.bathrooms,
              squareFeet: def.squareFeet,
              priceCents: def.priceCents,
              isAvailable: false,
              leaseTermMonths: 12,
            },
          }),
        );
      }
      return rows;
    }),
  );
  console.log(`  Created ${listings.length} listings`);

  // ------------------------------------------------------------------
  // 4. Leads (60)
  // ------------------------------------------------------------------
  const leadRecords = await prisma.$transaction(
    LEAD_NAMES.map((name, idx) => {
      const status = LEAD_STATUS_DISTRIBUTION[idx];
      const source = randomSource();
      const createdAt = daysAgo(ri(0, 90));
      const score = scoreForStatus(status);

      return prisma.lead.create({
        data: {
          orgId: org.id,
          propertyId: property.id,
          firstName: name.firstName,
          lastName: name.lastName,
          email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@gmail.com`,
          phone: `(512) 555-${String(ri(1000, 9999))}`,
          source,
          status,
          score,
          intent: score >= 70 ? "hot" : score >= 45 ? "warm" : "cold",
          preferredUnitType: pick(listingDefs).unitType,
          desiredMoveIn: daysFromNow(ri(15, 90)),
          budgetMinCents: ri(130000, 180000),
          budgetMaxCents: ri(200000, 320000),
          firstSeenAt: createdAt,
          lastActivityAt: daysAgo(ri(0, 14)),
          convertedAt:
            status === LeadStatus.SIGNED ? daysAgo(ri(1, 20)) : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }),
  );
  console.log(`  Created ${leadRecords.length} leads`);

  // ------------------------------------------------------------------
  // 5. Tours (15 — linked to TOUR_SCHEDULED + TOURED leads)
  // ------------------------------------------------------------------
  const tourLeads = leadRecords.filter(
    (l) =>
      l.status === LeadStatus.TOUR_SCHEDULED ||
      l.status === LeadStatus.TOURED,
  );

  const tours = await prisma.$transaction(
    tourLeads.slice(0, 15).map((lead) => {
      const isCompleted = lead.status === LeadStatus.TOURED;
      const scheduledAt = isCompleted
        ? daysAgo(ri(1, 14))
        : daysFromNow(ri(1, 14));
      return prisma.tour.create({
        data: {
          leadId: lead.id,
          propertyId: property.id,
          status: isCompleted ? TourStatus.COMPLETED : TourStatus.SCHEDULED,
          tourType: pick(["in_person", "in_person", "virtual"]),
          scheduledAt,
          completedAt: isCompleted ? scheduledAt : null,
          attendeeCount: ri(1, 3),
          notes: isCompleted
            ? "Toured 2BR and Studio. Very interested in 2BR/2BA Premium."
            : null,
        },
      });
    }),
  );
  console.log(`  Created ${tours.length} tours`);

  // ------------------------------------------------------------------
  // 6. Applications (7 — APPLIED / APPROVED / SIGNED)
  // ------------------------------------------------------------------
  const appLeads = leadRecords.filter(
    (l) =>
      l.status === LeadStatus.APPLIED ||
      l.status === LeadStatus.APPROVED ||
      l.status === LeadStatus.SIGNED,
  );

  const appStatusMap: Record<string, ApplicationStatus> = {
    [LeadStatus.APPLIED]: ApplicationStatus.SUBMITTED,
    [LeadStatus.APPROVED]: ApplicationStatus.APPROVED,
    [LeadStatus.SIGNED]: ApplicationStatus.APPROVED,
  };

  const applications = await prisma.$transaction(
    appLeads.slice(0, 7).map((lead) => {
      const submittedAt = daysAgo(ri(1, 30));
      return prisma.application.create({
        data: {
          leadId: lead.id,
          propertyId: property.id,
          status: appStatusMap[lead.status] ?? ApplicationStatus.SUBMITTED,
          appliedAt: submittedAt,
          decidedAt:
            lead.status === LeadStatus.APPROVED ||
            lead.status === LeadStatus.SIGNED
              ? daysAgo(ri(1, 15))
              : null,
          applicantData: {
            preferredUnit: pick(listingDefs).unitType,
            moveinDate: lead.desiredMoveIn,
          },
        },
      });
    }),
  );
  console.log(`  Created ${applications.length} applications`);

  // ------------------------------------------------------------------
  // 7. AdAccount
  // ------------------------------------------------------------------
  const adAccount = await prisma.adAccount.create({
    data: {
      orgId: org.id,
      platform: AdPlatform.GOOGLE_ADS,
      externalAccountId: "demo-123456789",
      displayName: "Maple Ridge Google Ads",
      currency: "USD",
      accessStatus: "active",
      autoSyncEnabled: true,
    },
  });
  console.log(`  Created ad account: ${adAccount.displayName}`);

  // ------------------------------------------------------------------
  // 8. AdCampaigns (3)
  // ------------------------------------------------------------------
  const campaignDefs = [
    {
      name: "Brand Search Campaign",
      status: "ENABLED",
      objective: "SEARCH",
      dailyBudgetCents: 5000,
    },
    {
      name: "Competitor Keywords",
      status: "ENABLED",
      objective: "SEARCH",
      dailyBudgetCents: 8000,
    },
    {
      name: "Display Remarketing",
      status: "PAUSED",
      objective: "DISPLAY",
      dailyBudgetCents: 3000,
    },
  ];

  const campaigns = await prisma.$transaction(
    campaignDefs.map((def, i) =>
      prisma.adCampaign.create({
        data: {
          orgId: org.id,
          propertyId: property.id,
          adAccountId: adAccount.id,
          externalCampaignId: `demo-camp-${1000 + i}`,
          name: def.name,
          platform: AdPlatform.GOOGLE_ADS,
          status: def.status,
          objective: def.objective,
          dailyBudgetCents: def.dailyBudgetCents,
          startDate: daysAgo(90),
          impressions: 0,
          clicks: 0,
          conversions: 0,
          spendToDateCents: 0,
        },
      }),
    ),
  );
  console.log(`  Created ${campaigns.length} ad campaigns`);

  // ------------------------------------------------------------------
  // 9. AdMetricDaily (last 30 days × 3 campaigns)
  // ------------------------------------------------------------------
  const metricRows: Parameters<typeof prisma.adMetricDaily.create>[0]["data"][] =
    [];

  for (let daysBack = 30; daysBack >= 0; daysBack--) {
    const date = daysAgo(daysBack);
    // Normalise to UTC midnight (date-only field)
    date.setUTCHours(0, 0, 0, 0);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    for (const campaign of campaigns) {
      if (campaign.status === "PAUSED") {
        // Paused — no spend, low impressions
        const impressions = isWeekend ? ri(50, 150) : ri(100, 300);
        metricRows.push({
          orgId: org.id,
          adAccountId: adAccount.id,
          campaignId: campaign.id,
          date,
          impressions,
          clicks: 0,
          spendCents: 0,
          conversions: 0,
          ctr: 0,
          cpcCents: 0,
          costPerConversionCents: 0,
        });
        continue;
      }

      const impressions = isWeekend ? ri(500, 900) : ri(900, 2000);
      const clicks = isWeekend ? ri(15, 35) : ri(35, 80);
      const spendCents = isWeekend ? ri(1500, 2800) : ri(2800, 4500);
      const conversions = Math.random() < 0.4 ? ri(1, 3) : 0;
      const ctr = clicks / impressions;
      const cpcCents = clicks > 0 ? Math.round(spendCents / clicks) : 0;
      const costPerConversionCents =
        conversions > 0 ? Math.round(spendCents / conversions) : 0;

      metricRows.push({
        orgId: org.id,
        adAccountId: adAccount.id,
        campaignId: campaign.id,
        date,
        impressions,
        clicks,
        spendCents,
        conversions,
        conversionValueCents: conversions * ri(145000, 250000),
        ctr,
        cpcCents,
        costPerConversionCents,
      });
    }
  }

  // createMany not available on Neon adapter — batch in groups of 20
  for (let i = 0; i < metricRows.length; i += 20) {
    await prisma.$transaction(
      metricRows.slice(i, i + 20).map((row) =>
        prisma.adMetricDaily.create({ data: row }),
      ),
    );
  }
  console.log(`  Created ${metricRows.length} ad metric rows`);

  // ------------------------------------------------------------------
  // 10. ChatbotConversations (25 — last 30 days)
  // ------------------------------------------------------------------
  const chatStatusOptions: ChatbotConversationStatus[] = [
    ChatbotConversationStatus.CLOSED,
    ChatbotConversationStatus.CLOSED,
    ChatbotConversationStatus.CLOSED,
    ChatbotConversationStatus.LEAD_CAPTURED,
    ChatbotConversationStatus.LEAD_CAPTURED,
    ChatbotConversationStatus.ABANDONED,
  ];

  const chatConvs = await prisma.$transaction(
    Array.from({ length: 25 }, (_, i) => {
      const createdAt = daysAgo(ri(0, 30));
      const msgCount = ri(3, 12);
      const status = pick(chatStatusOptions);
      const isIdentified = status === ChatbotConversationStatus.LEAD_CAPTURED;
      const lead = isIdentified
        ? pick(leadRecords.filter((l) => l.source === LeadSource.CHATBOT))
        : null;

      const messages = Array.from({ length: msgCount }, (__, j) => ({
        role: j % 2 === 0 ? "user" : "assistant",
        content:
          j % 2 === 0
            ? pick([
                "What floor plans do you have available?",
                "How much is a 2 bedroom?",
                "Do you allow pets?",
                "When can I schedule a tour?",
                "Is parking included?",
                "What's the move-in special?",
                "Are utilities included?",
                "How close is it to downtown Austin?",
              ])
            : pick([
                "We have 1BR, 2BR, and Studio floor plans available right now.",
                "2BR/2BA units start at $2,350/mo. Would you like to schedule a tour?",
                "Yes, we're pet-friendly with a one-time pet fee.",
                "You can book a tour directly on our website — tours are available 7 days a week.",
                "One parking spot is included with every unit.",
                "We currently have a special: first month free on select units.",
                "Water and trash are included. Electric is tenant responsibility.",
                "We're 10 minutes from the Domain and 15 minutes from downtown.",
              ]),
        timestamp: new Date(createdAt.getTime() + j * 60_000).toISOString(),
      }));

      return prisma.chatbotConversation.create({
        data: {
          orgId: org.id,
          propertyId: property.id,
          leadId: lead?.id ?? null,
          status,
          sessionId: `demo-session-${Date.now()}-${i}`,
          messages,
          messageCount: msgCount,
          capturedName:
            isIdentified && lead
              ? `${lead.firstName} ${lead.lastName}`
              : null,
          capturedEmail: isIdentified && lead ? lead.email : null,
          lastMessageAt: createdAt,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }),
  );
  console.log(`  Created ${chatConvs.length} chatbot conversations`);

  // ------------------------------------------------------------------
  // 11. Visitors (40 — last 14 days)
  // ------------------------------------------------------------------
  const visitors = await prisma.$transaction(
    Array.from({ length: 40 }, (_, i) => {
      const createdAt = daysAgo(ri(0, 14));
      const isIdentified = i < 15; // first 15 are identified
      const lead = isIdentified ? leadRecords[i] : null;

      return prisma.visitor.create({
        data: {
          orgId: org.id,
          propertyId: property.id,
          status: isIdentified
            ? VisitorIdentificationStatus.IDENTIFIED
            : VisitorIdentificationStatus.ANONYMOUS,
          firstName: isIdentified && lead ? lead.firstName : null,
          lastName: isIdentified && lead ? lead.lastName : null,
          email: isIdentified && lead ? lead.email : null,
          visitorHash: `demo-visitor-hash-${i}`,
          intentScore: ri(20, 95),
          sessionCount: ri(1, 6),
          totalTimeSeconds: ri(45, 600),
          firstSeenAt: createdAt,
          lastSeenAt: daysAgo(ri(0, 3)),
          utmSource: pick(["google", "google", "direct", "bing", null]),
          utmMedium: pick(["cpc", "organic", null]),
          createdAt,
          updatedAt: createdAt,
        },
      });
    }),
  );
  console.log(`  Created ${visitors.length} visitors`);

  // ------------------------------------------------------------------
  // 12. Insights (3)
  // ------------------------------------------------------------------
  const insights = await prisma.$transaction([
    prisma.insight.create({
      data: {
        orgId: org.id,
        propertyId: property.id,
        kind: "pipeline_stall",
        severity: "warning",
        category: "leads",
        title: "Leasing velocity slowed this week",
        body: "Leads moving to TOURED status dropped 32% vs the prior 7-day average. 8 prospects have been in CONTACTED for more than 5 days without a tour booked.",
        suggestedAction:
          "Trigger a follow-up email cadence to the 8 stalled contacts. Consider offering a self-guided tour option.",
        status: "open",
        dedupeKey: `leasing_velocity_drop:${property.id}:week:2026-16`,
        context: {
          before: 12,
          after: 8,
          deltaPct: -33,
          periodStart: daysAgo(14).toISOString(),
          periodEnd: daysAgo(7).toISOString(),
        },
        createdAt: daysAgo(2),
        updatedAt: daysAgo(2),
      },
    }),
    prisma.insight.create({
      data: {
        orgId: org.id,
        propertyId: property.id,
        kind: "chatbot_pattern",
        severity: "info",
        category: "leads",
        title: "Chatbot driving 30% of all leads",
        body: "18 of the last 60 leads originated from the AI chatbot widget — higher than any other single source this month. Average chatbot lead score is 62, above the 55 portfolio average.",
        suggestedAction:
          "No action needed. Monitor conversion rate from chatbot leads to tours.",
        status: "open",
        dedupeKey: `lead_source_concentration:${property.id}:chatbot:2026-16`,
        context: { sourcePct: 30, avgScore: 62, portfolioAvgScore: 55 },
        createdAt: daysAgo(3),
        updatedAt: daysAgo(3),
      },
    }),
    prisma.insight.create({
      data: {
        orgId: org.id,
        propertyId: property.id,
        kind: "conv_rate_drop",
        severity: "warning",
        category: "leads",
        title: "Tour-to-application rate below target",
        body: "Only 3 of 15 completed tours converted to applications this month — a 20% rate vs the 35% target. Dropping conversions may indicate pricing resistance or unit availability gaps.",
        suggestedAction:
          "Review post-tour follow-up timing. Consider adding a 24-hour follow-up text template for all TOURED leads.",
        status: "open",
        dedupeKey: `low_tour_conversion:${property.id}:2026-16`,
        context: { tours: 15, applications: 3, ratePct: 20, targetPct: 35 },
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      },
    }),
  ]);
  console.log(`  Created ${insights.length} insights`);

  // ------------------------------------------------------------------
  // 13. AuditEvents (10)
  // ------------------------------------------------------------------
  const auditActions = [
    {
      action: AuditAction.CREATE,
      entityType: "Organization",
      description: "Demo org Maple Ridge Apartments created",
      daysAgoN: 120,
    },
    {
      action: AuditAction.SETTING_CHANGE,
      entityType: "Organization",
      description: "Chatbot module enabled",
      daysAgoN: 100,
    },
    {
      action: AuditAction.SETTING_CHANGE,
      entityType: "Organization",
      description: "Google Ads integration connected",
      daysAgoN: 90,
    },
    {
      action: AuditAction.SETTING_CHANGE,
      entityType: "Organization",
      description: "SEO module enabled",
      daysAgoN: 80,
    },
    {
      action: AuditAction.CREATE,
      entityType: "AdAccount",
      description: "Google Ads account linked",
      daysAgoN: 88,
    },
    {
      action: AuditAction.UPDATE,
      entityType: "Lead",
      description: "Lead status changed: NEW → CONTACTED",
      daysAgoN: 5,
    },
    {
      action: AuditAction.UPDATE,
      entityType: "Lead",
      description: "Lead status changed: CONTACTED → TOUR_SCHEDULED",
      daysAgoN: 3,
    },
    {
      action: AuditAction.UPDATE,
      entityType: "Lead",
      description: "Lead status changed: TOURED → APPLICATION_SENT",
      daysAgoN: 2,
    },
    {
      action: AuditAction.SETTING_CHANGE,
      entityType: "TenantSiteConfig",
      description: "Exit intent popup enabled",
      daysAgoN: 14,
    },
    {
      action: AuditAction.UPDATE,
      entityType: "Lead",
      description: "Lead status changed: APPROVED → SIGNED",
      daysAgoN: 1,
    },
  ];

  const auditEvents = await prisma.$transaction(
    auditActions.map((ev) => {
      const createdAt = daysAgo(ev.daysAgoN);
      return prisma.auditEvent.create({
        data: {
          orgId: org.id,
          action: ev.action,
          entityType: ev.entityType,
          entityId: org.id,
          description: ev.description,
          createdAt,
        },
      });
    }),
  );
  console.log(`  Created ${auditEvents.length} audit events`);

  // ------------------------------------------------------------------
  // Done
  // ------------------------------------------------------------------
  console.log(`
Demo seed complete.
  Org:          ${org.name}
  Org ID:       ${org.id}
  Slug:         ${org.slug}
  Property:     ${property.name} (${property.id})
  Listings:     ${listings.length}
  Leads:        ${leadRecords.length}
  Tours:        ${tours.length}
  Applications: ${applications.length}
  Ad campaigns: ${campaigns.length}
  Ad metrics:   ${metricRows.length} daily rows
  Chatbot convs:${chatConvs.length}
  Visitors:     ${visitors.length}
  Insights:     ${insights.length}
  Audit events: ${auditEvents.length}
`);
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
