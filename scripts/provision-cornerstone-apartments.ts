/**
 * scripts/provision-cornerstone-apartments.ts
 *
 * Cornerstone Apartments onboarding (Norman Gensinger's own two Denver
 * properties, separate from his existing Telegraph Commons/SG Real Estate
 * client). Org was created via /admin/clients/new (slug "cornerstone",
 * id cmrcenw7q000104lergcye9yz) — Clerk org provisioning failed ("Forbidden")
 * so the org sits AT_RISK with no clerkOrgId; that's a separate infra issue,
 * unrelated to this script, and doesn't block DB-only setup since no real
 * user is being invited yet.
 *
 * This script:
 *   1. Creates both Property rows (full address + unit counts from Norman's
 *      2026-07-07 email — NOT from the scraped site, which only lists
 *      currently-available units).
 *   2. Flips moduleAttribution / moduleInsights / moduleMarketIntelligence —
 *      the actual "Data Analytics Suite" gates (confirmed by grepping their
 *      requireModule() call sites); these aren't reachable from the
 *      new-client-form module list.
 *   3. Upserts a PropertyKnowledgeBase row per property from facts scraped
 *      off cornerstoneapartments.com on 2026-07-08. Anything not published
 *      on the site is left null — no invented pricing (this is the exact
 *      hallucination bug the KB model exists to prevent).
 *   4. Enables the chatbot + sets an org-level persona/greeting on
 *      TenantSiteConfig (lib/chatbot/resolve-config.ts is the merge layer).
 *   5. Overrides greeting/teaser/phone/CTA-link per property via
 *      PropertyChatbotConfig — the real leasing-office numbers + a link to
 *      each building's actual page. chatbotKnowledgeBase (legacy free-text)
 *      is deliberately left null on both layers — step 3's structured KB is
 *      what grounds the bot now.
 *
 * Default DRY RUN. Pass --apply to persist.
 * Usage:
 *   pnpm exec tsx --env-file=.env.production.local \
 *     scripts/provision-cornerstone-apartments.ts [--apply]
 *
 * Safe to re-run (property lookup by orgId+slug, KB upsert by propertyId).
 */

import { prisma } from "../lib/db";

const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;

const ORG_ID = "cmrcenw7q000104lergcye9yz";
const ORG_SLUG = "cornerstone";

const log = {
  info: (msg: string) => console.log(`[cornerstone] ${msg}`),
  section: (title: string) => console.log(`\n[cornerstone] === ${title} ===`),
  change: (msg: string) =>
    console.log(`[cornerstone]   ${DRY_RUN ? "WOULD" : "DID "} ${msg}`),
  ok: (msg: string) => console.log(`[cornerstone]   ok  ${msg}`),
};

// ---------------------------------------------------------------------------
// Properties (Norman's 2026-07-07 email — verbatim addresses/unit counts)
// ---------------------------------------------------------------------------

type PropertySeed = {
  slug: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  totalUnits: number;
  websiteUrl: string;
  phoneNumber: string;
  chatbotGreeting: string;
  chatbotTeaserText: string;
};

const PROPERTIES: PropertySeed[] = [
  {
    slug: "quad-on-emerson",
    name: "Quad on Emerson",
    addressLine1: "10 S Emerson St",
    city: "Denver",
    state: "CO",
    postalCode: "80209",
    totalUnits: 34,
    websiteUrl: "https://cornerstoneapartments.com/our-buildings/quad-on-emerson/",
    phoneNumber: "(720) 727-6644",
    chatbotGreeting:
      "Hi! Looking for a place at Quad on Emerson in Washington Park? I can help with floor plans, pricing, pet policy, or scheduling a tour — and we currently have a $500 Look and Lease special for anyone who applies within 48 hours of touring.",
    chatbotTeaserText: "Ask about our $500 Look and Lease special",
  },
  {
    slug: "ogden-park-townhomes",
    name: "Ogden Park Townhomes",
    addressLine1: "964 N Ogden St",
    city: "Denver",
    state: "CO",
    postalCode: "80218",
    totalUnits: 14,
    websiteUrl: "https://cornerstoneapartments.com/our-buildings/ogden-park-townhomes/",
    phoneNumber: "(720) 806-5842",
    chatbotGreeting:
      "Hi! Looking for a place at Ogden Park Townhomes near Cheesman Park? I can help with floor plans, pricing, pet policy, parking, or scheduling a tour.",
    chatbotTeaserText: "Questions about Ogden Park Townhomes? Chat with us!",
  },
];

// ---------------------------------------------------------------------------
// Chatbot config. Org-level TenantSiteConfig is the default persona/greeting;
// PropertyChatbotConfig overrides only the fields that genuinely differ per
// building (greeting, teaser, phone, CTA link) — everything else inherits per
// lib/chatbot/resolve-config.ts. chatbotKnowledgeBase (legacy free-text) is
// deliberately left null on both layers — the structured PropertyKnowledgeBase
// model (step 3) is what actually grounds the bot; the free-text field is the
// old hallucination-prone path the KB model replaced.
// ---------------------------------------------------------------------------

// Supplementary free-text note (chatbotKnowledgeBase). This is ADDITIVE to
// the structured PROPERTY FACTS block, not a replacement for it — the
// structured KB (step 3) is what actually grounds floor plans/pricing/
// policies. This note only covers what the structured schema has no field
// for: that Cornerstone operates two Denver properties and the bot should
// offer a cross-referral. Set identically on the org AND both property
// overrides (Adam's explicit call) — NOTE: PropertyChatbotConfig.chatbotKnowledgeBase
// REPLACES the org value when set (lib/chatbot/resolve-config.ts `pick()`
// takes property-or-org, not both) — it does not merge with it. Setting the
// same text in all three keeps every layer aligned regardless of which one
// resolves.
const CROSS_PROPERTY_NOTE =
  "Cornerstone Apartments manages two Denver properties: Quad on Emerson in Washington Park and Ogden Park Townhomes near Cheesman Park. If a visitor asks about the other property or seems open to either neighborhood, mention it and offer to connect them with that leasing team.";

const ORG_CHATBOT_CONFIG = {
  chatbotEnabled: true,
  chatbotPersonaName: "Cornerstone Assistant",
  chatbotGreeting:
    "Hi! I'm here to help you find your next home at Cornerstone Apartments. Ask me about floor plans, pricing, availability, pet policy, or anything else.",
  chatbotFollowUpMessage:
    "We have {open_count} homes available right now starting at {starting_rent}. What matters most to you in your next place?",
  chatbotTeaserText: "Questions about Cornerstone Apartments? Chat with us!",
  chatbotKnowledgeBase: CROSS_PROPERTY_NOTE,
};

// ---------------------------------------------------------------------------
// Analytics module flags. Originally turned ON (they're the literal
// "Data Analytics Suite" gates from the proposal: app/portal/attribution,
// /reverse-attribution, /insights, /briefing, /reports/portfolio, and the
// Market Intelligence RentCast comparables section on the property page).
// Adam corrected this 2026-07-08 after seeing the Market Intelligence panel
// rendered live: Cornerstone only cares about chatbot + leads + SEO — turn
// OFF all three. He'd already turned them off manually once (audit log,
// 18:31) before this script's second run silently re-enabled them; this is
// the actual final scope.
// ---------------------------------------------------------------------------

const ANALYTICS_MODULES = {
  moduleAttribution: false,
  moduleInsights: false,
  moduleMarketIntelligence: false,
} as const;

// ---------------------------------------------------------------------------
// Knowledge base facts — scraped from cornerstoneapartments.com 2026-07-08.
// Only published facts. Nulls left null on purpose.
// ---------------------------------------------------------------------------

const KB_BY_SLUG: Record<string, Record<string, unknown>> = {
  "quad-on-emerson": {
    floorPlans: [
      {
        type: "1 Bedroom",
        bedrooms: 1,
        bathrooms: 1,
        squareFeet: 435,
        priceMinCents: 106000,
        priceMaxCents: 159500,
        notes:
          "435-440 sqft depending on unit. Rent varies $1,060-$1,595/mo by unit and lease term.",
      },
    ],
    communityAmenities: [
      "Courtyard with grill and fire pit",
      "On-site laundry",
      "Exterior bike storage",
      "Amazon Locker",
      "Controlled entry/access",
      "Smoke-free building",
      "Recycling program",
    ],
    unitAmenities: [
      "Air conditioning",
      "Dishwasher",
      "Stainless steel appliances",
      "Vinyl plank flooring",
      "Quartz countertops with tile backsplash",
      "Designer tile bathroom tub",
      "Reserved parking (subject to availability)",
    ],
    petPolicy:
      "Cats and dogs allowed. $300 refundable pet deposit per unit, plus $35/month pet rent per pet.",
    parkingInfo:
      "Reserved parking included, subject to availability. Uncovered parking available for $50/month. Storage available for $20/month.",
    laundryInfo: "On-site laundry facility (not in-unit).",
    utilitiesIncluded:
      "Billed by a third-party company based on usage, plus Xcel Energy for electric. Water/sewer breakdown and trash/recycling costs not published.",
    smokingPolicy: "Smoke-free building.",
    leaseTerms: "6, 10, 11, or 12-month lease terms available.",
    depositInfo:
      "Security deposit $800 (refundable, 1BR). Application fee $50 (non-refundable). Holding fee $165 (refundable if declined; applied to admin fee if approved). Move-in requires certified funds (cashier's check or money order).",
    currentSpecials:
      "$500 Look and Lease — apply within 48 hours of touring. (Confirm still active before quoting — scraped 2026-07-08.)",
    applicationProcess:
      "Apply online. Tours: in person, live video, or self-guided (self-guided limited to the model unit; floor plan/finishes may vary). Max 3 tour requests per applicant.",
    applicationRequirements:
      "Gross income must be 2x monthly rent (combined 2x for roommates). Income verification from the last 2 months required. Cosigner required if income doesn't qualify (must earn 5x rent/month). Delinquent debt: $0-99 approved; $100-2,499 needs 1 month deposit; $2,500-5,000 needs 1 month deposit + cosigner; $5,000+ declined. Disqualifiers: eviction in last 7 years, violent misdemeanor in last 5 years, felony in last 7 years, sex offender registry. Portable Tenant Screening Reports (PTSR, <=30 days old) accepted with no application fee. Residential Inspection License 2023-BFN-0001854.",
    neighborhoodInfo:
      "Washington Park neighborhood. Near the Cherry Creek hike/bike path and Shopping Center, Alamo Placita and Hungarian Freedom Park, and South Broadway's restaurant/bar scene (Ogden Theater, Sputnik, Punch Bowl Social, Antique Row). 2.5-mile trail and dog parks nearby.",
    transitInfo: null,
    tourInfo:
      "Tours: in-person, live video, or self-guided (model unit only). Max 3 tour requests per applicant. Leasing office: (720) 727-6644.",
    additionalNotes:
      "Not published on site: water/sewer breakdown, trash/recycling costs, WiFi availability, fitness center/other rec amenities, guest parking policy, lease renewal terms, early termination fees, move-in specials beyond the Look & Lease promo.",
  },
  "ogden-park-townhomes": {
    floorPlans: [
      {
        type: "Studio",
        bedrooms: 0,
        bathrooms: 1,
        squareFeet: 535,
        priceMinCents: 162500,
        priceMaxCents: 167000,
        notes: "Pricing varies by move-in date range; rates subject to change.",
      },
      {
        type: "1 Bedroom",
        bedrooms: 1,
        bathrooms: 1,
        squareFeet: 515,
        priceMinCents: 168000,
        priceMaxCents: 175500,
        notes:
          "515-585 sqft depending on unit. Pricing varies by move-in date range; rates subject to change.",
      },
    ],
    communityAmenities: [
      "On-site laundry facilities",
      "Reserved parking (subject to availability)",
    ],
    unitAmenities: [
      "Stainless steel appliances",
      "Wood-style flooring",
      "Dishwasher",
      "Private patios (select units)",
      "Additional storage (select units)",
    ],
    petPolicy:
      "Cats and dogs allowed. $300 refundable pet deposit per unit, plus $35/month pet rent per pet.",
    parkingInfo:
      "Uncovered parking $75/month (subject to availability). Garage parking $125/month (subject to availability).",
    laundryInfo: "On-site laundry facilities (not in-unit).",
    utilitiesIncluded:
      "Billed by a third-party company based on usage, plus Xcel Energy for electric.",
    smokingPolicy: null,
    leaseTerms: null,
    depositInfo:
      "Studio deposit $700 (refundable). 1-bedroom deposit $800 (refundable). Application fee $50 (non-refundable). Holding fee $165 (applied to admin fee if approved, refunded if declined). Certified funds required for move-in costs.",
    currentSpecials: null,
    applicationProcess:
      "Apply online through the SecureCafe portal. Tours: in person, live video, or self-guided (model unit photos; floor plan/finishes may vary — some units are occupied and tourable only on specified future dates).",
    applicationRequirements:
      "Gross income must be 2x monthly rent. Income verification from the last 2 months required. If not financially qualified, a guarantor earning 5x rent/month is needed. Delinquent debt thresholds determine approval, deposit increases, or cosigner requirement. Disqualifiers: eviction in last 7 years, violent misdemeanor in last 5 years, felony in last 7 years, sex offender registry.",
    neighborhoodInfo:
      "Cheesman Park neighborhood. Near Cheesman Park, restaurants Potager and 3 Kilts Tavern, Colfax Avenue, Denver Botanic Gardens, running/biking trails, and Liks Ice Cream.",
    transitInfo: null,
    tourInfo:
      "Tours: in-person, live video, or self-guided. Some units are currently occupied and become tourable on specified future dates. Leasing office: (720) 806-5842.",
    additionalNotes:
      "Not published on site: smoking policy, lease term length options, specific transit info, current promotions/specials.",
  },
};

async function main() {
  log.info(
    `starting (${DRY_RUN ? "DRY RUN — pass --apply to persist" : "APPLY MODE — writes enabled"})`,
  );

  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true, slug: true },
  });
  if (!org || org.slug !== ORG_SLUG) {
    throw new Error(
      `Org mismatch: expected id=${ORG_ID} slug=${ORG_SLUG}, got ${JSON.stringify(org)}`,
    );
  }
  log.ok(`found org "${org.name}" (slug=${org.slug})`);

  // -----------------------------------------------------------------
  // 1) Properties
  // -----------------------------------------------------------------
  log.section("properties");
  const propertyIds: Record<string, string> = {};

  for (const p of PROPERTIES) {
    const existing = await prisma.property.findFirst({
      where: { orgId: ORG_ID, slug: p.slug },
      select: { id: true },
    });
    if (existing) {
      log.ok(`"${p.name}" already exists (id=${existing.id}) — skipping create`);
      propertyIds[p.slug] = existing.id;
      continue;
    }

    log.change(
      `create property "${p.name}" (${p.addressLine1}, ${p.city} ${p.state} ${p.postalCode}, ${p.totalUnits} units)`,
    );
    if (APPLY) {
      const created = await prisma.property.create({
        data: {
          orgId: ORG_ID,
          name: p.name,
          slug: p.slug,
          propertyType: "RESIDENTIAL",
          residentialSubtype: "MULTIFAMILY",
          addressLine1: p.addressLine1,
          city: p.city,
          state: p.state,
          postalCode: p.postalCode,
          country: "US",
          totalUnits: p.totalUnits,
          websiteUrl: p.websiteUrl,
          lifecycle: "ACTIVE",
          lifecycleSetBy: "OPERATOR",
          lifecycleSetAt: new Date(),
          launchStatus: "ONBOARDING",
          launchStatusSetBy: "OPERATOR",
          launchStatusSetAt: new Date(),
        },
        select: { id: true },
      });
      propertyIds[p.slug] = created.id;
      log.ok(`created (id=${created.id})`);
    }
  }

  // -----------------------------------------------------------------
  // 2) Analytics modules
  // -----------------------------------------------------------------
  log.section("analytics modules");
  const current = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: {
      moduleAttribution: true,
      moduleInsights: true,
      moduleMarketIntelligence: true,
    },
  });
  const changes = Object.entries(ANALYTICS_MODULES).filter(
    ([k, v]) => (current as Record<string, unknown>)?.[k] !== v,
  );
  if (changes.length === 0) {
    log.ok("all analytics module flags already set");
  } else {
    for (const [k, v] of changes) log.change(`set ${k} -> ${v}`);
    if (APPLY) {
      await prisma.organization.update({
        where: { id: ORG_ID },
        data: ANALYTICS_MODULES,
      });
      log.ok(`persisted ${changes.length} module flag change(s)`);
    }
  }

  // -----------------------------------------------------------------
  // 3) Knowledge base
  // -----------------------------------------------------------------
  log.section("knowledge base");
  for (const p of PROPERTIES) {
    const propertyId = propertyIds[p.slug];
    if (!propertyId) {
      log.info(`  skip KB for "${p.name}" — property id unknown (dry run, not yet created)`);
      continue;
    }
    const data = KB_BY_SLUG[p.slug];
    log.change(`upsert PropertyKnowledgeBase for "${p.name}" (propertyId=${propertyId})`);
    if (APPLY) {
      const kb = await prisma.propertyKnowledgeBase.upsert({
        where: { propertyId },
        update: data,
        create: { ...data, propertyId, orgId: ORG_ID },
      });
      log.ok(`upserted (kb id=${kb.id}, floorPlans=${(data.floorPlans as unknown[]).length})`);
    }
  }

  // -----------------------------------------------------------------
  // 4) Org-level chatbot config (TenantSiteConfig)
  // -----------------------------------------------------------------
  log.section("org chatbot config");
  log.change(
    `upsert TenantSiteConfig chatbot fields (persona="${ORG_CHATBOT_CONFIG.chatbotPersonaName}", enabled=${ORG_CHATBOT_CONFIG.chatbotEnabled})`,
  );
  if (APPLY) {
    const config = await prisma.tenantSiteConfig.upsert({
      where: { orgId: ORG_ID },
      update: ORG_CHATBOT_CONFIG,
      create: { ...ORG_CHATBOT_CONFIG, orgId: ORG_ID },
    });
    log.ok(`upserted TenantSiteConfig (id=${config.id})`);
  }

  // -----------------------------------------------------------------
  // 5) Per-property chatbot config (PropertyChatbotConfig) — only the
  // fields that genuinely differ per building. Everything else inherits
  // the org config above via lib/chatbot/resolve-config.ts.
  // -----------------------------------------------------------------
  log.section("per-property chatbot config");
  for (const p of PROPERTIES) {
    const propertyId = propertyIds[p.slug];
    if (!propertyId) {
      log.info(`  skip chatbot config for "${p.name}" — property id unknown (dry run, not yet created)`);
      continue;
    }
    const data = {
      chatbotGreeting: p.chatbotGreeting,
      chatbotTeaserText: p.chatbotTeaserText,
      phoneNumber: p.phoneNumber,
      primaryCtaUrl: p.websiteUrl,
      chatbotKnowledgeBase: CROSS_PROPERTY_NOTE,
    };
    log.change(
      `upsert PropertyChatbotConfig for "${p.name}" (phone=${p.phoneNumber}, ctaUrl=${p.websiteUrl})`,
    );
    if (APPLY) {
      const config = await prisma.propertyChatbotConfig.upsert({
        where: { propertyId },
        update: data,
        create: { ...data, propertyId, orgId: ORG_ID },
      });
      log.ok(`upserted (id=${config.id})`);
    }
  }

  log.section("done");
  log.info(DRY_RUN ? "DRY RUN — re-run with --apply to persist." : "APPLY mode complete.");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[cornerstone] fatal:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
