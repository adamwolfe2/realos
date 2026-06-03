/**
 * tc-showcase-seed-aeo-v2 — populates the AEO v2 surfaces (W1 + W2 + W3)
 * for the Telegraph Commons SHOWCASE org so the new
 * /portal/seo/aeo cards aren't empty during Norman + sales demos.
 *
 * Target: cmp76brh80000nt3lxg5epqzt
 *   (Park & Pearl, Sage at Greenpoint, The Rhodes, Westbrook Commons)
 *
 * Seeds:
 *   W1 — AeoMentionSnapshot (4 properties × 4 engines × 5 prompts = 80
 *        rows). Realistic mix: TC mentioned ~35% of the time, top
 *        competitor "The Madison" ~45%, 6-8 other buildings rotated in
 *        as competitors. Reads as "you're in the conversation, gap to
 *        close" rather than "you dominate" or "you're invisible".
 *
 *   W2 — AeoOpportunityScore (12 rows, real-estate-flavored keywords
 *        with denormalized inputs that produce scores in the 40-78
 *        range — meaningful spread the operator can act on).
 *
 *   W2 — AeoOverviewSnapshot (5 rows for top GSC queries). 2 of 5 cite
 *        a TC property; 3 don't. Clear "we want to close the gap"
 *        story for the prospect.
 *
 *   W3 — AeoOnPageAudit (4 rows, one per property URL, scores 50-87).
 *        Plus a 4-row history per property so the recent-audits table
 *        has depth.
 *
 *   Supporting: SeoQuery 28-day window for the 12 keywords so the
 *               Opportunity Score's GSC inputs aren't fully synthetic.
 *
 * Idempotent: deleteMany() per table scoped to the showcase org
 * before each insert. Re-run safely.
 *
 * Production guards: refuses if VERCEL_ENV=production or the
 * connection string looks like a prod DB. Override with
 * I_KNOW_THIS_IS_NOT_PROD=true after triple-checking the connection.
 */

import { prisma } from "../lib/db";
import { AeoEngine } from "@prisma/client";

const SHOWCASE_ORG = "cmp76brh80000nt3lxg5epqzt";

// ---------------------------------------------------------------------------
// Production safety — mirrored from prisma/seed-demo.ts. We MUST NOT seed
// fake data into prod. If you genuinely need to run against a non-prod
// shared DB, set I_KNOW_THIS_IS_NOT_PROD=true after verifying the URL.
// ---------------------------------------------------------------------------
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.I_KNOW_THIS_IS_NOT_PROD !== "true"
) {
  throw new Error(
    "[tc-showcase-seed-aeo-v2] Refusing to run against VERCEL_ENV=production. " +
      "Override with I_KNOW_THIS_IS_NOT_PROD=true only after verifying the connection.",
  );
}

const ENGINES: AeoEngine[] = [
  AeoEngine.CHATGPT,
  AeoEngine.PERPLEXITY,
  AeoEngine.CLAUDE,
  AeoEngine.GEMINI,
];

// Polished, demo-ready prompts. Mix branded (high SoV) + discovery
// (medium SoV) so the chart tells a moat-vs-gap story.
const PROMPT_TEMPLATES = [
  (city: string) =>
    `What are the best luxury apartments in ${city} right now?`,
  (city: string) =>
    `Where should I rent in ${city} as a young professional?`,
  (city: string) => `Pet-friendly apartments near downtown ${city}?`,
  (city: string) =>
    `Modern apartments with a rooftop or gym in ${city}?`,
  (city: string) =>
    `New construction apartments in ${city} that include parking?`,
];

const COMPETITORS = [
  "The Madison",
  "Park Tower Residences",
  "1450 Broadway",
  "The Westchester",
  "Riverside Lofts",
  "Cedar Heights",
  "Sterling House",
  "The Belmont",
];

// Realistic GSC-shaped top-12 keywords. Picked to show meaningful spread
// in the Opportunity Score so the leaderboard isn't a flat line of 50s.
const OPPORTUNITY_SEEDS: Array<{
  keyword: string;
  gscClicks28d: number;
  gscImpressions28d: number;
  gscAvgPosition: number;
  aiSearchVolume: number;
  yourMentionCount: number;
  competitorMentionCount: number;
  onPageSeoScore: number | null;
}> = [
  {
    keyword: "luxury apartments downtown",
    gscClicks28d: 184,
    gscImpressions28d: 6_200,
    gscAvgPosition: 4.8,
    aiSearchVolume: 12_400,
    yourMentionCount: 3,
    competitorMentionCount: 11,
    onPageSeoScore: 78,
  },
  {
    keyword: "pet friendly apartments greenpoint",
    gscClicks28d: 92,
    gscImpressions28d: 3_400,
    gscAvgPosition: 6.2,
    aiSearchVolume: 4_200,
    yourMentionCount: 4,
    competitorMentionCount: 6,
    onPageSeoScore: 78,
  },
  {
    keyword: "modern apartments with gym",
    gscClicks28d: 71,
    gscImpressions28d: 5_800,
    gscAvgPosition: 8.9,
    aiSearchVolume: 6_900,
    yourMentionCount: 2,
    competitorMentionCount: 9,
    onPageSeoScore: 72,
  },
  {
    keyword: "new construction apartments",
    gscClicks28d: 56,
    gscImpressions28d: 4_100,
    gscAvgPosition: 9.4,
    aiSearchVolume: 8_100,
    yourMentionCount: 1,
    competitorMentionCount: 8,
    onPageSeoScore: 72,
  },
  {
    keyword: "rooftop apartments near downtown",
    gscClicks28d: 38,
    gscImpressions28d: 1_900,
    gscAvgPosition: 5.6,
    aiSearchVolume: 2_400,
    yourMentionCount: 3,
    competitorMentionCount: 4,
    onPageSeoScore: 78,
  },
  {
    keyword: "telegraph commons reviews",
    gscClicks28d: 142,
    gscImpressions28d: 480,
    gscAvgPosition: 1.4,
    aiSearchVolume: 320,
    yourMentionCount: 8,
    competitorMentionCount: 0,
    onPageSeoScore: 84,
  },
  {
    keyword: "apartments with parking included",
    gscClicks28d: 64,
    gscImpressions28d: 2_900,
    gscAvgPosition: 7.1,
    aiSearchVolume: 5_600,
    yourMentionCount: 2,
    competitorMentionCount: 7,
    onPageSeoScore: 72,
  },
  {
    keyword: "best apartments young professionals",
    gscClicks28d: 49,
    gscImpressions28d: 3_700,
    gscAvgPosition: 11.2,
    aiSearchVolume: 9_400,
    yourMentionCount: 1,
    competitorMentionCount: 10,
    onPageSeoScore: 76,
  },
  {
    keyword: "studio apartments downtown",
    gscClicks28d: 28,
    gscImpressions28d: 2_200,
    gscAvgPosition: 12.6,
    aiSearchVolume: 7_300,
    yourMentionCount: 0,
    competitorMentionCount: 8,
    onPageSeoScore: 76,
  },
  {
    keyword: "luxury 2 bedroom apartments",
    gscClicks28d: 41,
    gscImpressions28d: 2_500,
    gscAvgPosition: 8.3,
    aiSearchVolume: 5_100,
    yourMentionCount: 3,
    competitorMentionCount: 6,
    onPageSeoScore: 76,
  },
  {
    keyword: "apartments near transit",
    gscClicks28d: 35,
    gscImpressions28d: 2_100,
    gscAvgPosition: 9.8,
    aiSearchVolume: 3_800,
    yourMentionCount: 1,
    competitorMentionCount: 5,
    onPageSeoScore: 76,
  },
  {
    keyword: "park pearl apartments",
    gscClicks28d: 88,
    gscImpressions28d: 310,
    gscAvgPosition: 1.2,
    aiSearchVolume: 210,
    yourMentionCount: 6,
    competitorMentionCount: 0,
    onPageSeoScore: 81,
  },
];

// AI Overview snapshot — text per query. 2 of 5 cite a TC property (the
// branded queries reliably get a hit), 3 of 5 don't (the discovery
// queries surface competitors instead — that's the upside story).
const OVERVIEW_SEEDS: Array<{
  query: string;
  summary: string;
  citedHosts: string[]; // host-only — script resolves vs primary domain
  cited: boolean;
}> = [
  {
    query: "luxury apartments downtown",
    summary:
      "Downtown luxury rentals span a wide price band depending on building age and amenity package. New construction towers like The Madison and Park Tower Residences anchor the high end with on-site gyms, rooftop terraces, and concierge service. Mid-tier options on the eastern downtown edge offer studios from around $2,400/mo with shared amenity floors.",
    citedHosts: ["themadison.com", "parktowerresidences.com", "renting.com"],
    cited: false,
  },
  {
    query: "telegraph commons reviews",
    summary:
      "Telegraph Commons is a luxury rental community with mixed-but-trending-positive resident reviews. Residents consistently praise the rooftop, gym, and walkability; recurring complaints concern package room delays and weekend amenity crowding. Management has been responsive in the last six months according to Google and ApartmentRatings reviews.",
    citedHosts: ["telegraphcommons.com", "google.com/maps", "apartmentratings.com"],
    cited: true,
  },
  {
    query: "pet friendly apartments greenpoint",
    summary:
      "Greenpoint has multiple pet-friendly options including Sage at Greenpoint, The Westchester, and Riverside Lofts. Most charge a $300-500 one-time pet fee plus a small monthly rent. Sage at Greenpoint specifically advertises an on-site dog wash and fenced run, while The Westchester limits pet count to two.",
    citedHosts: ["sageatgreenpoint.com", "thewestchester.com", "petfriendlyrenting.com"],
    cited: true,
  },
  {
    query: "modern apartments with gym",
    summary:
      "Modern fitness-amenity rentals tend to be new construction. Park Tower Residences and 1450 Broadway both run on-site fitness centers with Peloton bikes and free weights. Cedar Heights includes a yoga studio. Most charge no separate gym fee but require a building tour to confirm hours.",
    citedHosts: ["parktowerresidences.com", "1450broadway.com", "cedarheights.com"],
    cited: false,
  },
  {
    query: "new construction apartments",
    summary:
      "The downtown market saw three major new-construction deliveries in the last 18 months: The Madison (242 units), Park Tower Residences (180), and Sterling House (96). All three include rooftop amenities, package rooms, and a fitness center. Rents typically run 10-15% above comparable buildings from before 2022.",
    citedHosts: ["themadison.com", "parktowerresidences.com", "sterlinghouse.com"],
    cited: false,
  },
];

// Per-property OnPage audit checklist results. Best-to-worst spread so
// the demo shows a clear "fix the weakest" story.
const PROPERTY_PAGE_AUDITS: Array<{
  propertyName: string; // exact match in Property.name
  scoreLatest: number;
  scoreHistory: number[]; // 3 prior runs for trend depth
  checkPasses: Record<string, boolean>;
}> = [
  {
    propertyName: "Sage at Greenpoint",
    scoreLatest: 87,
    scoreHistory: [75, 75, 87],
    checkPasses: {
      "faq-schema": true,
      "org-schema": true,
      "article-schema": true,
      canonical: true,
      "meta-description": true,
      "content-depth": true,
      "qa-structure": true,
      freshness: true,
    },
  },
  {
    propertyName: "Park & Pearl",
    scoreLatest: 75,
    scoreHistory: [62, 62, 75],
    checkPasses: {
      "faq-schema": true,
      "org-schema": true,
      "article-schema": false,
      canonical: true,
      "meta-description": true,
      "content-depth": true,
      "qa-structure": false,
      freshness: true,
    },
  },
  {
    propertyName: "The Rhodes",
    scoreLatest: 62,
    scoreHistory: [50, 50, 62],
    checkPasses: {
      "faq-schema": false,
      "org-schema": true,
      "article-schema": false,
      canonical: true,
      "meta-description": true,
      "content-depth": true,
      "qa-structure": false,
      freshness: true,
    },
  },
  {
    propertyName: "Westbrook Commons",
    scoreLatest: 50,
    scoreHistory: [38, 38, 50],
    checkPasses: {
      "faq-schema": false,
      "org-schema": false,
      "article-schema": false,
      canonical: true,
      "meta-description": false,
      "content-depth": true,
      "qa-structure": false,
      freshness: true,
    },
  },
];

const CHECK_LABELS: Record<string, string> = {
  "faq-schema": "FAQPage JSON-LD",
  "org-schema": "Organization JSON-LD",
  "article-schema": "Article JSON-LD",
  canonical: "Canonical URL",
  "meta-description": "Meta description (50-300 chars)",
  "content-depth": "Content depth (≥800 words)",
  "qa-structure": "Q&A structure (questions in H2/H3)",
  freshness: "Freshness (date < 1 year)",
};

const CHECK_PASS_REASONS: Record<string, string> = {
  "faq-schema": "Found FAQPage JSON-LD block.",
  "org-schema": "Found Organization/LocalBusiness JSON-LD.",
  "article-schema": "Found Article/NewsArticle/BlogPosting JSON-LD.",
  canonical: "Canonical points to the primary property URL.",
  "meta-description": "Meta description is 168 characters.",
  "content-depth": "1,420 words of visible body content.",
  "qa-structure": 'Found Q-form heading: "What\'s included in the rent?"',
  freshness: "Last updated 12 days ago.",
};

const CHECK_FAIL_REASONS: Record<string, string> = {
  "faq-schema":
    "No FAQPage JSON-LD found. AI engines disproportionately cite explicit FAQ markup.",
  "org-schema":
    "No Organization/LocalBusiness JSON-LD. Engines attribute citations to schema'd entities.",
  "article-schema":
    "No Article JSON-LD. Adds author + dateModified for AI citation attribution.",
  canonical:
    "No <link rel=canonical>. Engines may dedupe to a different URL than yours.",
  "meta-description":
    "Meta description is 38 chars — sweet spot is 50-300.",
  "content-depth":
    "Only 540 words. AI engines rarely cite pages too short to host a quotable answer (target ≥800).",
  "qa-structure":
    'No H2/H3 in question form (e.g. "What is …?"). AI engines disproportionately cite explicit Q&A.',
  freshness:
    "Last updated ~14 months ago. Stale dates discourage citation.",
};

function buildChecks(passes: Record<string, boolean>) {
  return Object.keys(CHECK_LABELS).map((key) => ({
    key,
    label: CHECK_LABELS[key],
    pass: passes[key],
    reason: passes[key] ? CHECK_PASS_REASONS[key] : CHECK_FAIL_REASONS[key],
  }));
}

// Build a mention list for an AeoMentionSnapshot. Returns ordered [self?,
// competitors..., others] with realistic positions. Driven by a target SoV.
function buildMentions(args: {
  targetSov: number; // 0-1 (probability brand mentioned at all)
  brandName: string;
  pool: string[];
  competitorCount: number; // how many competitors to include
}) {
  const mentions: Array<{
    name: string;
    kind: "self" | "competitor" | "other";
    position: number;
    citedUrl: string | null;
  }> = [];
  const includeSelf = Math.random() < args.targetSov;
  let pos = 1;
  if (includeSelf) {
    mentions.push({
      name: args.brandName,
      kind: "self",
      position: pos++,
      citedUrl: null,
    });
  }
  const shuffled = [...args.pool].sort(() => Math.random() - 0.5);
  const comps = shuffled.slice(0, args.competitorCount);
  for (const c of comps) {
    mentions.push({
      name: c,
      kind: "competitor",
      position: pos++,
      citedUrl: null,
    });
  }
  return mentions;
}

function computeShareOfVoice(
  mentions: Array<{ kind: "self" | "competitor" | "other" }>,
): number {
  if (mentions.length === 0) return 0;
  const self = mentions.filter((m) => m.kind === "self").length;
  const competitor = mentions.filter((m) => m.kind === "competitor").length;
  const denom = self + competitor;
  if (denom === 0) return 0;
  return self / denom;
}

(async () => {
  console.log("=== TC showcase AEO v2 (W1+W2+W3) seed ===\n");

  const props = await prisma.property.findMany({
    where: { orgId: SHOWCASE_ORG },
    select: { id: true, name: true, city: true, websiteUrl: true },
  });
  if (props.length === 0) throw new Error("No properties in showcase org");
  console.log(
    `Found ${props.length} properties: ${props.map((p) => p.name).join(", ")}`,
  );

  const today = Date.now();
  const DAY = 86_400_000;

  // ── W1: AeoMentionSnapshot ────────────────────────────────────────────
  console.log(`\n[1/5] Seeding AeoMentionSnapshot rows…`);
  await prisma.aeoMentionSnapshot.deleteMany({
    where: { orgId: SHOWCASE_ORG },
  });
  let snapInserted = 0;
  for (const prop of props) {
    const city = prop.city ?? "the area";
    for (const promptFn of PROMPT_TEMPLATES) {
      const prompt = promptFn(city);
      // Branded queries (those that literally contain the property name)
      // have a much higher target SoV. Detect by name fragment.
      const isBranded = prompt.toLowerCase().includes(prop.name.toLowerCase());
      for (const engine of ENGINES) {
        const targetSov = isBranded ? 0.95 : 0.35;
        const mentions = buildMentions({
          targetSov,
          brandName: prop.name,
          pool: COMPETITORS,
          competitorCount: 3 + Math.floor(Math.random() * 3),
        });
        const sov = computeShareOfVoice(mentions);
        // Spread captures over last 30d so the SoV widget has depth.
        const daysAgo = Math.floor(Math.random() * 28);
        await prisma.aeoMentionSnapshot.create({
          data: {
            orgId: SHOWCASE_ORG,
            propertyId: prop.id,
            engine,
            prompt,
            capturedAt: new Date(today - daysAgo * DAY),
            shareOfVoice: sov,
            mentions: mentions as unknown as object,
            externalId: `seed-${prop.id}-${engine}-${snapInserted}`,
            costUsd: 0.002,
            metadata: {
              source: "seed",
              surface: "property",
              demo: true,
            },
          },
        });
        snapInserted++;
      }
    }
  }
  console.log(
    `  ✓ ${snapInserted} mention snapshots across ${ENGINES.length} engines × ${PROMPT_TEMPLATES.length} prompts × ${props.length} properties`,
  );

  // ── W2: AeoOpportunityScore ───────────────────────────────────────────
  console.log(`\n[2/5] Seeding AeoOpportunityScore rows…`);
  await prisma.aeoOpportunityScore.deleteMany({
    where: { orgId: SHOWCASE_ORG },
  });
  let oppInserted = 0;
  for (const seed of OPPORTUNITY_SEEDS) {
    // Score formula (lib/aeo/opportunity-score.ts) reduces these inputs
    // to a real 0-100. We could call computeOpportunityScore here, but
    // matching the seed values to the formula is easier: just plug in
    // numbers and let the UI re-derive on render — page.tsx already
    // sorts by recomputed score.
    await prisma.aeoOpportunityScore.create({
      data: {
        orgId: SHOWCASE_ORG,
        keyword: seed.keyword,
        gscClicks28d: seed.gscClicks28d,
        gscImpressions28d: seed.gscImpressions28d,
        gscAvgPosition: seed.gscAvgPosition,
        aiSearchVolume: seed.aiSearchVolume,
        yourMentionCount: seed.yourMentionCount,
        competitorMentionCount: seed.competitorMentionCount,
        onPageSeoScore: seed.onPageSeoScore,
        score: 0, // re-derived by the UI; stored value is bookkeeping.
        computedAt: new Date(),
      },
    });
    oppInserted++;
  }
  console.log(`  ✓ ${oppInserted} opportunity scores seeded`);

  // ── W2: AeoOverviewSnapshot ───────────────────────────────────────────
  console.log(`\n[3/5] Seeding AeoOverviewSnapshot rows…`);
  await prisma.aeoOverviewSnapshot.deleteMany({
    where: { orgId: SHOWCASE_ORG },
  });
  // Resolve the org's primary host so the `cited` flag tracks reality
  // for the demo. Fallback: assume "telegraphcommons.com" since the
  // OVERVIEW_SEEDS prebake citation status anyway.
  const primary = await prisma.domainBinding.findFirst({
    where: { orgId: SHOWCASE_ORG, isPrimary: true },
    select: { hostname: true },
  });
  const primaryHost =
    primary?.hostname.toLowerCase().replace(/^www\./, "") ??
    "telegraphcommons.com";
  let overviewInserted = 0;
  for (const ov of OVERVIEW_SEEDS) {
    const citedUrls = ov.citedHosts.map((h) =>
      h === primaryHost ? `https://${primaryHost}/about` : `https://${h}/`,
    );
    const cited =
      ov.cited ||
      ov.citedHosts.some(
        (h) => h === primaryHost || h.endsWith(`.${primaryHost}`),
      );
    // Spread over last 14d so the latest-per-query reducer in the UI
    // picks a recent row.
    const daysAgo = Math.floor(Math.random() * 14);
    await prisma.aeoOverviewSnapshot.create({
      data: {
        orgId: SHOWCASE_ORG,
        query: ov.query,
        summary: ov.summary,
        citedUrls,
        cited,
        capturedAt: new Date(today - daysAgo * DAY),
        costUsd: 0.003,
      },
    });
    overviewInserted++;
  }
  console.log(`  ✓ ${overviewInserted} AI Overview snapshots seeded`);

  // ── W3: AeoOnPageAudit ─────────────────────────────────────────────────
  console.log(`\n[4/5] Seeding AeoOnPageAudit rows…`);
  await prisma.aeoOnPageAudit.deleteMany({
    where: { orgId: SHOWCASE_ORG },
  });
  let auditInserted = 0;
  for (const propAudit of PROPERTY_PAGE_AUDITS) {
    const prop = props.find((p) => p.name === propAudit.propertyName);
    if (!prop) {
      console.warn(
        `  (skipped) no property named "${propAudit.propertyName}"`,
      );
      continue;
    }
    const url =
      prop.websiteUrl ?? `https://${primaryHost}/properties/${prop.id}`;
    const checks = buildChecks(propAudit.checkPasses);
    const excerpt = `${prop.name} — Apartments in ${prop.city ?? "the area"} — Tour, floor plans, photos.`;

    // History: 3 prior runs spread over the last 90 days. Last run is
    // today (most recent), driving the "latest" panel.
    const historyDays = [60, 30, 12, 0];
    for (let i = 0; i < historyDays.length; i++) {
      const score = propAudit.scoreHistory[i] ?? propAudit.scoreLatest;
      const daysAgo = historyDays[i];
      await prisma.aeoOnPageAudit.create({
        data: {
          orgId: SHOWCASE_ORG,
          propertyId: prop.id,
          url,
          score,
          // History rows can use a slightly downgraded checklist
          // (fewer passes) so the score trend isn't an instant flat
          // line. For simplicity we reuse the latest checklist for the
          // newest run and zero out one pass per prior run.
          checks:
            i === historyDays.length - 1
              ? (checks as unknown as object)
              : (buildChecks(
                  Object.fromEntries(
                    Object.entries(propAudit.checkPasses).map(([k, v], idx) => [
                      k,
                      // Newer history runs have one fewer pass than the
                      // current. Older runs are flatter. Cap at 0.
                      v && idx >= historyDays.length - 1 - i ? false : v,
                    ]),
                  ) as Record<string, boolean>,
                ) as unknown as object),
          excerpt,
          capturedAt: new Date(today - daysAgo * DAY),
        },
      });
      auditInserted++;
    }
  }
  console.log(
    `  ✓ ${auditInserted} OnPage audits across ${PROPERTY_PAGE_AUDITS.length} properties (latest + 3-row history each)`,
  );

  // ── Supporting: SeoQuery for the Opportunity Score's GSC inputs ──────
  console.log(`\n[5/5] Seeding SeoQuery 28d window for opportunity keywords…`);
  await prisma.seoQuery.deleteMany({
    where: {
      orgId: SHOWCASE_ORG,
      date: { gte: new Date(today - 28 * DAY) },
      query: { in: OPPORTUNITY_SEEDS.map((s) => s.keyword) },
    },
  });
  let queryInserted = 0;
  for (const seed of OPPORTUNITY_SEEDS) {
    // Spread the 28-day clicks/impressions evenly across ~14 sampled
    // days so the in-memory aggregator in lib/aeo/score-opportunities.ts
    // reduces to a reasonable total. Floor of 1 row to avoid empty
    // windows.
    const sampledDays = 14;
    const clicksPerDay = Math.max(
      1,
      Math.round(seed.gscClicks28d / sampledDays),
    );
    const impressionsPerDay = Math.max(
      1,
      Math.round(seed.gscImpressions28d / sampledDays),
    );
    for (let i = 0; i < sampledDays; i++) {
      const date = new Date(today - i * 2 * DAY); // every other day
      try {
        await prisma.seoQuery.create({
          data: {
            orgId: SHOWCASE_ORG,
            date,
            query: seed.keyword,
            clicks: clicksPerDay,
            impressions: impressionsPerDay,
            ctr:
              impressionsPerDay > 0 ? clicksPerDay / impressionsPerDay : 0,
            position: seed.gscAvgPosition,
          },
        });
        queryInserted++;
      } catch {
        // Unique constraint (orgId, date, query) — ignore on collision
        // so re-runs after a partial wipe stay clean.
      }
    }
  }
  console.log(
    `  ✓ ${queryInserted} SeoQuery rows seeded across ${OPPORTUNITY_SEEDS.length} keywords`,
  );

  console.log(`\n=== TC showcase AEO v2 surfaces populated ===`);
  console.log(`Open /portal/seo/aeo on the showcase tenant to verify.\n`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
