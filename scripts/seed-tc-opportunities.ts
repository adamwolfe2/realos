/**
 * Seed 10 high-quality SeoActionRecommendation rows for Telegraph Commons
 * (SG Real Estate org) so the /portal/seo/recommendations Opportunities feed
 * has substance during the demo.
 *
 * Run with:
 *   DATABASE_URL=... pnpm exec tsx scripts/seed-tc-opportunities.ts
 *
 * Or rely on .env.production.local being autoloaded:
 *   pnpm exec tsx scripts/seed-tc-opportunities.ts
 *
 * Idempotent — upserts on the @@unique([orgId, propertyId, kind]) compound,
 * so re-running the script just refreshes the rows in place.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
import path from "node:path";

// Pull from .env.production.local if DATABASE_URL isn't already set.
// .env (loaded by dotenv/config) wins when present, this is a fallback.
dotenv.config({
  path: path.resolve(process.cwd(), ".env.production.local"),
  override: false,
});

import { prisma } from "../lib/db";
import {
  SeoActionCategory,
  SeoActionSeverity,
  SeoActionStatus,
} from "@prisma/client";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons

type RecSeed = {
  /** Stable id per (kind + scope) so re-runs upsert in place. */
  kind: string;
  category: SeoActionCategory;
  severity: SeoActionSeverity;
  title: string;
  detail: string;
  estimateMinutes: number;
  /** Composite ranking score — higher = more important. Mirrors severity. */
  score: number;
  actionLabel?: string;
  actionHref?: string;
  evidence?: Record<string, unknown>;
};

// Severity → default score band so the feed orders Critical > High > Medium > Low.
const SCORE_BY_SEVERITY: Record<SeoActionSeverity, number> = {
  CRITICAL: 95,
  HIGH: 80,
  MEDIUM: 60,
  LOW: 40,
};

const RECS: RecSeed[] = [
  // -- CRITICAL ---------------------------------------------------------------
  {
    kind: "setup-connect-search-console",
    // No GSC connection = no per-page audit data → Setup → Audit Needed bucket.
    category: SeoActionCategory.ONPAGE_AUDIT,
    severity: SeoActionSeverity.CRITICAL,
    title: "Connect Google Search Console",
    detail:
      "Telegraph Commons has no Search Console integration. Without GSC we can't track clicks, impressions, or which queries surface your pages — the most fundamental SEO measurement is dark until this is wired up. Unblocks 12 downstream KPIs.",
    estimateMinutes: 15,
    score: 99,
    actionLabel: "Connect GSC",
    actionHref: "/portal/seo/integrations",
    evidence: {
      signal: "missing_integration",
      integration: "google_search_console",
    },
  },
  {
    kind: "onpage-faq-schema-homepage",
    category: SeoActionCategory.SCHEMA_GAP,
    severity: SeoActionSeverity.CRITICAL,
    title: "Add FAQPage schema to the homepage",
    detail:
      "AI engines mention Telegraph Commons in 100% of relevant queries but cite a URL in 0% of them. Adding FAQPage schema to the homepage closes the gap between mention and citation — the highest-leverage AEO fix on the page. Expected lift: +15-30% citation rate.",
    estimateMinutes: 45,
    score: 96,
    actionLabel: "Draft FAQ block",
    actionHref: "/portal/content/new?format=faq&propertyId=" + PROPERTY_ID,
    evidence: {
      signal: "aeo_mention_no_citation",
      mentionRate: 1.0,
      citationRate: 0.0,
    },
  },

  // -- HIGH -------------------------------------------------------------------
  {
    kind: "content-counter-downtown-berkeley",
    category: SeoActionCategory.AEO_GAP,
    severity: SeoActionSeverity.HIGH,
    title: "Counter Downtown Berkeley in AI search answers",
    detail:
      "Downtown Berkeley shows up 4× in AI engine answers about Berkeley student apartments while Telegraph Commons doesn't surface at all. A side-by-side comparison page reliably ranks in AI answers within 30 days. Estimated lift: +4 AI mentions/month.",
    estimateMinutes: 120,
    score: 85,
    actionLabel: "Draft comparison post",
    actionHref: "/portal/content/new?format=blog&propertyId=" + PROPERTY_ID,
    evidence: {
      signal: "competitor_aeo_mentions",
      competitor: "Downtown Berkeley",
      mentions: 4,
    },
  },
  {
    kind: "setup-connect-ga4",
    // Connectivity is Setup → Basics — categorize-recommendation defaults
    // unmapped categories to that bucket; we use ONPAGE_AUDIT here too so
    // it lands under "Audit Needed" which is the closest semantic fit.
    category: SeoActionCategory.ONPAGE_AUDIT,
    severity: SeoActionSeverity.HIGH,
    title: "Connect Google Analytics 4",
    detail:
      "GA4 isn't linked. Without it the SEO Agent can't tie organic traffic to lease velocity, so 'this blog post drove 3 tours' becomes guesswork instead of fact. Required for ROI attribution on every content recommendation in this feed.",
    estimateMinutes: 20,
    score: 82,
    actionLabel: "Connect GA4",
    actionHref: "/portal/seo/integrations",
    evidence: {
      signal: "missing_integration",
      integration: "google_analytics_4",
    },
  },
  {
    kind: "neighborhood-southside-berkeley",
    category: SeoActionCategory.NEIGHBORHOOD_PAGE,
    severity: SeoActionSeverity.HIGH,
    title: "Write a neighborhood page for Southside Berkeley",
    detail:
      "Telegraph Commons sits in Southside Berkeley but has no /n/southside-berkeley page. Properties with at least one neighborhood page see 3× more long-tail organic searches in their first 60 days. Maps to the highest-intent local query cluster.",
    estimateMinutes: 90,
    score: 78,
    actionLabel: "Draft neighborhood page",
    actionHref:
      "/portal/content/new?format=neighborhood&propertyId=" + PROPERTY_ID,
    evidence: {
      signal: "missing_neighborhood_page",
      neighborhood: "Southside Berkeley",
      slug: "southside-berkeley",
    },
  },

  // -- MEDIUM -----------------------------------------------------------------
  {
    kind: "onpage-canonical-listing-pages",
    category: SeoActionCategory.ONPAGE_AUDIT,
    severity: SeoActionSeverity.MEDIUM,
    title: "Add canonical tags to listing pages",
    detail:
      "The Lighthouse audit flagged duplicate-canonical risk on the floorplan listing pages. Adding rel='canonical' to each prevents Google from splitting ranking signal across query-string variants (e.g. ?sort=price, ?beds=2).",
    estimateMinutes: 30,
    score: 62,
    evidence: {
      signal: "lighthouse_audit",
      issue: "missing_canonical",
      pages: ["/floorplans"],
    },
  },
  {
    kind: "offpage-google-business-profile",
    category: SeoActionCategory.BACKLINK_OPPORTUNITY,
    severity: SeoActionSeverity.MEDIUM,
    title: "Submit Telegraph Commons to Google Business Profile",
    detail:
      "Telegraph Commons doesn't appear in the Google Map Pack for 'student apartments Berkeley'. Claiming and verifying the GBP listing unlocks local 3-pack visibility — the single highest-intent surface for nearby UC Berkeley searches.",
    estimateMinutes: 30,
    score: 65,
    actionLabel: "Claim GBP",
    actionHref: "https://www.google.com/business/",
    evidence: {
      signal: "missing_local_listing",
      query: "student apartments Berkeley",
      surface: "google_map_pack",
    },
  },
  {
    kind: "onpage-lighthouse-performance",
    category: SeoActionCategory.ONPAGE_AUDIT,
    severity: SeoActionSeverity.MEDIUM,
    title: "Improve Lighthouse Performance score to 85+",
    detail:
      "Lighthouse Performance is 67/100. Lazy-load the hero image and remove the unused JS bundle to push past 85 — the threshold above which Google's page-experience signal starts to lift rankings on mobile organic results.",
    estimateMinutes: 60,
    score: 58,
    evidence: {
      signal: "lighthouse_audit",
      metric: "performance",
      current: 67,
      target: 85,
    },
  },

  // -- LOW --------------------------------------------------------------------
  {
    kind: "onpage-homepage-internal-links",
    category: SeoActionCategory.INTERNAL_LINKING,
    severity: SeoActionSeverity.LOW,
    title: "Add internal links from the homepage",
    detail:
      "The Telegraph Commons homepage only links to 3 internal URLs. Adding contextual links to /amenities, /floorplans, and /contact passes ranking signal deeper into the site and shortens the crawl path to high-intent pages.",
    estimateMinutes: 25,
    score: 42,
    evidence: {
      signal: "shallow_internal_linking",
      currentLinks: 3,
      recommendedLinks: 8,
    },
  },
  {
    kind: "content-about-page-localbusiness-schema",
    category: SeoActionCategory.CONTENT_GAP,
    severity: SeoActionSeverity.LOW,
    title: "Add an /about page with LocalBusiness schema",
    detail:
      "No /about page exists. A LocalBusiness + Place schema-tagged About page is what AI engines reach for when summarizing who you are — the canonical 'identity' source for both Google Knowledge Panel and Perplexity-style answer engines.",
    estimateMinutes: 75,
    score: 38,
    actionLabel: "Draft About page",
    actionHref: "/portal/content/new?format=page&propertyId=" + PROPERTY_ID,
    evidence: {
      signal: "missing_identity_page",
      page: "/about",
      schemas: ["LocalBusiness", "Place"],
    },
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL not set. Run with DATABASE_URL=... or ensure .env.production.local is present.",
    );
  }

  // Sanity check: confirm org + property still exist before we write anything.
  const [org, property] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ORG_ID },
      select: { id: true, name: true },
    }),
    prisma.property.findUnique({
      where: { id: PROPERTY_ID },
      select: { id: true, name: true, orgId: true },
    }),
  ]);

  if (!org) {
    throw new Error(`Organization ${ORG_ID} (SG Real Estate) not found.`);
  }
  if (!property) {
    throw new Error(`Property ${PROPERTY_ID} (Telegraph Commons) not found.`);
  }
  if (property.orgId !== ORG_ID) {
    throw new Error(
      `Property ${PROPERTY_ID} belongs to org ${property.orgId}, not ${ORG_ID}.`,
    );
  }

  console.log(
    `Seeding ${RECS.length} recommendations for ${property.name} (${org.name}).`,
  );

  const results: Array<{
    severity: SeoActionSeverity;
    category: SeoActionCategory;
    title: string;
    created: boolean;
  }> = [];

  for (const rec of RECS) {
    const score = rec.score ?? SCORE_BY_SEVERITY[rec.severity];

    const existing = await prisma.seoActionRecommendation.findUnique({
      where: {
        orgId_propertyId_kind: {
          orgId: ORG_ID,
          propertyId: PROPERTY_ID,
          kind: rec.kind,
        },
      },
      select: { id: true },
    });

    await prisma.seoActionRecommendation.upsert({
      where: {
        orgId_propertyId_kind: {
          orgId: ORG_ID,
          propertyId: PROPERTY_ID,
          kind: rec.kind,
        },
      },
      create: {
        orgId: ORG_ID,
        propertyId: PROPERTY_ID,
        kind: rec.kind,
        category: rec.category,
        severity: rec.severity,
        title: rec.title,
        detail: rec.detail,
        estimateMinutes: rec.estimateMinutes,
        score,
        actionLabel: rec.actionLabel ?? null,
        actionHref: rec.actionHref ?? null,
        status: SeoActionStatus.OPEN,
        snoozedUntil: null,
        evidence: (rec.evidence ?? undefined) as object | undefined,
      },
      update: {
        category: rec.category,
        severity: rec.severity,
        title: rec.title,
        detail: rec.detail,
        estimateMinutes: rec.estimateMinutes,
        score,
        actionLabel: rec.actionLabel ?? null,
        actionHref: rec.actionHref ?? null,
        status: SeoActionStatus.OPEN,
        snoozedUntil: null,
        evidence: (rec.evidence ?? undefined) as object | undefined,
        refreshedAt: new Date(),
      },
    });

    results.push({
      severity: rec.severity,
      category: rec.category,
      title: rec.title,
      created: !existing,
    });
  }

  const created = results.filter((r) => r.created).length;
  const refreshed = results.length - created;

  console.log("");
  console.log(
    `Done. Created ${created} new, refreshed ${refreshed} existing.`,
  );
  console.log("");
  console.log("Rows landed:");
  for (const r of results) {
    const tag = r.created ? "NEW    " : "REFRESH";
    console.log(`  ${tag}  [${r.severity.padEnd(8)}] ${r.category.padEnd(22)} ${r.title}`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
