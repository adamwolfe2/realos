/**
 * scripts/seed-telegraph-commons.ts
 *
 * Demo-data seeder for the Telegraph Commons CLIENT tenant.
 *
 * Assumes prisma/seed.ts has already run (Agency org, Telegraph Commons org
 * with slug "telegraph-commons", one AGENCY_OWNER, and one Property).
 *
 * Run:
 *   set -a; source .env.local; set +a; pnpm exec tsx scripts/seed-telegraph-commons.ts
 *
 * Idempotent: safe to re-run. Uses upsert where a unique index exists,
 * skip-if-exists otherwise.
 */

import "dotenv/config";
import * as dotenv from "dotenv";

// Load .env.local first (Next.js convention), then .env as fallback.
// "dotenv/config" above handles .env automatically; this adds .env.local.
dotenv.config({ path: ".env.local", override: false });

import {
  PrismaClient,
  ChatbotCaptureMode,
  ChatbotConversationStatus,
  CreativeFormat,
  CreativeRequestStatus,
  LeadSource,
  LeadStatus,
  TourStatus,
  VisitorIdentificationStatus,
} from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import type { HTTPQueryOptions } from "@neondatabase/serverless";

// -----------------------------------------------------------------------------
// Safety guard
// -----------------------------------------------------------------------------

if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA !== "1") {
  throw new Error(
    "Refusing to run demo seed in production without SEED_DEMO_DATA=1. Aborting.",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Source .env.local first.");
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

const TC_KNOWLEDGE_BASE = `You are the Telegraph Commons virtual assistant. You help prospective UC Berkeley students and their families learn about Telegraph Commons student housing at 2490 Channing Way, Berkeley, CA 94704.

PROPERTY DETAILS:
- Location: 2490 Channing Way, Berkeley, CA 94704 (2 blocks from UC Berkeley campus, 3-minute walk to Sproul Plaza)
- Walk Score: 99
- Unit types: 1-bedroom, 2-bedroom, and 3-bedroom private dorm rooms
- All rooms are fully furnished
- Phone: (510) 462-5442

ALL-INCLUSIVE AMENITIES:
- In-room Google WiFi
- Cable television
- Fiber optic ethernet
- Fully furnished rooms
- Daily janitorial service
- Study rooms (quiet zones)
- Common area lounge & kitchen
- Laundry center
- Vending machines
- Controlled access entry
- Berkeley shuttle access
- Onsite community managers

NEIGHBORHOOD:
- Telegraph Avenue (restaurants, shops, cafes) is steps away
- Downtown Berkeley BART station ~10 minute walk
- Surrounded by UC Berkeley campus buildings, libraries, and lecture halls
- Vibrant student neighborhood in Southside Berkeley

APPLICATION PROCESS:
- Applications are handled through our property management portal
- Direct prospective residents to the "Apply Now" button on the website or visit our availabilities page
- For specific pricing, encourage them to contact the leasing team or schedule a tour

BEHAVIOR RULES:
- Be friendly, helpful, and student-appropriate (not corporate)
- After answering 2-3 questions naturally, ask for their name and email: "I can send you more details - what's your email?"
- If they ask about specific pricing or exact availability, say: "I'd recommend checking our current availabilities page or scheduling a tour so our team can walk you through options and current pricing."
- If they want to schedule a tour, direct them to the Schedule a Tour button or offer to help them book one
- Keep responses concise (2-4 sentences max unless they ask for detail)
- If asked about something you don't know, say so honestly and suggest they contact the leasing office at (510) 462-5442
- You can answer general questions about Berkeley, UC Berkeley campus life, and the neighborhood`;

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  // 0. Resolve Telegraph Commons org + its first Property
  const org = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    include: { properties: { orderBy: { createdAt: "asc" } } },
  });

  if (!org) {
    throw new Error(
      `Organization with slug "${ORG_SLUG}" not found. Run prisma/seed.ts first.`,
    );
  }

  const property = org.properties[0];
  if (!property) {
    throw new Error(
      `No Property found for org "${ORG_SLUG}". Run prisma/seed.ts first.`,
    );
  }

  const orgId = org.id;
  const propertyId = property.id;

  // ---------------------------------------------------------------------------
  // 1. DomainBinding rows
  // ---------------------------------------------------------------------------

  const apex = await prisma.domainBinding.upsert({
    where: { hostname: "telegraphcommons.com" },
    update: {
      orgId,
      isPrimary: true,
      sslStatus: "active",
      dnsConfigured: true,
    },
    create: {
      orgId,
      hostname: "telegraphcommons.com",
      isPrimary: true,
      sslStatus: "active",
      dnsConfigured: true,
    },
  });

  const www = await prisma.domainBinding.upsert({
    where: { hostname: "www.telegraphcommons.com" },
    update: {
      orgId,
      isPrimary: false,
      sslStatus: "active",
      dnsConfigured: true,
    },
    create: {
      orgId,
      hostname: "www.telegraphcommons.com",
      isPrimary: false,
      sslStatus: "active",
      dnsConfigured: true,
    },
  });

  // ---------------------------------------------------------------------------
  // 2. TenantSiteConfig
  // ---------------------------------------------------------------------------

  const siteConfigPayload = {
    siteTitle: "Telegraph Commons",
    tagline: "Private dorms, two blocks from UC Berkeley.",
    heroHeadline: "Student Housing Steps from UC Berkeley Campus",
    heroSubheadline:
      "Private dorms at 2490 Channing Way — a 3-minute walk to Sproul Plaza. Fully furnished, all-inclusive, Walk Score 99.",
    heroImageUrl: "/images/hero-students.avif",
    aboutCopy:
      "Telegraph Commons is a purpose-built student residence in the heart of Southside Berkeley. Our 1-, 2-, and 3-bedroom dorm rooms come fully furnished with high-speed fiber internet, cable, and daily janitorial service. Study lounges, a community kitchen, controlled access entry, and onsite managers make it easy to focus on campus life.",
    primaryCtaText: "Schedule a Tour",
    primaryCtaUrl: "https://telegraphcommons.com/contact#tour",
    phoneNumber: "(510) 462-5442",
    contactEmail: "leasing@telegraphcommons.com",
    metaTitle: "Telegraph Commons | Student Housing Near UC Berkeley Campus",
    metaDescription:
      "Fully furnished private dorms at 2490 Channing Way — 3 minutes to Sproul Plaza. All-inclusive pricing, study rooms, Berkeley shuttle. Schedule a tour today.",
    ogImageUrl: "/images/og-telegraph-commons.png",
    showListings: true,
    showFloorPlans: true,
    showAmenities: true,
    showReviews: false,
    showBlog: false,
    enableExitIntent: true,
    enableChatbot: true,
    enablePixel: true,
    chatbotEnabled: true,
    chatbotPersonaName: "Telegraph Assistant",
    chatbotGreeting:
      "Hey! Looking for student housing near UC Berkeley? I know Telegraph Commons inside and out — ask me about rooms, amenities, the neighborhood, or how to apply.",
    chatbotTeaserText: "Questions about Telegraph Commons? I can help.",
    chatbotBrandColor: "#f5c518",
    chatbotCaptureMode: ChatbotCaptureMode.ON_INTENT,
    chatbotKnowledgeBase: TC_KNOWLEDGE_BASE,
    chatbotIdleTriggerSeconds: 30,
    exitIntentHeadline: "Before you go — want a tour?",
    exitIntentBody:
      "Book a 15-minute walkthrough of Telegraph Commons and see what's available for the fall.",
    exitIntentCtaText: "Schedule My Tour",
  };

  await prisma.tenantSiteConfig.upsert({
    where: { orgId },
    update: siteConfigPayload,
    create: { orgId, ...siteConfigPayload },
  });

  // ---------------------------------------------------------------------------
  // 3. Listings — 1-bed, 2-bed, 3-bed
  // ---------------------------------------------------------------------------

  const listings = [
    {
      backendListingId: "tc-seed-1bed-a",
      unitType: "Private 1-Bedroom",
      unitNumber: "304",
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 200,
      priceCents: 180000, // $1,800
      amenityFeeCents: 8500,
      leaseTermMonths: 12,
      isAvailable: true,
      availableFrom: daysFromNow(45),
      description:
        "Private 1-bedroom dorm with full bed, desk, dresser, and ensuite-style bath. Fiber internet, cable, and weekly janitorial included. Third-floor unit facing Channing Way.",
    },
    {
      backendListingId: "tc-seed-2bed-b",
      unitType: "Shared 2-Bedroom",
      unitNumber: "212",
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 350,
      priceCents: 160000, // $1,600 per bed
      amenityFeeCents: 8500,
      leaseTermMonths: 12,
      isAvailable: true,
      availableFrom: daysFromNow(30),
      description:
        "Two-bedroom suite with shared bath and common lounge area. Each bedroom fully furnished. Per-bed pricing. One bed currently open for fall move-in.",
    },
    {
      backendListingId: "tc-seed-3bed-c",
      unitType: "Shared 3-Bedroom Suite",
      unitNumber: "418",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 500,
      priceCents: 140000, // $1,400 per bed
      amenityFeeCents: 8500,
      leaseTermMonths: 12,
      isAvailable: true,
      availableFrom: daysFromNow(60),
      description:
        "Top-floor 3-bedroom suite with two baths and a shared kitchenette. Corner unit with Telegraph Avenue views. All three beds available as a group lease.",
    },
  ];

  for (const l of listings) {
    await prisma.listing.upsert({
      where: {
        propertyId_backendListingId: {
          propertyId,
          backendListingId: l.backendListingId,
        },
      },
      update: { ...l, propertyId },
      create: { ...l, propertyId },
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Leads — ~8, mixed statuses & sources, across last 30 days
  // ---------------------------------------------------------------------------

  const leadSeeds = [
    {
      externalId: "tc-seed-lead-01",
      firstName: "Emma",
      lastName: "Nakamura",
      email: "emma.nakamura@berkeley.edu",
      phone: "(415) 555-0142",
      source: LeadSource.FORM,
      sourceDetail: "contact-form",
      status: LeadStatus.NEW,
      score: 62,
      intent: "warm",
      preferredUnitType: "Private 1-Bedroom",
      desiredMoveIn: daysFromNow(60),
      notes: "Transferring from UC Davis, wants a quiet 1-bed for senior year.",
      createdAt: daysAgo(2),
      tourScheduledAt: null as Date | null,
    },
    {
      externalId: "tc-seed-lead-02",
      firstName: "Jamal",
      lastName: "Whitfield",
      email: "jamal.whitfield@berkeley.edu",
      phone: "(510) 555-0198",
      source: LeadSource.CHATBOT,
      sourceDetail: "homepage chat",
      status: LeadStatus.CONTACTED,
      score: 71,
      intent: "warm",
      preferredUnitType: "Shared 2-Bedroom",
      desiredMoveIn: daysFromNow(45),
      notes: "Asked about furnished rooms and shuttle schedule via chatbot.",
      createdAt: daysAgo(5),
      tourScheduledAt: null,
    },
    {
      externalId: "tc-seed-lead-03",
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@berkeley.edu",
      phone: "(408) 555-0123",
      source: LeadSource.ORGANIC,
      sourceDetail: "google-search",
      status: LeadStatus.TOUR_SCHEDULED,
      score: 82,
      intent: "hot",
      preferredUnitType: "Private 1-Bedroom",
      desiredMoveIn: daysFromNow(30),
      notes: "Tour booked for Saturday. Pre-med, prefers quiet floor.",
      createdAt: daysAgo(8),
      tourScheduledAt: daysFromNow(3),
    },
    {
      externalId: "tc-seed-lead-04",
      firstName: "Diego",
      lastName: "Morales",
      email: "dmorales@berkeley.edu",
      phone: "(650) 555-0167",
      source: LeadSource.REFERRAL,
      sourceDetail: "current-resident",
      status: LeadStatus.TOURED,
      score: 78,
      intent: "warm",
      preferredUnitType: "Shared 3-Bedroom Suite",
      desiredMoveIn: daysFromNow(60),
      notes: "Toured with two friends. Group wants a 3-bed together for fall.",
      createdAt: daysAgo(12),
      tourScheduledAt: daysAgo(4),
    },
    {
      externalId: "tc-seed-lead-05",
      firstName: "Sofia",
      lastName: "Chen",
      email: "sofia.chen@berkeley.edu",
      phone: "(925) 555-0134",
      source: LeadSource.META_ADS,
      sourceDetail: "ig-story-campaign",
      status: LeadStatus.APPLICATION_SENT,
      score: 88,
      intent: "hot",
      preferredUnitType: "Shared 2-Bedroom",
      desiredMoveIn: daysFromNow(45),
      notes: "AppFolio application sent. Waiting on co-signer info.",
      createdAt: daysAgo(15),
      tourScheduledAt: daysAgo(6),
    },
    {
      externalId: "tc-seed-lead-06",
      firstName: "Marcus",
      lastName: "Lee",
      email: "marcus.lee@berkeley.edu",
      phone: "(310) 555-0189",
      source: LeadSource.GOOGLE_ADS,
      sourceDetail: "paid-search-berkeley-student-housing",
      status: LeadStatus.APPLIED,
      score: 91,
      intent: "hot",
      preferredUnitType: "Private 1-Bedroom",
      desiredMoveIn: daysFromNow(30),
      notes: "Application submitted via AppFolio, pending review.",
      createdAt: daysAgo(20),
      tourScheduledAt: daysAgo(12),
    },
    {
      externalId: "tc-seed-lead-07",
      firstName: "Hannah",
      lastName: "Okafor",
      email: "h.okafor@berkeley.edu",
      phone: "(213) 555-0176",
      source: LeadSource.CHATBOT,
      sourceDetail: "floor-plans-page chat",
      status: LeadStatus.NEW,
      score: 45,
      intent: "cold",
      preferredUnitType: "Shared 2-Bedroom",
      desiredMoveIn: daysFromNow(90),
      notes: "Freshman, still exploring options for next year.",
      createdAt: daysAgo(24),
      tourScheduledAt: null,
    },
    {
      externalId: "tc-seed-lead-08",
      firstName: "Tyler",
      lastName: "Reinhardt",
      email: "treinhardt@berkeley.edu",
      phone: "(707) 555-0121",
      source: LeadSource.DIRECT,
      sourceDetail: "walk-in",
      status: LeadStatus.CONTACTED,
      score: 55,
      intent: "warm",
      preferredUnitType: "Private 1-Bedroom",
      desiredMoveIn: daysFromNow(30),
      notes: "Stopped by the office asking about availability.",
      createdAt: daysAgo(28),
      tourScheduledAt: null,
    },
  ];

  const createdLeads: Record<string, string> = {};
  for (const l of leadSeeds) {
    const { externalId, tourScheduledAt: _ignored, ...rest } = l;
    const saved = await prisma.lead.upsert({
      where: {
        orgId_externalSystem_externalId: {
          orgId,
          externalSystem: "seed",
          externalId,
        },
      },
      update: {
        ...rest,
        orgId,
        propertyId,
        externalSystem: "seed",
        externalId,
        lastActivityAt: rest.createdAt,
        firstSeenAt: rest.createdAt,
      },
      create: {
        ...rest,
        orgId,
        propertyId,
        externalSystem: "seed",
        externalId,
        firstSeenAt: rest.createdAt,
        lastActivityAt: rest.createdAt,
      },
    });
    createdLeads[externalId] = saved.id;
  }

  // ---------------------------------------------------------------------------
  // 5. Visitors — ~20, UTMs, spread over 14 days, mixed identification
  // ---------------------------------------------------------------------------

  const visitorSeeds = [
    // Identified / converted (Cursive-sourced)
    {
      cursiveVisitorId: "tc-cv-001",
      externalId: "cursive_tc_001",
      status: VisitorIdentificationStatus.MATCHED_TO_LEAD,
      firstName: "Emma",
      lastName: "Nakamura",
      email: "emma.nakamura@berkeley.edu",
      utmSource: "google",
      utmMedium: "organic",
      firstSeenAt: daysAgo(3),
      sessionCount: 4,
      totalTimeSeconds: 720,
      intentScore: 78,
    },
    {
      cursiveVisitorId: "tc-cv-002",
      externalId: "cursive_tc_002",
      status: VisitorIdentificationStatus.IDENTIFIED,
      firstName: "Jamal",
      email: "jamal.whitfield@berkeley.edu",
      utmSource: "direct",
      utmMedium: "none",
      firstSeenAt: daysAgo(6),
      sessionCount: 3,
      totalTimeSeconds: 510,
      intentScore: 65,
    },
    {
      cursiveVisitorId: "tc-cv-003",
      externalId: "cursive_tc_003",
      status: VisitorIdentificationStatus.ENRICHED,
      firstName: "Priya",
      email: "priya.sharma@berkeley.edu",
      utmSource: "google",
      utmMedium: "organic",
      firstSeenAt: daysAgo(9),
      sessionCount: 6,
      totalTimeSeconds: 1240,
      intentScore: 88,
    },
    {
      cursiveVisitorId: "tc-cv-004",
      externalId: "cursive_tc_004",
      status: VisitorIdentificationStatus.IDENTIFIED,
      firstName: "Sofia",
      email: "sofia.chen@berkeley.edu",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "ig-story-fall-fill",
      firstSeenAt: daysAgo(12),
      sessionCount: 5,
      totalTimeSeconds: 930,
      intentScore: 82,
    },
    {
      cursiveVisitorId: "tc-cv-005",
      externalId: "cursive_tc_005",
      status: VisitorIdentificationStatus.IDENTIFIED,
      firstName: "Olivia",
      email: "olivia.park@berkeley.edu",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "berkeley-student-housing",
      firstSeenAt: daysAgo(1),
      sessionCount: 2,
      totalTimeSeconds: 340,
      intentScore: 58,
    },
    // Anonymous
    ...Array.from({ length: 15 }, (_, i) => ({
      cursiveVisitorId: null,
      externalId: `anon_tc_${String(i + 1).padStart(3, "0")}`,
      status: VisitorIdentificationStatus.ANONYMOUS,
      utmSource: ["google", "meta", "direct", "organic"][i % 4],
      utmMedium: ["organic", "paid_social", "none", "organic"][i % 4],
      utmCampaign: i % 4 === 1 ? "ig-story-fall-fill" : null,
      firstSeenAt: daysAgo(Math.floor(Math.random() * 14)),
      sessionCount: 1 + (i % 3),
      totalTimeSeconds: 60 + i * 12,
      intentScore: 5 + (i % 7) * 4,
    })),
  ];

  for (const v of visitorSeeds) {
    const { externalId, cursiveVisitorId, ...rest } = v as typeof v & {
      email?: string;
      firstName?: string;
      lastName?: string;
    };

    // Upsert via cursiveVisitorId (unique) when present, else visitorHash
    if (cursiveVisitorId) {
      await prisma.visitor.upsert({
        where: { cursiveVisitorId },
        update: {
          orgId,
          propertyId,
          ...rest,
          lastSeenAt: rest.firstSeenAt,
        },
        create: {
          orgId,
          propertyId,
          cursiveVisitorId,
          visitorHash: externalId,
          ...rest,
          lastSeenAt: rest.firstSeenAt,
        },
      });
    } else {
      // Use visitorHash for idempotency by querying first
      const existing = await prisma.visitor.findFirst({
        where: { orgId, visitorHash: externalId },
      });
      if (!existing) {
        await prisma.visitor.create({
          data: {
            orgId,
            propertyId,
            visitorHash: externalId,
            ...rest,
            lastSeenAt: rest.firstSeenAt,
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. ChatbotConversations — ~5, varied statuses, 2 linked to Leads
  // ---------------------------------------------------------------------------

  const conversationSeeds = [
    {
      sessionId: "tc-seed-chat-01",
      status: ChatbotConversationStatus.LEAD_CAPTURED,
      leadEmail: "jamal.whitfield@berkeley.edu",
      capturedName: "Jamal Whitfield",
      capturedEmail: "jamal.whitfield@berkeley.edu",
      pageUrl: "https://telegraphcommons.com/",
      createdAt: daysAgo(5),
      messages: [
        {
          role: "assistant",
          content:
            "Hey! Looking for student housing near UC Berkeley? I know Telegraph Commons inside and out — ask me about rooms, amenities, the neighborhood, or how to apply.",
          timestamp: daysAgo(5, 0).toISOString(),
        },
        {
          role: "user",
          content: "How far is it from campus?",
          timestamp: daysAgo(5, -0.1).toISOString(),
        },
        {
          role: "assistant",
          content:
            "It's a 3-minute walk to Sproul Plaza — two blocks. Walk Score is 99, so pretty much everything you need is right there.",
          timestamp: daysAgo(5, -0.15).toISOString(),
        },
        {
          role: "user",
          content: "Do the rooms come furnished?",
          timestamp: daysAgo(5, -0.2).toISOString(),
        },
        {
          role: "assistant",
          content:
            "Yes — every room is fully furnished with bed, desk, dresser, and closet. Google WiFi, cable, and daily janitorial are all included in rent.",
          timestamp: daysAgo(5, -0.22).toISOString(),
        },
        {
          role: "assistant",
          content:
            "I can send you our current floor plans and pricing — what's your email?",
          timestamp: daysAgo(5, -0.24).toISOString(),
        },
        {
          role: "user",
          content: "jamal.whitfield@berkeley.edu",
          timestamp: daysAgo(5, -0.26).toISOString(),
        },
      ],
    },
    {
      sessionId: "tc-seed-chat-02",
      status: ChatbotConversationStatus.LEAD_CAPTURED,
      leadEmail: "h.okafor@berkeley.edu",
      capturedName: "Hannah Okafor",
      capturedEmail: "h.okafor@berkeley.edu",
      pageUrl: "https://telegraphcommons.com/floor-plans",
      createdAt: daysAgo(24),
      messages: [
        {
          role: "assistant",
          content:
            "Hey! Looking for student housing near UC Berkeley? I know Telegraph Commons inside and out — ask me anything.",
          timestamp: daysAgo(24, 0).toISOString(),
        },
        {
          role: "user",
          content: "What's the difference between a 1-bed and a 2-bed?",
          timestamp: daysAgo(24, -0.1).toISOString(),
        },
        {
          role: "assistant",
          content:
            "Great question. A 1-bed is a fully private dorm — yours alone. A 2-bed is a shared suite with a roommate and per-bed pricing, which runs a bit cheaper. Both are fully furnished.",
          timestamp: daysAgo(24, -0.15).toISOString(),
        },
        {
          role: "user",
          content: "When's the earliest I could move in?",
          timestamp: daysAgo(24, -0.2).toISOString(),
        },
        {
          role: "assistant",
          content:
            "For fall, we typically have move-ins starting mid-August. I'd recommend checking the availabilities page or scheduling a tour for current options and pricing. Want me to grab your email so the leasing team can send specifics?",
          timestamp: daysAgo(24, -0.22).toISOString(),
        },
        {
          role: "user",
          content: "Sure, h.okafor@berkeley.edu",
          timestamp: daysAgo(24, -0.24).toISOString(),
        },
      ],
    },
    {
      sessionId: "tc-seed-chat-03",
      status: ChatbotConversationStatus.ACTIVE,
      pageUrl: "https://telegraphcommons.com/amenities",
      createdAt: daysAgo(1),
      messages: [
        {
          role: "assistant",
          content:
            "Hey! Looking for student housing near UC Berkeley? I know Telegraph Commons inside and out.",
          timestamp: daysAgo(1, 0).toISOString(),
        },
        {
          role: "user",
          content: "Is there a gym on site?",
          timestamp: daysAgo(1, -0.05).toISOString(),
        },
        {
          role: "assistant",
          content:
            "We don't have an in-building gym, but the RSF (UC Berkeley's rec center) is about a 5-minute walk. There are also a couple of independent gyms on Telegraph Ave.",
          timestamp: daysAgo(1, -0.1).toISOString(),
        },
      ],
    },
    {
      sessionId: "tc-seed-chat-04",
      status: ChatbotConversationStatus.ABANDONED,
      pageUrl: "https://telegraphcommons.com/location",
      createdAt: daysAgo(9),
      messages: [
        {
          role: "assistant",
          content:
            "Hey! Looking for student housing near UC Berkeley? Ask me anything.",
          timestamp: daysAgo(9, 0).toISOString(),
        },
        {
          role: "user",
          content: "How close is BART?",
          timestamp: daysAgo(9, -0.05).toISOString(),
        },
        {
          role: "assistant",
          content:
            "Downtown Berkeley BART is about a 10-minute walk. You're also right on the Berkeley shuttle line.",
          timestamp: daysAgo(9, -0.08).toISOString(),
        },
      ],
    },
    {
      sessionId: "tc-seed-chat-05",
      status: ChatbotConversationStatus.CLOSED,
      pageUrl: "https://telegraphcommons.com/parents",
      createdAt: daysAgo(17),
      messages: [
        {
          role: "assistant",
          content:
            "Hey! Looking for student housing near UC Berkeley? Happy to answer questions — including parent questions.",
          timestamp: daysAgo(17, 0).toISOString(),
        },
        {
          role: "user",
          content: "What safety features does the building have?",
          timestamp: daysAgo(17, -0.05).toISOString(),
        },
        {
          role: "assistant",
          content:
            "We have controlled access entry (keycard), onsite community managers, and well-lit common areas. Many parents feel good about it relative to scattered off-campus rentals.",
          timestamp: daysAgo(17, -0.1).toISOString(),
        },
        {
          role: "user",
          content: "Thanks.",
          timestamp: daysAgo(17, -0.15).toISOString(),
        },
      ],
    },
  ];

  for (const c of conversationSeeds) {
    const { sessionId, leadEmail, messages, createdAt, ...rest } = c as typeof c & {
      capturedName?: string;
      capturedEmail?: string;
      leadEmail?: string;
    };

    const leadId = leadEmail
      ? Object.entries(createdLeads).find(
          ([ext]) =>
            leadSeeds.find((l) => l.externalId === ext)?.email === leadEmail,
        )?.[1]
      : undefined;

    await prisma.chatbotConversation.upsert({
      where: { sessionId },
      update: {
        orgId,
        propertyId,
        leadId: leadId ?? null,
        ...rest,
        messages: messages as unknown as object,
        messageCount: messages.length,
        lastMessageAt: createdAt,
      },
      create: {
        orgId,
        propertyId,
        leadId: leadId ?? null,
        sessionId,
        ...rest,
        messages: messages as unknown as object,
        messageCount: messages.length,
        lastMessageAt: createdAt,
        createdAt,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 7. Tours — 2 linked to leads (one future, one completed)
  // ---------------------------------------------------------------------------

  const tourSeeds = [
    {
      externalId: "tc-seed-tour-01",
      leadExternalId: "tc-seed-lead-03", // Priya Sharma — tour scheduled
      status: TourStatus.SCHEDULED,
      tourType: "in_person",
      scheduledAt: daysFromNow(3),
      completedAt: null as Date | null,
      attendeeCount: 1,
      notes: "Requested quiet floor tour. Prefers north-facing unit.",
    },
    {
      externalId: "tc-seed-tour-02",
      leadExternalId: "tc-seed-lead-04", // Diego Morales — toured
      status: TourStatus.COMPLETED,
      tourType: "in_person",
      scheduledAt: daysAgo(4),
      completedAt: daysAgo(4),
      attendeeCount: 3,
      notes: "Came with two friends. Group is interested in the 3-bed suite.",
    },
  ];

  for (const t of tourSeeds) {
    const leadId = createdLeads[t.leadExternalId];
    if (!leadId) continue;

    await prisma.tour.upsert({
      where: {
        externalSystem_externalId: {
          externalSystem: "seed",
          externalId: t.externalId,
        },
      },
      update: {
        leadId,
        propertyId,
        status: t.status,
        tourType: t.tourType,
        scheduledAt: t.scheduledAt,
        completedAt: t.completedAt,
        attendeeCount: t.attendeeCount,
        notes: t.notes,
      },
      create: {
        leadId,
        propertyId,
        externalSystem: "seed",
        externalId: t.externalId,
        status: t.status,
        tourType: t.tourType,
        scheduledAt: t.scheduledAt,
        completedAt: t.completedAt,
        attendeeCount: t.attendeeCount,
        notes: t.notes,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // 8. CreativeRequest — 1 SUBMITTED
  // ---------------------------------------------------------------------------

  const creativeTitle = "Fall Fill Social Campaign — Community + Campus";
  const existingCreative = await prisma.creativeRequest.findFirst({
    where: { orgId, title: creativeTitle },
  });
  if (!existingCreative) {
    await prisma.creativeRequest.create({
      data: {
        orgId,
        propertyId,
        title: creativeTitle,
        description:
          "Student-targeted social ad showcasing community areas and proximity to campus.",
        format: CreativeFormat.INSTAGRAM_STORY,
        priority: "normal",
        status: CreativeRequestStatus.SUBMITTED,
        targetDate: daysFromNow(14),
        targetAudience:
          "UC Berkeley undergrads and transfers, ages 18-24, searching for fall housing.",
        copyIdeas:
          "Lean into '3 minutes to Sproul', show study lounge + community kitchen. Soft CTA to schedule a tour.",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Counts + summary
  // ---------------------------------------------------------------------------

  const [
    domainCount,
    siteConfigCount,
    listingCount,
    leadCount,
    visitorCount,
    conversationCount,
    tourCount,
    creativeCount,
  ] = await Promise.all([
    prisma.domainBinding.count({ where: { orgId } }),
    prisma.tenantSiteConfig.count({ where: { orgId } }),
    prisma.listing.count({ where: { propertyId } }),
    prisma.lead.count({ where: { orgId } }),
    prisma.visitor.count({ where: { orgId } }),
    prisma.chatbotConversation.count({ where: { orgId } }),
    prisma.tour.count({ where: { propertyId } }),
    prisma.creativeRequest.count({ where: { orgId } }),
  ]);

  console.log(`
Telegraph Commons demo-data seed complete.

Org:              ${org.name} (${ORG_SLUG})
Property:         ${property.name} (${property.id})

Counts in DB (scoped to this tenant):
  DomainBinding:        ${domainCount}   [apex: ${apex.hostname}, www: ${www.hostname}]
  TenantSiteConfig:     ${siteConfigCount}
  Listing:              ${listingCount}
  Lead:                 ${leadCount}
  Visitor:              ${visitorCount}
  ChatbotConversation:  ${conversationCount}
  Tour:                 ${tourCount}
  CreativeRequest:      ${creativeCount}
`);
}

main()
  .catch((e) => {
    console.error("Telegraph Commons seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
