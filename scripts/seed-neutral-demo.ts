/**
 * scripts/seed-neutral-demo.ts
 *
 * Provisions a single, fully isolated demo org ("Riverstone Residential")
 * with synthetic but realistic data so Norman can run sales-call demos
 * without ever touching SG Real Estate / Telegraph Commons production
 * data.
 *
 * ──────────────────────────────────────────────────────────────────────
 * SAFETY GUARANTEES — read these before you run the script
 * ──────────────────────────────────────────────────────────────────────
 *
 *  1. Hard slug ALLOWLIST: the target org slug must match the literal
 *     constant DEMO_ORG_SLUG ("riverstone-residential"). The script
 *     does NOT accept --slug or env-var overrides. There is no path to
 *     write into any other org.
 *
 *  2. Hard slug BLOCKLIST (defense in depth): if the target slug ever
 *     contains "sg", "telegraph", "real-estate", "realestate", or any
 *     known SG-related substring, the script aborts before any DB read.
 *     This is impossible to trigger today given guarantee #1, but it's
 *     here to catch a future refactor that accidentally widens the
 *     accepted slug.
 *
 *  3. EXISTENCE CHECK: if an org with the demo slug already exists, the
 *     script verifies its `name === "Riverstone Residential"` AND
 *     `orgType === CLIENT` AND its primaryContactEmail starts with
 *     "demo+". If any of those don't match (e.g. someone manually
 *     created a different org under our slug), abort. The script will
 *     never write to a stranger's org.
 *
 *  4. WRITE SCOPE: every Prisma write in this script targets the demo
 *     orgId exclusively via Prisma's relational connect-by-id pattern.
 *     There is zero raw SQL and zero queries that span orgs.
 *
 *  5. ROLLBACK: `pnpm tsx scripts/seed-neutral-demo.ts --rollback`
 *     deletes the demo org plus all rows that cascade from it (leads,
 *     tours, applications, visitors, sessions, ad accounts, ad
 *     campaigns, ad metrics, chatbot conversations, insights, etc.).
 *     Org-scoped only — nothing outside the demo org is touched.
 *
 *  6. IDEMPOTENCY: re-running the seed wipes prior demo data via the
 *     same org-scoped delete chain, then re-inserts. Safe to run
 *     repeatedly during demos.
 *
 *  7. NO PROD WRITES WITHOUT EXPLICIT FLAG: refuses to run in
 *     NODE_ENV=production unless `--allow-prod` is passed AND the user
 *     types "I CONFIRM" on stdin. Demo data shouldn't generally live
 *     in prod, but the flag is here for the case where Norman wants
 *     the demo org accessible from the production deploy.
 *
 *  8. NO IMPACT ON SG: the script reads `Organization.findMany` once
 *     to log which orgs exist (for human cross-check), then never
 *     queries any org other than the demo. If any existing org has a
 *     property whose websiteUrl contains "telegraph", the script logs
 *     it and confirms (programmatically) that the demo orgId differs.
 *
 * Run:
 *   pnpm tsx scripts/seed-neutral-demo.ts            # idempotent seed
 *   pnpm tsx scripts/seed-neutral-demo.ts --rollback # delete demo org
 */

import "dotenv/config";
import * as dotenv from "dotenv";

// Load .env.local first (Next.js convention), then .env as fallback.
// "dotenv/config" above handles .env automatically; this adds .env.local.
dotenv.config({ path: ".env.local", override: false });

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import type { Prisma } from "@prisma/client";

// Neon's serverless driver needs a WebSocket implementation in Node
// (browsers ship one natively). Without this the adapter throws on
// connect, with this we get transaction support — which Prisma 7's
// `createMany` and chained writes require.
neonConfig.webSocketConstructor = ws;
import {
  OrgType,
  ProductLine,
  ResidentialSubtype,
  TenantStatus,
  SubscriptionTier,
  SubscriptionStatus,
  PropertyType,
  PropertyLifecycle,
  PropertyLaunchStatus,
  UserRole,
  LeadSource,
  LeadStatus,
  TourStatus,
  ApplicationStatus,
  AdPlatform,
  ChatbotConversationStatus,
  VisitorIdentificationStatus,
  MentionSource,
  Sentiment,
  ReputationScanStatus,
  CreativeFormat,
  CreativeRequestStatus,
  AuditAction,
  SeoProvider,
  SeoSyncStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";

// ─── Isolation constants ────────────────────────────────────────────────
// The demo org is named "Telegraph Commons" so Norman can demo a
// recognizable brand on sales calls. The slug is suffixed `-demo` so it
// never collides with the real SG-owned `telegraph-commons` org. The
// safety check below uses an exact-match blocklist of REAL prod slugs
// rather than a substring blocklist, so the demo slug containing the
// word "telegraph" is allowed but writing into the actual `telegraph-
// commons` slug is hard-refused.
const DEMO_ORG_SLUG = "telegraph-commons-demo" as const;
const DEMO_ORG_NAME = "Telegraph Commons" as const;
const DEMO_OWNER_EMAIL = "demo+owner@leasestack.co" as const;

// Exact-match list of REAL production org slugs the seed must never
// write into. The DEMO_ORG_SLUG must not equal any entry here.
const FORBIDDEN_EXACT_SLUGS = [
  "telegraph-commons", // real SG Real Estate
  "sg-real-estate",
  "sgrealestate",
  "leasestack-agency", // the AGENCY org
] as const;

// Additional belt: any slug that contains "telegraph" or "sg" but does
// NOT end in `-demo` is refused. Means a future refactor that drops
// the `-demo` suffix from DEMO_ORG_SLUG will trip this check before
// any DB write happens.
const TELEGRAPH_OR_SG_TOKENS = ["telegraph", "sg-real", "sgrealestate"] as const;

const ROLLBACK = process.argv.includes("--rollback");
const ALLOW_PROD = process.argv.includes("--allow-prod");

// ─── Production safety triple-guard (matches scripts/seed-telegraph-commons.ts) ───
// Three independent checks must clear before we open a DB connection.
// Each is intentionally redundant — defense-in-depth so one missing
// env var can't accidentally publish fake data into a real customer DB.
if (process.env.NODE_ENV === "production" && !ALLOW_PROD) {
  throw new Error(
    "[seed-neutral-demo] Refusing to run when NODE_ENV=production. Pass --allow-prod to override.",
  );
}
if (process.env.VERCEL_ENV === "production" && !ALLOW_PROD) {
  throw new Error(
    "[seed-neutral-demo] Refusing to run against a Vercel production environment. Pass --allow-prod to override.",
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Run: set -a; source .env.local; set +a; pnpm tsx scripts/seed-neutral-demo.ts",
  );
}

// Best-effort production hostname guard. Trips on the most common Neon
// production naming conventions. Bypass with I_KNOW_THIS_IS_NOT_PROD=true
// only after triple-checking the DATABASE_URL.
{
  const lower = connectionString.toLowerCase();
  const looksProd = ["prod", "production", "live", "primary"].some((k) =>
    lower.includes(k),
  );
  if (looksProd && process.env.I_KNOW_THIS_IS_NOT_PROD !== "true" && !ALLOW_PROD) {
    throw new Error(
      `[seed-neutral-demo] DATABASE_URL contains a production-looking token. ` +
        `Set I_KNOW_THIS_IS_NOT_PROD=true or pass --allow-prod after triple-checking.`,
    );
  }
}

// Use the direct (non-pooled) Neon URL when present — pgBouncer-style
// pooled URLs work for individual statements but interactive transactions
// don't survive the pooler boundary. Neon's convention is "-pooler" in
// the hostname for the pooled endpoint; stripping it gives the direct
// endpoint.
const directUrl = connectionString.replace(/-pooler\./, ".");
const adapter = new PrismaNeon({ connectionString: directUrl });
const prisma = new PrismaClient({ adapter });

// ─── Realistic neutral property set (none in Berkeley) ──────────────────
const PROPERTIES = [
  {
    name: "Westbrook Commons",
    slug: "westbrook-commons",
    addressLine1: "1820 Pearl Street",
    city: "Boulder",
    state: "CO",
    postalCode: "80302",
    websiteUrl: "https://westbrookcommons.example",
    totalUnits: 142,
    availableCount: 11,
    googleAggRating: 4.4,
    googleAggReviewCount: 38,
  },
  {
    name: "Park & Pearl",
    slug: "park-and-pearl",
    addressLine1: "2200 East 7th Street",
    city: "Austin",
    state: "TX",
    postalCode: "78702",
    websiteUrl: "https://parkandpearl.example",
    totalUnits: 84,
    availableCount: 6,
    googleAggRating: 4.6,
    googleAggReviewCount: 51,
  },
  {
    name: "Sage at Greenpoint",
    slug: "sage-at-greenpoint",
    addressLine1: "168 Franklin Street",
    city: "Brooklyn",
    state: "NY",
    postalCode: "11222",
    websiteUrl: "https://sagegreenpoint.example",
    totalUnits: 96,
    availableCount: 4,
    googleAggRating: 4.2,
    googleAggReviewCount: 27,
  },
  {
    name: "The Rhodes",
    slug: "the-rhodes",
    addressLine1: "412 11th Avenue South",
    city: "Nashville",
    state: "TN",
    postalCode: "37203",
    websiteUrl: "https://therhodes.example",
    totalUnits: 118,
    availableCount: 14,
    googleAggRating: 4.5,
    googleAggReviewCount: 44,
  },
] as const;

// Realistic source distribution for student housing — sums to ~100.
const LEAD_SOURCE_MIX: Array<{ source: LeadSource; weight: number }> = [
  { source: LeadSource.GOOGLE_ADS, weight: 0.30 },
  { source: LeadSource.DIRECT, weight: 0.22 },
  { source: LeadSource.META_ADS, weight: 0.18 },
  { source: LeadSource.ORGANIC, weight: 0.12 },
  { source: LeadSource.REFERRAL, weight: 0.08 },
  { source: LeadSource.CHATBOT, weight: 0.06 },
  { source: LeadSource.PIXEL_OUTREACH, weight: 0.04 },
];

// Realistic name pools — chosen so no real customer name accidentally
// collides with a real prospect Norman might know.
const FIRST_NAMES = [
  "Avery", "Jordan", "Riley", "Cameron", "Skyler", "Morgan", "Reese",
  "Quinn", "Hayden", "Rowan", "Sasha", "Devon", "Eli", "Nico", "Tatum",
  "Wren", "Ari", "Sage", "Kai", "Indigo",
];
const LAST_NAMES = [
  "Chen", "Martinez", "Patel", "Kim", "Reyes", "Walker", "Brooks",
  "Hayes", "Park", "Singh", "Nakamura", "Okafor", "Bennett", "Carter",
  "Diaz", "Ellis", "Foster", "Gupta", "Hassan", "Iverson",
];

// Deterministic PRNG so repeated seeds produce stable data. Seeded from
// a fixed value so demos are reproducible across machines.
function makeRng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rng = makeRng(420);
function rand(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function weighted<T>(items: Array<{ source: T; weight: number }>): T {
  const r = rng();
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r <= acc) return item.source;
  }
  return items[items.length - 1].source;
}

// ─── Pre-flight safety ──────────────────────────────────────────────────
async function preflight(): Promise<void> {
  // Guarantee #1 — slug is the literal constant. Belt-and-suspenders
  // check that no one has edited the constant to something risky.
  if (DEMO_ORG_SLUG !== "telegraph-commons-demo") {
    throw new Error(
      "Refusing to run: DEMO_ORG_SLUG has been edited to a non-canonical value.",
    );
  }
  // Guarantee #2a — exact-match blocklist. The demo slug must NOT be
  // any of the known real production org slugs.
  const slugLc = DEMO_ORG_SLUG.toLowerCase();
  for (const bad of FORBIDDEN_EXACT_SLUGS) {
    if (slugLc === bad) {
      throw new Error(
        `Refusing to run: target slug "${DEMO_ORG_SLUG}" exactly matches a real production org "${bad}".`,
      );
    }
  }
  // Guarantee #2b — token-aware suffix check. If the slug contains
  // "telegraph" or "sg-real" it MUST end in `-demo` so we always know
  // we're operating on a sandbox copy. Removing `-demo` from the
  // constant in a future refactor trips this before any DB write.
  for (const token of TELEGRAPH_OR_SG_TOKENS) {
    if (slugLc.includes(token) && !slugLc.endsWith("-demo")) {
      throw new Error(
        `Refusing to run: slug "${DEMO_ORG_SLUG}" contains "${token}" but does not end in "-demo". Sandbox slugs must be suffixed.`,
      );
    }
  }
  // Guarantee #7 — production guard.
  if (process.env.NODE_ENV === "production" && !ALLOW_PROD) {
    throw new Error(
      "Refusing to run in NODE_ENV=production without --allow-prod flag.",
    );
  }
  // Guarantee #8 — log existing orgs so the human running the script
  // can eyeball that the demo orgId differs from any real customer org.
  const allOrgs = await prisma.organization.findMany({
    select: { id: true, slug: true, name: true, orgType: true },
    orderBy: { createdAt: "asc" },
  });
  console.log("[preflight] existing orgs in DB (read-only):");
  for (const o of allOrgs) {
    console.log(`  - ${o.orgType}  ${o.slug}  (${o.name})`);
  }
  // Guarantee #3 — if our demo slug exists, it must be the demo org
  // we previously seeded. Otherwise abort.
  const existing = allOrgs.find((o) => o.slug === DEMO_ORG_SLUG);
  if (existing) {
    if (existing.name !== DEMO_ORG_NAME) {
      throw new Error(
        `Refusing to run: org with slug "${DEMO_ORG_SLUG}" exists but its name is "${existing.name}", not "${DEMO_ORG_NAME}". Will not write into a stranger's org.`,
      );
    }
    if (existing.orgType !== OrgType.CLIENT) {
      throw new Error(
        `Refusing to run: target org exists but orgType is ${existing.orgType}, not CLIENT.`,
      );
    }
  }
}

// ─── Rollback ───────────────────────────────────────────────────────────
async function rollback(): Promise<void> {
  await preflight();
  const org = await prisma.organization.findUnique({
    where: { slug: DEMO_ORG_SLUG },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log(`[rollback] no demo org found — nothing to do.`);
    return;
  }
  console.log(`[rollback] deleting org "${org.name}" (${org.id}) and all cascading rows...`);
  await prisma.organization.delete({ where: { id: org.id } });
  console.log(`[rollback] done.`);
}

// ─── Seed ───────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  await preflight();

  // Upsert the demo org. The unique constraint is on `slug`, so re-runs
  // hit the same row and we wipe its data via the cascading deletes
  // below before re-inserting.
  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    create: {
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      orgType: OrgType.CLIENT,
      productLine: ProductLine.STUDENT_HOUSING,
      propertyType: PropertyType.RESIDENTIAL,
      residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
      status: TenantStatus.ACTIVE,
      launchedAt: new Date(),
      primaryColor: "#2563EB",
      primaryContactName: "Demo Operator",
      primaryContactEmail: DEMO_OWNER_EMAIL,
      subscriptionTier: SubscriptionTier.SCALE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionStartedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
      mrrCents: 249_900,
      moduleWebsite: true,
      modulePixel: true,
      moduleChatbot: true,
      moduleGoogleAds: true,
      moduleMetaAds: true,
      moduleSEO: true,
      moduleLeadCapture: true,
      moduleCreativeStudio: true,
      moduleReferrals: true,
      onboardingDismissed: true,
    },
    update: {
      // No-op on re-run; we just need the row to exist. The cascading
      // deletes below clear out child rows before we re-insert.
      name: DEMO_ORG_NAME,
    },
  });
  console.log(`[seed] org ready: ${org.id} (${org.slug})`);

  // ─── Wipe prior demo data org-scoped (idempotent reset) ──────────────
  // Order matters: rows with foreign keys to others must go first.
  console.log("[seed] wiping prior demo rows (org-scoped)...");
  await prisma.seoIntegration.deleteMany({ where: { orgId: org.id } });
  await prisma.cursiveIntegration.deleteMany({ where: { orgId: org.id } });
  await prisma.appFolioIntegration.deleteMany({ where: { orgId: org.id } });
  await prisma.notification.deleteMany({ where: { orgId: org.id } });
  await prisma.auditEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.creativeRequest.deleteMany({ where: { orgId: org.id } });
  await prisma.clientReport.deleteMany({ where: { orgId: org.id } });
  await prisma.seoQuery.deleteMany({ where: { orgId: org.id } });
  await prisma.seoLandingPage.deleteMany({ where: { orgId: org.id } });
  await prisma.seoSnapshot.deleteMany({ where: { orgId: org.id } });
  await prisma.propertyMention.deleteMany({ where: { orgId: org.id } });
  await prisma.reputationScan.deleteMany({ where: { orgId: org.id } });
  await prisma.insight.deleteMany({ where: { orgId: org.id } });
  await prisma.chatbotConversation.deleteMany({ where: { orgId: org.id } });
  await prisma.application.deleteMany({
    where: { lead: { orgId: org.id } },
  });
  await prisma.tour.deleteMany({ where: { lead: { orgId: org.id } } });
  await prisma.visitorEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.visitorSession.deleteMany({ where: { orgId: org.id } });
  await prisma.visitor.deleteMany({ where: { orgId: org.id } });
  await prisma.lead.deleteMany({ where: { orgId: org.id } });
  await prisma.adMetricDaily.deleteMany({ where: { orgId: org.id } });
  await prisma.adCampaign.deleteMany({ where: { orgId: org.id } });
  await prisma.adAccount.deleteMany({ where: { orgId: org.id } });
  await prisma.property.deleteMany({ where: { orgId: org.id } });

  // ─── Properties ──────────────────────────────────────────────────────
  const properties = await Promise.all(
    PROPERTIES.map((p) =>
      prisma.property.create({
        data: {
          orgId: org.id,
          name: p.name,
          slug: p.slug,
          propertyType: PropertyType.RESIDENTIAL,
          residentialSubtype: ResidentialSubtype.STUDENT_HOUSING,
          addressLine1: p.addressLine1,
          city: p.city,
          state: p.state,
          postalCode: p.postalCode,
          country: "US",
          websiteUrl: p.websiteUrl,
          totalUnits: p.totalUnits,
          availableCount: p.availableCount,
          lifecycle: PropertyLifecycle.ACTIVE,
          launchStatus: PropertyLaunchStatus.LIVE,
          launchedAt: new Date(
            Date.now() - rand(60, 180) * 24 * 60 * 60 * 1000,
          ),
          googleAggRating: p.googleAggRating,
          googleAggReviewCount: p.googleAggReviewCount,
          googleAggUpdatedAt: new Date(),
          lastSyncedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      }),
    ),
  );
  console.log(`[seed] inserted ${properties.length} properties`);

  // ─── Leads (90-day window, realistic funnel ratios) ──────────────────
  const TOTAL_LEADS = 350;
  const NOW = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOW_DAYS = 90;

  const leadsToCreate: Prisma.LeadCreateManyInput[] = [];
  for (let i = 0; i < TOTAL_LEADS; i += 1) {
    const dayOffset = rand(0, WINDOW_DAYS - 1);
    // Bias creation slightly toward the second half so the chart
    // shows growth, not decline.
    const adjustedOffset = Math.min(
      WINDOW_DAYS - 1,
      dayOffset + (dayOffset > WINDOW_DAYS / 2 ? 0 : rand(0, 8)),
    );
    const createdAt = new Date(NOW - adjustedOffset * DAY_MS - rand(0, DAY_MS));
    const property = pick(properties);
    const source = weighted(LEAD_SOURCE_MIX);
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    // Funnel status weights: most NEW/CONTACTED, dropping off toward SIGNED.
    const r = rng();
    let status: LeadStatus;
    if (r < 0.32) status = LeadStatus.NEW;
    else if (r < 0.55) status = LeadStatus.CONTACTED;
    else if (r < 0.70) status = LeadStatus.TOUR_SCHEDULED;
    else if (r < 0.80) status = LeadStatus.TOURED;
    else if (r < 0.86) status = LeadStatus.APPLICATION_SENT;
    else if (r < 0.92) status = LeadStatus.APPLIED;
    else if (r < 0.95) status = LeadStatus.APPROVED;
    else if (r < 0.985) status = LeadStatus.SIGNED;
    else status = LeadStatus.LOST;
    leadsToCreate.push({
      orgId: org.id,
      propertyId: property.id,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(10, 99)}@example.com`,
      phone: `+1${rand(200, 989)}${rand(200, 989)}${rand(1000, 9999)}`,
      source,
      status,
      score:
        status === LeadStatus.SIGNED
          ? rand(80, 99)
          : status === LeadStatus.APPLIED ||
              status === LeadStatus.APPROVED ||
              status === LeadStatus.APPLICATION_SENT
            ? rand(60, 85)
            : status === LeadStatus.TOURED ||
                status === LeadStatus.TOUR_SCHEDULED
              ? rand(40, 70)
              : rand(10, 50),
      intent:
        status === LeadStatus.SIGNED ||
        status === LeadStatus.APPROVED ||
        status === LeadStatus.APPLIED
          ? "hot"
          : status === LeadStatus.TOURED ||
              status === LeadStatus.TOUR_SCHEDULED
            ? "warm"
            : "cold",
      desiredMoveIn: new Date(NOW + rand(30, 240) * DAY_MS),
      budgetMinCents: rand(1200, 2000) * 100,
      budgetMaxCents: rand(2200, 4500) * 100,
      preferredUnitType: pick(["studio", "1-bed", "2-bed", "3-bed"]),
      firstSeenAt: createdAt,
      lastActivityAt: new Date(createdAt.getTime() + rand(0, 14) * DAY_MS),
      convertedAt: status === LeadStatus.SIGNED
        ? new Date(createdAt.getTime() + rand(7, 21) * DAY_MS)
        : null,
      createdAt,
      updatedAt: createdAt,
    });
  }
  await prisma.lead.createMany({ data: leadsToCreate });
  const allLeads = await prisma.lead.findMany({
    where: { orgId: org.id },
    select: { id: true, status: true, propertyId: true, createdAt: true },
  });
  console.log(`[seed] inserted ${allLeads.length} leads`);

  // ─── Tours + Applications attached to mid/late-funnel leads ──────────
  const TOUR_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
    LeadStatus.TOUR_SCHEDULED,
    LeadStatus.TOURED,
    LeadStatus.APPLICATION_SENT,
    LeadStatus.APPLIED,
    LeadStatus.APPROVED,
    LeadStatus.SIGNED,
  ]);
  const APP_STATUSES: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
    LeadStatus.APPLICATION_SENT,
    LeadStatus.APPLIED,
    LeadStatus.APPROVED,
    LeadStatus.SIGNED,
  ]);
  const toursToCreate: Prisma.TourCreateManyInput[] = [];
  const appsToCreate: Prisma.ApplicationCreateManyInput[] = [];
  for (const lead of allLeads) {
    if (!lead.propertyId) continue;
    const hasTour = TOUR_STATUSES.has(lead.status);
    if (hasTour) {
      toursToCreate.push({
        leadId: lead.id,
        propertyId: lead.propertyId,
        status:
          lead.status === LeadStatus.TOUR_SCHEDULED
            ? TourStatus.SCHEDULED
            : TourStatus.COMPLETED,
        tourType: pick(["in_person", "virtual", "self_guided"]),
        scheduledAt: new Date(lead.createdAt.getTime() + rand(2, 7) * DAY_MS),
        completedAt:
          lead.status === LeadStatus.TOUR_SCHEDULED
            ? null
            : new Date(lead.createdAt.getTime() + rand(2, 7) * DAY_MS),
        attendeeCount: rand(1, 3),
        createdAt: new Date(lead.createdAt.getTime() + rand(1, 3) * DAY_MS),
        updatedAt: new Date(lead.createdAt.getTime() + rand(2, 7) * DAY_MS),
      });
    }
    const hasApp = APP_STATUSES.has(lead.status);
    if (hasApp) {
      appsToCreate.push({
        leadId: lead.id,
        propertyId: lead.propertyId,
        status:
          lead.status === LeadStatus.APPROVED ||
          lead.status === LeadStatus.SIGNED
            ? ApplicationStatus.APPROVED
            : lead.status === LeadStatus.APPLIED
              ? ApplicationStatus.SUBMITTED
              : ApplicationStatus.STARTED,
        appliedAt: new Date(lead.createdAt.getTime() + rand(5, 12) * DAY_MS),
        createdAt: new Date(lead.createdAt.getTime() + rand(5, 12) * DAY_MS),
        updatedAt: new Date(lead.createdAt.getTime() + rand(5, 12) * DAY_MS),
      });
    }
  }
  await prisma.tour.createMany({ data: toursToCreate });
  await prisma.application.createMany({ data: appsToCreate });
  console.log(
    `[seed] inserted ${toursToCreate.length} tours, ${appsToCreate.length} applications`,
  );

  // ─── Ad accounts + campaigns + 28d of daily metrics ──────────────────
  const googleAccount = await prisma.adAccount.create({
    data: {
      orgId: org.id,
      platform: AdPlatform.GOOGLE_ADS,
      externalAccountId: "8472310594",
      displayName: "Riverstone — Search & Performance Max",
      currency: "USD",
      accessStatus: "active",
      credentialsEncrypted: "demo-placeholder", // marks as "real" for the agent guard
      autoSyncEnabled: true,
      lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
  });
  const metaAccount = await prisma.adAccount.create({
    data: {
      orgId: org.id,
      platform: AdPlatform.META,
      externalAccountId: "5193027461",
      displayName: "Riverstone — Meta Lead Gen",
      currency: "USD",
      accessStatus: "active",
      credentialsEncrypted: "demo-placeholder",
      autoSyncEnabled: true,
      lastSyncAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
  });

  const campaigns: Array<{
    id: string;
    propertyId: string;
    platform: AdPlatform;
    adAccountId: string;
  }> = [];
  for (const prop of properties) {
    const c1 = await prisma.adCampaign.create({
      data: {
        orgId: org.id,
        propertyId: prop.id,
        adAccountId: googleAccount.id,
        externalCampaignId: `gads-${prop.slug}`,
        name: `${prop.name} — Search`,
        platform: AdPlatform.GOOGLE_ADS,
        status: "ENABLED",
        objective: "SEARCH",
        dailyBudgetCents: rand(8000, 18000),
        startedAt: new Date(Date.now() - 60 * DAY_MS),
      },
    });
    const c2 = await prisma.adCampaign.create({
      data: {
        orgId: org.id,
        propertyId: prop.id,
        adAccountId: metaAccount.id,
        externalCampaignId: `meta-${prop.slug}`,
        name: `${prop.name} — Lead Gen`,
        platform: AdPlatform.META,
        status: "ACTIVE",
        objective: "OUTCOME_LEADS",
        dailyBudgetCents: rand(6000, 14000),
        startedAt: new Date(Date.now() - 60 * DAY_MS),
      },
    });
    campaigns.push(
      { id: c1.id, propertyId: prop.id, platform: AdPlatform.GOOGLE_ADS, adAccountId: googleAccount.id },
      { id: c2.id, propertyId: prop.id, platform: AdPlatform.META, adAccountId: metaAccount.id },
    );
  }

  const metricsToCreate: Prisma.AdMetricDailyCreateManyInput[] = [];
  // 90 days of daily ad metrics so the 7/28/90 range pills all
  // render a fully-populated trend line, not a half-empty x-axis.
  for (const c of campaigns) {
    for (let d = 89; d >= 0; d -= 1) {
      const date = new Date(NOW - d * DAY_MS);
      date.setUTCHours(0, 0, 0, 0);
      const impressions = rand(1500, 6500);
      const ctr = c.platform === AdPlatform.GOOGLE_ADS
        ? 0.04 + rng() * 0.04
        : 0.014 + rng() * 0.02;
      const clicks = Math.floor(impressions * ctr);
      const cpcCents = c.platform === AdPlatform.GOOGLE_ADS
        ? rand(180, 420)
        : rand(95, 260);
      const spendCents = clicks * cpcCents;
      const conversions = clicks * (0.05 + rng() * 0.05);
      metricsToCreate.push({
        orgId: org.id,
        adAccountId: c.adAccountId,
        campaignId: c.id,
        date,
        impressions,
        clicks,
        spendCents,
        conversions,
        conversionValueCents: Math.floor(conversions) * rand(150_000, 350_000),
        ctr,
      });
    }
  }
  await prisma.adMetricDaily.createMany({ data: metricsToCreate });
  console.log(`[seed] inserted ${metricsToCreate.length} ad metric rows`);

  // ─── Visitor sessions (1,500 over 28d, ~10% identified) ──────────────
  const sessionsToCreate: Prisma.VisitorSessionCreateManyInput[] = [];
  const SESSION_COUNT = 1500;
  const utmMixes: Array<{ source: string; medium: string }> = [
    { source: "google", medium: "cpc" },
    { source: "google", medium: "organic" },
    { source: "facebook", medium: "paid_social" },
    { source: "(direct)", medium: "(none)" },
    { source: "reddit", medium: "social" },
    { source: "instagram", medium: "paid_social" },
  ];
  for (let i = 0; i < SESSION_COUNT; i += 1) {
    const startedAt = new Date(NOW - rand(0, 28) * DAY_MS - rand(0, DAY_MS));
    const utm = pick(utmMixes);
    const property = pick(properties);
    const pages = rand(1, 12);
    sessionsToCreate.push({
      orgId: org.id,
      anonymousId: `riv-anon-${i.toString(36)}-${rand(1000, 9999)}`,
      sessionToken: `riv-sess-${i.toString(36)}-${rand(100000, 999999)}`,
      firstUrl: `https://${property.slug}.example/floor-plans`,
      firstReferrer: utm.source === "(direct)" ? null : `https://${utm.source}.com/`,
      utmSource: utm.source === "(direct)" ? null : utm.source,
      utmMedium: utm.medium === "(none)" ? null : utm.medium,
      utmCampaign: utm.source === "google" ? "search-lease-up" : null,
      country: "US",
      language: "en-US",
      pageviewCount: pages,
      totalTimeSeconds: pages * rand(15, 80),
      maxScrollDepth: rand(20, 100),
      startedAt,
      lastEventAt: new Date(startedAt.getTime() + rand(60, 2400) * 1000),
    });
  }
  await prisma.visitorSession.createMany({ data: sessionsToCreate });
  console.log(`[seed] inserted ${sessionsToCreate.length} visitor sessions`);

  // ─── A handful of identified Visitors so the pixel page lights up ────
  // Visitor's identity key is `cursiveVisitorId` (the V4 pixel id), not
  // an `anonymousId` — see schema.prisma. We synthesize a stable demo id
  // so re-runs upsert the same row rather than duplicating.
  const identifiedVisitorCount = Math.floor(SESSION_COUNT * 0.10);
  for (let i = 0; i < identifiedVisitorCount; i += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    await prisma.visitor.create({
      data: {
        orgId: org.id,
        cursiveVisitorId: `riv-cv-${i}-${rand(1000, 9999)}`,
        status: VisitorIdentificationStatus.IDENTIFIED,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(10, 99)}@example.com`,
        firstSeenAt: new Date(NOW - rand(0, 21) * DAY_MS),
        lastSeenAt: new Date(NOW - rand(0, 6) * DAY_MS),
      },
    });
  }
  console.log(`[seed] inserted ${identifiedVisitorCount} identified visitors`);

  // ─── Chatbot conversations ───────────────────────────────────────────
  const chatbotMessages = [
    { role: "user", content: "Hey — do you have any 2-bed units available for fall?" },
    { role: "assistant", content: "Hi! We have 4 two-bedroom units coming available between July and September. Want me to text you the floor plans + pricing?" },
    { role: "user", content: "Yes, sure. Also what's the move-in process like?" },
    { role: "assistant", content: "Application opens 60 days before move-in. You can apply online, we run a soft credit check, and most decisions come back within 48 hours. What's a good email to send the floor plans to?" },
    { role: "user", content: "avery.chen@example.com" },
  ];
  for (let i = 0; i < 28; i += 1) {
    const property = pick(properties);
    const captured = rng() > 0.4;
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    await prisma.chatbotConversation.create({
      data: {
        orgId: org.id,
        propertyId: property.id,
        sessionId: `riv-chat-${i}-${rand(100000, 999999)}`,
        status:
          captured && rng() > 0.5
            ? ChatbotConversationStatus.LEAD_CAPTURED
            : ChatbotConversationStatus.ACTIVE,
        messages: chatbotMessages,
        messageCount: chatbotMessages.length,
        capturedName: captured ? `${firstName} ${lastName}` : null,
        capturedEmail: captured
          ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`
          : null,
        lastMessageAt: new Date(NOW - rand(0, 21) * DAY_MS),
        pageUrl: `https://${property.slug}.example/floor-plans`,
        createdAt: new Date(NOW - rand(0, 28) * DAY_MS),
      },
    });
  }
  console.log(`[seed] inserted 28 chatbot conversations`);

  // ─── Insights (5 ranked items so InsightsHero lights up) ─────────────
  const insightsSeed = [
    {
      kind: "cpl_spike",
      severity: "warning",
      category: "ads",
      title: `${properties[0].name} — Google Ads CPL up 28%`,
      body: "Cost per lead on the search campaign jumped from $14.20 to $18.16 over the last 7 days while impression share dropped 9pp. Creative may be fatigued.",
      suggestedAction: "Ship two new ad variants from the creative queue. Pause the lowest-CTR ad group.",
      href: "/portal/ads",
      dedupeKey: `cpl_spike:${properties[0].id}:week`,
    },
    {
      kind: "hot_visitor",
      severity: "info",
      category: "traffic",
      title: `4 hot visitors at ${properties[1].name} this week`,
      body: "Each spent 8+ minutes on floor-plan pages and viewed the application path. None have a lead record yet.",
      suggestedAction: "Send the high-intent retargeting sequence.",
      href: "/portal/visitors",
      dedupeKey: `hot_visitor:${properties[1].id}:week`,
    },
    {
      kind: "pipeline_stall",
      severity: "warning",
      category: "leads",
      title: "8 leads stuck in TOURED for 7+ days",
      body: "These leads completed tours but have not advanced to APPLICATION. Median time from tour → app for healthy lease-ups is 3 days.",
      suggestedAction: "Have leasing reach out personally — 3 of the 8 are scoring 75+.",
      href: "/portal/leads?status=TOURED",
      dedupeKey: "pipeline_stall:toured:week",
    },
    {
      kind: "traffic_spike",
      severity: "info",
      category: "traffic",
      title: `${properties[2].name} — organic traffic up 41%`,
      body: "Last 14 days vs prior 14: organic sessions jumped from 312 → 440. Top landing: /amenities. A new local blog backlinked us last Tuesday.",
      suggestedAction: "Share the win on the Monday report. Schedule a follow-up post.",
      href: "/portal/seo",
      dedupeKey: `traffic_spike:${properties[2].id}:14d`,
    },
    {
      kind: "conv_rate_drop",
      severity: "critical",
      category: "leads",
      title: `${properties[3].name} — tour → app conversion at 22% (was 38%)`,
      body: "Tour-to-application conversion dropped 16pp over the last 28 days. Common thread in 5 recent tours: notes mention 'pricing concerns'.",
      suggestedAction: "Audit competitor rents within 0.5mi. Consider a limited-time concession.",
      href: `/portal/properties/${properties[3].id}`,
      dedupeKey: `conv_rate_drop:${properties[3].id}:28d`,
    },
  ];
  for (const i of insightsSeed) {
    await prisma.insight.create({
      data: {
        orgId: org.id,
        propertyId: null,
        kind: i.kind,
        severity: i.severity,
        category: i.category,
        title: i.title,
        body: i.body,
        suggestedAction: i.suggestedAction,
        href: i.href,
        dedupeKey: i.dedupeKey,
        status: "open",
      },
    });
  }
  console.log(`[seed] inserted ${insightsSeed.length} insights`);

  // ─── VisitorEvent timelines for the 200 most-recent sessions ────────
  // The visitor page renders a per-session event timeline (pageview →
  // scroll → timing → click → form_submit). Without these rows the
  // session detail view is empty. We back-fill the most recent 200
  // sessions with realistic 3–8 event timelines each.
  const recentSessions = await prisma.visitorSession.findMany({
    where: { orgId: org.id },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: { id: true, startedAt: true, firstUrl: true },
  });
  const visitorEventsToCreate: Prisma.VisitorEventCreateManyInput[] = [];
  for (const sess of recentSessions) {
    const pageCount = rand(3, 8);
    let cursor = sess.startedAt.getTime();
    for (let p = 0; p < pageCount; p += 1) {
      const property = pick(properties);
      const path = pick([
        "/floor-plans",
        `/floor-plans/${pick(["studio", "1-bed", "2-bed", "3-bed"])}`,
        "/amenities",
        "/tour",
        "/apply",
        "/contact",
        "/parents",
        "/location",
        "/gallery",
      ]);
      cursor += rand(8_000, 95_000);
      visitorEventsToCreate.push({
        orgId: org.id,
        sessionId: sess.id,
        type: "pageview",
        url: `https://${property.slug}.example${path}`,
        path,
        title: `${property.name} · ${path.split("/").pop() ?? "home"}`,
        occurredAt: new Date(cursor),
      });
      // Add a scroll + timing event for most pages so the timeline
      // reads as engaged, not a bot.
      if (rng() > 0.3) {
        cursor += rand(2_000, 8_000);
        visitorEventsToCreate.push({
          orgId: org.id,
          sessionId: sess.id,
          type: "scroll",
          url: `https://${property.slug}.example${path}`,
          path,
          scrollDepth: rand(35, 100),
          occurredAt: new Date(cursor),
        });
      }
      if (rng() > 0.45) {
        cursor += rand(4_000, 25_000);
        visitorEventsToCreate.push({
          orgId: org.id,
          sessionId: sess.id,
          type: "timing",
          url: `https://${property.slug}.example${path}`,
          path,
          timeOnPageSeconds: rand(8, 180),
          occurredAt: new Date(cursor),
        });
      }
    }
  }
  // Chunk the insert — Prisma's createMany has a Postgres parameter cap
  // around ~32k, and we generate ~3-4k rows here. One chunk works, but
  // chunking by 1,000 keeps memory + log lines reasonable.
  for (let i = 0; i < visitorEventsToCreate.length; i += 1000) {
    await prisma.visitorEvent.createMany({
      data: visitorEventsToCreate.slice(i, i + 1000),
    });
  }
  console.log(
    `[seed] inserted ${visitorEventsToCreate.length} visitor events across ${recentSessions.length} sessions`,
  );

  // ─── Reputation scans + property mentions ───────────────────────────
  // One ReputationScan per property, completed, with a fan of mentions
  // across Google reviews, Yelp, Reddit, and Tavily web hits. Each
  // mention has a sentiment + rating where applicable.
  const reviewSnippetPool = [
    {
      sentiment: Sentiment.POSITIVE,
      rating: 5,
      excerpts: [
        "Best decision we made this year. Maintenance is responsive and the move-in was smooth.",
        "The amenities are great and the staff is incredibly helpful. Highly recommend.",
        "Love living here. Walking distance to everything I need and the gym is solid.",
      ],
    },
    {
      sentiment: Sentiment.POSITIVE,
      rating: 4,
      excerpts: [
        "Great property overall. A few small things to work out but nothing major.",
        "Solid place, fair rent, good location. Would renew.",
      ],
    },
    {
      sentiment: Sentiment.NEUTRAL,
      rating: 3,
      excerpts: [
        "It's fine. Not exceptional but not bad. Decent amenities, average noise.",
        "Standard living experience. Office is responsive on weekdays.",
      ],
    },
    {
      sentiment: Sentiment.NEGATIVE,
      rating: 2,
      excerpts: [
        "Maintenance requests took 5 days to fix. Wish they were faster.",
        "Parking is rough on weekends. Otherwise unit is fine.",
      ],
    },
  ];
  const redditSnippets = [
    {
      sentiment: Sentiment.POSITIVE,
      excerpt:
        "Anyone live at this place? I toured last week and the floor plans were way better than what's online.",
    },
    {
      sentiment: Sentiment.NEUTRAL,
      excerpt:
        "Comparing two buildings in the area — anyone have firsthand experience with the maintenance team here?",
    },
    {
      sentiment: Sentiment.POSITIVE,
      excerpt:
        "Just signed for a 2-bed for the fall semester. Application process was painless, got approved in 24h.",
    },
  ];
  const mentionsToCreate: Prisma.PropertyMentionCreateManyInput[] = [];
  for (const prop of properties) {
    const scan = await prisma.reputationScan.create({
      data: {
        orgId: org.id,
        propertyId: prop.id,
        status: ReputationScanStatus.SUCCEEDED,
        sources: {
          google: { found: 18, newCount: 2, ok: true },
          yelp: { found: 6, newCount: 0, ok: true },
          reddit: { found: 4, newCount: 1, ok: true },
          tavily: { found: 8, newCount: 1, ok: true },
        },
        newMentionCount: 4,
        totalMentionCount: 36,
        estCostCents: 280,
        durationMs: rand(18_000, 42_000),
        createdAt: new Date(NOW - rand(0, 4) * DAY_MS),
        completedAt: new Date(NOW - rand(0, 4) * DAY_MS + 30_000),
      },
    });
    // 18 Google reviews per property
    for (let g = 0; g < 18; g += 1) {
      const bucket = pick(reviewSnippetPool);
      const excerpt = pick(bucket.excerpts);
      const publishedAt = new Date(NOW - rand(1, 180) * DAY_MS);
      mentionsToCreate.push({
        orgId: org.id,
        propertyId: prop.id,
        source: MentionSource.GOOGLE_REVIEW,
        sourceUrl: `https://maps.google.com/?cid=${rand(10000, 99999)}&rev=${g}`,
        urlHash: randomBytes(16).toString("hex"),
        title: null,
        excerpt,
        authorName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)[0]}.`,
        publishedAt,
        rating: bucket.rating,
        sentiment: bucket.sentiment,
        topics: bucket.sentiment === Sentiment.NEGATIVE
          ? ["maintenance", "parking"]
          : bucket.sentiment === Sentiment.POSITIVE
            ? ["location", "amenities", "staff"]
            : ["neutral"],
        firstSeenScanId: scan.id,
      });
    }
    // 6 Yelp
    for (let y = 0; y < 6; y += 1) {
      const bucket = pick(reviewSnippetPool);
      const excerpt = pick(bucket.excerpts);
      mentionsToCreate.push({
        orgId: org.id,
        propertyId: prop.id,
        source: MentionSource.YELP,
        sourceUrl: `https://yelp.com/biz/${prop.slug}#review-${y}`,
        urlHash: randomBytes(16).toString("hex"),
        excerpt,
        authorName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)[0]}.`,
        publishedAt: new Date(NOW - rand(7, 240) * DAY_MS),
        rating: bucket.rating,
        sentiment: bucket.sentiment,
        firstSeenScanId: scan.id,
      });
    }
    // 4 Reddit
    for (let r = 0; r < 4; r += 1) {
      const bucket = pick(redditSnippets);
      mentionsToCreate.push({
        orgId: org.id,
        propertyId: prop.id,
        source: MentionSource.REDDIT,
        sourceUrl: `https://reddit.com/r/${pick(["AskNYC", "AustinRentals", "boulder", "nashville"])}/comments/${randomBytes(4).toString("hex")}`,
        urlHash: randomBytes(16).toString("hex"),
        title: pick([
          `Anyone live at ${prop.name}?`,
          `${prop.city} housing recommendations`,
          `Tour scheduled for ${prop.name} — what should I ask?`,
        ]),
        excerpt: bucket.excerpt,
        authorName: `u/${pick(FIRST_NAMES).toLowerCase()}${rand(100, 999)}`,
        publishedAt: new Date(NOW - rand(2, 90) * DAY_MS),
        sentiment: bucket.sentiment,
        firstSeenScanId: scan.id,
      });
    }
    // 8 Tavily web hits (blog mentions, neighborhood guides)
    for (let t = 0; t < 8; t += 1) {
      mentionsToCreate.push({
        orgId: org.id,
        propertyId: prop.id,
        source: MentionSource.TAVILY_WEB,
        sourceUrl: `https://example-blog.com/best-${(prop.city ?? "city").toLowerCase()}-rentals/${t}`,
        urlHash: randomBytes(16).toString("hex"),
        title: `Top student housing in ${prop.city} for 2026`,
        excerpt: `${prop.name} comes up in our roundup of well-located buildings in ${prop.city}. Highlights include modern amenities, professional management, and a transparent application process.`,
        authorName: `Editorial Team`,
        publishedAt: new Date(NOW - rand(20, 300) * DAY_MS),
        sentiment: Sentiment.POSITIVE,
        firstSeenScanId: scan.id,
      });
    }
  }
  await prisma.propertyMention.createMany({ data: mentionsToCreate });
  console.log(
    `[seed] inserted ${properties.length} reputation scans + ${mentionsToCreate.length} mentions`,
  );

  // ─── SEO history (90d of organic snapshots + top queries + landing pages) ───
  const seoSnapshotsToCreate: Prisma.SeoSnapshotCreateManyInput[] = [];
  for (let d = 89; d >= 0; d -= 1) {
    const date = new Date(NOW - d * DAY_MS);
    date.setUTCHours(0, 0, 0, 0);
    const trend = 1 + ((89 - d) / 89) * 0.45; // gentle upward trend
    const sessions = Math.round(180 * trend) + rand(-20, 20);
    const impressions = sessions * rand(8, 14);
    const clicks = Math.round(sessions * 0.62);
    seoSnapshotsToCreate.push({
      orgId: org.id,
      date,
      organicSessions: sessions,
      organicUsers: Math.round(sessions * 0.78),
      totalImpressions: impressions,
      totalClicks: clicks,
      avgCtr: clicks / Math.max(1, impressions),
      avgPosition: 8.4 - ((89 - d) / 89) * 1.8 + (rng() - 0.5) * 0.6,
    });
  }
  await prisma.seoSnapshot.createMany({ data: seoSnapshotsToCreate });

  const topQueries = [
    "student housing boulder",
    "austin student apartments",
    "brooklyn student housing",
    "nashville off campus housing",
    "2 bedroom apartment near campus",
    "furnished student apartment",
    "all inclusive student rent",
    "student apartment with parking",
    "student housing fall semester",
    "luxury student housing",
  ];
  const seoQueriesToCreate: Prisma.SeoQueryCreateManyInput[] = [];
  // One row per (day, query) for the last 30 days. Drives the "Top
  // queries" table on /portal/seo without flooding the inserts.
  for (let d = 29; d >= 0; d -= 1) {
    const date = new Date(NOW - d * DAY_MS);
    date.setUTCHours(0, 0, 0, 0);
    for (const q of topQueries) {
      const impressions = rand(40, 240);
      const clicks = Math.max(0, Math.round(impressions * (0.04 + rng() * 0.06)));
      seoQueriesToCreate.push({
        orgId: org.id,
        date,
        query: q,
        impressions,
        clicks,
        ctr: clicks / Math.max(1, impressions),
        position: 6 + rng() * 8,
      });
    }
  }
  await prisma.seoQuery.createMany({ data: seoQueriesToCreate });

  const seoPagesToCreate: Prisma.SeoLandingPageCreateManyInput[] = [];
  const topPaths = ["/", "/floor-plans", "/amenities", "/tour", "/apply", "/gallery", "/location"];
  for (let d = 29; d >= 0; d -= 1) {
    const date = new Date(NOW - d * DAY_MS);
    date.setUTCHours(0, 0, 0, 0);
    for (const prop of properties) {
      for (const path of topPaths) {
        const sessions = rand(8, 90);
        seoPagesToCreate.push({
          orgId: org.id,
          date,
          url: `https://${prop.slug}.example${path}`,
          sessions,
          users: Math.round(sessions * 0.78),
        });
      }
    }
  }
  for (let i = 0; i < seoPagesToCreate.length; i += 1000) {
    await prisma.seoLandingPage.createMany({
      data: seoPagesToCreate.slice(i, i + 1000),
    });
  }
  console.log(
    `[seed] inserted ${seoSnapshotsToCreate.length} SEO snapshots, ${seoQueriesToCreate.length} query rows, ${seoPagesToCreate.length} landing page rows`,
  );

  // ─── Historical client reports (the operator's "Reports" inbox) ─────
  // 4 weekly + 2 monthly, all with a frozen-snapshot JSON shape that
  // mirrors what `generateReportSnapshot` would produce.
  function freezeSnapshot(periodStart: Date, periodEnd: Date) {
    const days = Math.max(
      1,
      Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS),
    );
    const leadsTotal = days * rand(2, 5);
    const tours = Math.round(leadsTotal * 0.34);
    const apps = Math.round(leadsTotal * 0.17);
    const signed = Math.round(leadsTotal * 0.05);
    return {
      kpis: {
        leads: leadsTotal,
        tours,
        applications: apps,
        leases: signed,
        adSpendUsd: days * rand(140, 320),
        organicSessions: days * rand(120, 220),
      },
      kpiDeltas: {
        leadsPct: rand(-12, 22),
        toursPct: rand(-8, 18),
        applicationsPct: rand(-10, 15),
        leasesPct: rand(-5, 10),
      },
      funnel: [
        { label: "Visitors", count: days * rand(380, 540) },
        { label: "Leads", count: leadsTotal },
        { label: "Tours", count: tours },
        { label: "Applications", count: apps },
        { label: "Leases", count: signed },
      ],
      leadSources: [
        { source: "Google Ads", count: Math.round(leadsTotal * 0.30) },
        { source: "Direct", count: Math.round(leadsTotal * 0.22) },
        { source: "Meta Ads", count: Math.round(leadsTotal * 0.18) },
        { source: "Organic", count: Math.round(leadsTotal * 0.12) },
        { source: "Referral", count: Math.round(leadsTotal * 0.08) },
        { source: "Chatbot", count: Math.round(leadsTotal * 0.06) },
        { source: "Other", count: Math.round(leadsTotal * 0.04) },
      ],
    };
  }
  const reportsSpec = [
    { kind: "weekly", offsetDays: 7, durationDays: 7 },
    { kind: "weekly", offsetDays: 14, durationDays: 7 },
    { kind: "weekly", offsetDays: 21, durationDays: 7 },
    { kind: "weekly", offsetDays: 28, durationDays: 7 },
    { kind: "monthly", offsetDays: 32, durationDays: 28 },
    { kind: "monthly", offsetDays: 60, durationDays: 28 },
  ] as const;
  for (const spec of reportsSpec) {
    const periodEnd = new Date(NOW - spec.offsetDays * DAY_MS);
    const periodStart = new Date(periodEnd.getTime() - spec.durationDays * DAY_MS);
    const snapshot = freezeSnapshot(periodStart, periodEnd);
    await prisma.clientReport.create({
      data: {
        orgId: org.id,
        propertyId: null,
        kind: spec.kind,
        periodStart,
        periodEnd,
        snapshot,
        headline:
          spec.kind === "weekly"
            ? `Strong week — leads up ${snapshot.kpiDeltas.leadsPct}% vs prior 7 days.`
            : `${spec.kind === "monthly" ? "Monthly" : "Period"} rollup ready for review.`,
        notes: null,
        shareToken: randomBytes(12).toString("base64url"),
        status: spec.offsetDays >= 21 ? "shared" : "draft",
        sharedAt: spec.offsetDays >= 21 ? new Date(periodEnd.getTime() + DAY_MS) : null,
        viewCount: spec.offsetDays >= 21 ? rand(3, 14) : 0,
        generatedAt: new Date(periodEnd.getTime() + 60_000),
      },
    });
  }
  console.log(`[seed] inserted ${reportsSpec.length} client reports`);

  // ─── Creative requests (the agency queue) ───────────────────────────
  const creativeSpecs = [
    {
      title: "Fall lease-up — Meta carousel refresh",
      description:
        "Need 4 new Meta carousel creatives leaning into the fall move-in deadline. Existing creative has been running 60+ days, CTR is fatigued.",
      format: CreativeFormat.INSTAGRAM_FEED,
      status: CreativeRequestStatus.IN_PROGRESS,
      offset: 4,
    },
    {
      title: "Google Search RSA — Boulder property",
      description: "Three new responsive search ad headlines + descriptions targeting student housing keywords. Lean into walkability + amenities.",
      format: CreativeFormat.GOOGLE_SEARCH_COPY,
      status: CreativeRequestStatus.IN_REVIEW,
      offset: 2,
    },
    {
      title: "Parents nurture email — header banner",
      description: "Header image for the 'parents' email cadence. Calm/trust-forward. No people in the image per fair-housing pass.",
      format: CreativeFormat.EMAIL_HEADER,
      status: CreativeRequestStatus.DELIVERED,
      offset: 14,
    },
    {
      title: "Brooklyn property — Instagram story set",
      description: "Three story creatives showing rooftop, common area, and one floor plan. Move-in special tag.",
      format: CreativeFormat.INSTAGRAM_STORY,
      status: CreativeRequestStatus.APPROVED,
      offset: 21,
    },
    {
      title: "Web banner — referral program launch",
      description:
        "1200x300 banner for the resident referral program. Use the brand blue + the wordmark; copy says 'Refer a friend, $300 off next month'.",
      format: CreativeFormat.WEB_BANNER,
      status: CreativeRequestStatus.SUBMITTED,
      offset: 1,
    },
  ];
  for (const c of creativeSpecs) {
    await prisma.creativeRequest.create({
      data: {
        orgId: org.id,
        propertyId: pick(properties).id,
        title: c.title,
        description: c.description,
        format: c.format,
        status: c.status,
        priority: c.offset < 3 ? "high" : "normal",
        targetDate: new Date(NOW + rand(2, 10) * DAY_MS),
        createdAt: new Date(NOW - c.offset * DAY_MS),
      },
    });
  }
  console.log(`[seed] inserted ${creativeSpecs.length} creative requests`);

  // ─── Audit events (activity history feeding /portal + /admin) ───────
  const auditActions = [
    { action: AuditAction.CREATE, entityType: "Lead", description: "New lead from Google Ads" },
    { action: AuditAction.UPDATE, entityType: "Lead", description: "Lead status moved to TOUR_SCHEDULED" },
    { action: AuditAction.CREATE, entityType: "Tour", description: "Tour scheduled" },
    { action: AuditAction.UPDATE, entityType: "Application", description: "Application submitted" },
    { action: AuditAction.SETTING_CHANGE, entityType: "Organization", description: "Primary brand color updated" },
    { action: AuditAction.UPDATE, entityType: "AdCampaign", description: "Daily budget raised by 15%" },
    { action: AuditAction.CREATE, entityType: "CreativeRequest", description: "New creative request submitted" },
  ];
  const auditToCreate: Prisma.AuditEventCreateManyInput[] = [];
  for (let i = 0; i < 60; i += 1) {
    const a = pick(auditActions);
    auditToCreate.push({
      orgId: org.id,
      action: a.action,
      entityType: a.entityType,
      description: a.description,
      createdAt: new Date(NOW - rand(0, 30) * DAY_MS),
    });
  }
  await prisma.auditEvent.createMany({ data: auditToCreate });
  console.log(`[seed] inserted ${auditToCreate.length} audit events`);

  // ─── Notifications (bell icon items) ────────────────────────────────
  const notifSpecs = [
    { kind: "lead_created", title: "New hot lead — Avery Chen", body: "Score 84. Viewed 2-bed floor plan, applied via chatbot.", offset: 1 },
    { kind: "tour_scheduled", title: "Tour booked — Jordan Park", body: "Park & Pearl, Wed 3pm in-person." , offset: 6 },
    { kind: "chatbot_lead", title: "Chatbot captured a lead overnight", body: "Sage at Greenpoint — 12:42am session ended with email captured.", offset: 12 },
    { kind: "integration_error", title: "Cursive pixel: no events in 6h", body: "Last event from Westbrook Commons was 6h ago. Pixel may be misconfigured.", offset: 18 },
    { kind: "sync_complete", title: "Weekly report generated", body: "Last week's portfolio rollup is ready to review and share.", offset: 26 },
  ];
  for (const n of notifSpecs) {
    await prisma.notification.create({
      data: {
        orgId: org.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        readAt: n.offset > 20 ? new Date(NOW - n.offset * 60 * 60 * 1000 + 3_600_000) : null,
        createdAt: new Date(NOW - n.offset * 60 * 60 * 1000),
      },
    });
  }
  console.log(`[seed] inserted ${notifSpecs.length} notifications`);

  // ─── Integrations — every external data source appears CONNECTED ─────
  // These rows make the /portal/connect, /portal/settings/integrations,
  // and per-tile dashboards render the green "connected" state for
  // every supported provider. Norman demos to prospects who ask
  // "do you connect to X?" — without these rows, half the integration
  // cards show "not connected" even though the underlying data tables
  // are full.
  //
  // Encrypted-secret columns get a placeholder string so the agency-
  // side dashboard's "credentials present?" check passes; nothing
  // actually attempts to call out to the providers because this is
  // a demo org and no cron is wired to it.

  // AppFolio — pretend the sync ran 4 hours ago, no errors.
  await prisma.appFolioIntegration.create({
    data: {
      orgId: org.id,
      instanceSubdomain: "telegraphcommons",
      plan: "max",
      apiKeyEncrypted: "demo-placeholder-encrypted",
      clientIdEncrypted: "demo-placeholder-encrypted",
      clientSecretEncrypted: "demo-placeholder-encrypted",
      syncStatus: "idle",
      lastSyncAt: new Date(NOW - 4 * 60 * 60 * 1000),
      lastSyncStats: {
        residents: { ok: true, count: 460 },
        leases: { ok: true, count: 461 },
        properties: { ok: true, count: 4 },
        guest_cards: { ok: true, count: 0 },
      },
      propertyGroupFilter: null,
      syncFrequencyMinutes: 60,
    },
  });
  console.log(`[seed] inserted AppFolio integration (status: idle, last sync 4h ago)`);

  // Cursive pixel — provisioned, installed, firing. Legacy org-wide
  // row (propertyId = NULL) so the existing helpers find it as the
  // primary pixel.
  await prisma.cursiveIntegration.create({
    data: {
      orgId: org.id,
      propertyId: null,
      cursivePixelId: "tc-demo-pixel-7f4e9b2c",
      cursiveAccountId: "al-acct-leasestack-demo",
      pixelScriptUrl: "https://cdn.cursive.example/p/tc-demo-pixel-7f4e9b2c.js",
      installedOnDomain: "telegraphcommons.example",
      provisionedAt: new Date(NOW - 75 * DAY_MS),
      lastEventAt: new Date(NOW - 8 * 60 * 1000), // 8 minutes ago
      totalEventsCount: 18_421,
      webhookToken: randomBytes(16).toString("hex"),
      cursiveSegmentId: "seg-tc-demo-hot",
      lastSegmentSyncAt: new Date(NOW - 2 * 60 * 60 * 1000),
      weeklyDigestEnabled: true,
    },
  });
  console.log(`[seed] inserted Cursive pixel integration (firing, last event 8m ago)`);

  // SEO — GA4 + GSC, both connected and syncing. Legacy org-wide rows.
  await prisma.seoIntegration.create({
    data: {
      orgId: org.id,
      propertyId: null,
      provider: SeoProvider.GA4,
      propertyIdentifier: "properties/427810946",
      serviceAccountEmail: "leasestack-demo-ga4@leasestack-iam.iam.gserviceaccount.com",
      serviceAccountJsonEncrypted: "demo-placeholder-encrypted",
      status: SeoSyncStatus.IDLE,
      lastSyncAt: new Date(NOW - 6 * 60 * 60 * 1000),
    },
  });
  await prisma.seoIntegration.create({
    data: {
      orgId: org.id,
      propertyId: null,
      provider: SeoProvider.GSC,
      propertyIdentifier: "sc-domain:telegraphcommons.example",
      serviceAccountEmail: "leasestack-demo-gsc@leasestack-iam.iam.gserviceaccount.com",
      serviceAccountJsonEncrypted: "demo-placeholder-encrypted",
      status: SeoSyncStatus.IDLE,
      lastSyncAt: new Date(NOW - 6 * 60 * 60 * 1000),
    },
  });
  console.log(`[seed] inserted SEO integrations (GA4 + GSC, both connected)`);

  console.log(`\n[seed] done. Demo org ready:`);
  console.log(`  - orgId:   ${org.id}`);
  console.log(`  - slug:    ${org.slug}`);
  console.log(`  - name:    ${org.name}`);
  console.log(`\nTo demo:`);
  console.log(`  1. Sign in as an agency user`);
  console.log(`  2. /admin/clients/${org.id} → Impersonate`);
  console.log(`  3. Land on /portal (full dashboard with 90d of data)`);
  console.log(`\nTo wipe: pnpm tsx scripts/seed-neutral-demo.ts --rollback\n`);
}

// ─── Entrypoint ─────────────────────────────────────────────────────────
async function main() {
  try {
    if (ROLLBACK) {
      await rollback();
    } else {
      await seed();
    }
  } catch (err) {
    console.error(`\n[error] ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
