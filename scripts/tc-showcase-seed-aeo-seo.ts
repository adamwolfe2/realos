/**
 * tc-showcase-seed-aeo-seo — populates AEO citation checks + SEO action
 * recs + competitor scans for the Telegraph Commons SHOWCASE org so
 * the AEO and SEO Agent surfaces aren't empty during Norman's demo.
 *
 * Target: cmp76brh80000nt3lxg5epqzt (4 properties: Park & Pearl, Sage
 * at Greenpoint, The Rhodes, Westbrook Commons).
 *
 * Seeds:
 *   - 80 AeoCitationCheck rows (4 properties × 4 engines × 5 prompts)
 *     Distribution: 50% COMPETITOR_CITED (the wedge), 25% NOT_CITED,
 *     25% CITED. Creates a clear "we're partially visible, need to
 *     close the gap" narrative.
 *   - 20 SeoActionRecommendation rows across the 4 properties, mix of
 *     severities. Maps to the categories: AEO_GAP, SCHEMA_GAP,
 *     CTR_FIX, NEIGHBORHOOD_PAGE, ONPAGE_AUDIT, REFRESH.
 *   - 16 PropertyCompetitorScan rows (4 properties × 4 competitors
 *     each) so the competitor intelligence shows real comps.
 */

import { prisma } from "../lib/db";
import {
  AeoEngine,
  AeoCitationStatus,
  SeoActionCategory,
  SeoActionSeverity,
  SeoActionStatus,
  CompetitorScanSource,
} from "@prisma/client";

const SHOWCASE_ORG = "cmp76brh80000nt3lxg5epqzt";

const ENGINES: AeoEngine[] = [
  AeoEngine.CHATGPT,
  AeoEngine.PERPLEXITY,
  AeoEngine.CLAUDE,
  AeoEngine.GEMINI,
];

const PROMPT_TEMPLATES = [
  (city: string) => `What are the best apartments in ${city}?`,
  (city: string) => `Where should I rent in ${city} as a young professional?`,
  (city: string) => `Pet-friendly apartments near downtown ${city}?`,
  (city: string) => `Modern apartments with a gym in ${city}?`,
  (city: string) => `Best new construction apartments in ${city}?`,
];

const COMPETITOR_POOLS: Record<string, string[]> = {
  default: [
    "The Madison",
    "Park Tower Residences",
    "1450 Broadway",
    "The Westchester",
    "Riverside Lofts",
    "Cedar Heights",
    "Sterling House",
    "The Belmont",
  ],
};

const SEO_ACTION_TEMPLATES = [
  {
    category: SeoActionCategory.AEO_GAP,
    kind: "aeo-gap-counter-page",
    title: "Counter top competitor in AI search answers",
    detail:
      "ChatGPT and Perplexity surfaced 4 competitors when prospects asked about apartments in your market. Draft a counter-page that positions your property's wedge (location, amenities, price point) so the engines start citing you instead.",
    severity: SeoActionSeverity.CRITICAL,
    estimateMinutes: 120,
    score: 92,
    actionLabel: "Draft counter-page",
  },
  {
    category: SeoActionCategory.SCHEMA_GAP,
    kind: "schema-faq",
    title: "Add FAQPage schema to the homepage",
    detail:
      "AI engines lean on structured data when answering 'apartments near me' queries. Your homepage has no FAQPage schema. Adding 5-7 question/answer pairs (tour scheduling, pet policy, deposit, parking, transit) would surface you in 'People also ask' panels and AI engine citations.",
    severity: SeoActionSeverity.CRITICAL,
    estimateMinutes: 45,
    score: 88,
    actionLabel: "Draft FAQ block",
  },
  {
    category: SeoActionCategory.CTR_FIX,
    kind: "ctr-low-position",
    title: "Rewrite meta title — ranking #3 with 1.8% CTR",
    detail:
      "Your homepage ranks #3 for 'apartments in [city]' but pulls only 1.8% CTR vs the 6.2% benchmark for that position. Title tag is generic. Rewrite to lead with location + a distinctive amenity hook.",
    severity: SeoActionSeverity.HIGH,
    estimateMinutes: 20,
    score: 79,
    actionLabel: "Rewrite title",
  },
  {
    category: SeoActionCategory.NEIGHBORHOOD_PAGE,
    kind: "neighborhood-page-missing",
    title: "Write a neighborhood page for the surrounding area",
    detail:
      "You're missing a /n/<neighborhood> page for the area where your property sits. Local-intent queries like 'apartments near <neighborhood>' currently land at competitor pages.",
    severity: SeoActionSeverity.HIGH,
    estimateMinutes: 90,
    score: 75,
    actionLabel: "Draft neighborhood page",
  },
  {
    category: SeoActionCategory.ONPAGE_AUDIT,
    kind: "onpage-lighthouse",
    title: "Fix LCP — Largest Contentful Paint at 3.8s",
    detail:
      "Lighthouse audit flagged the homepage hero image as the LCP element, loading at 3.8s on mobile. Compressing the hero and serving WebP would drop LCP below 2.5s and lift Lighthouse Performance from 62 to ~85.",
    severity: SeoActionSeverity.MEDIUM,
    estimateMinutes: 30,
    score: 64,
    actionLabel: "Run audit",
  },
  {
    category: SeoActionCategory.REFRESH,
    kind: "refresh-stale-content",
    title: "Refresh 'amenities' page — last updated 8 months ago",
    detail:
      "Google rewards freshness on real-estate pages. Your amenities page hasn't been touched in 8 months. A light refresh (new photos, updated copy on rooftop/gym hours, fresh resident quote) signals active management.",
    severity: SeoActionSeverity.MEDIUM,
    estimateMinutes: 25,
    score: 58,
    actionLabel: "Refresh page",
  },
  {
    category: SeoActionCategory.BACKLINK_OPPORTUNITY,
    kind: "backlink-local-listing",
    title: "Claim listing on local apartment aggregator",
    detail:
      "Two of your top-3 competitors are listed on a high-DR local aggregator that you're missing from. Claiming the listing adds a referring domain and surfaces your property in their 'apartments near me' filter.",
    severity: SeoActionSeverity.LOW,
    estimateMinutes: 15,
    score: 42,
    actionLabel: "Open submission form",
  },
];

(async () => {
  console.log("=== TC showcase AEO + SEO seed ===\n");

  const props = await prisma.property.findMany({
    where: { orgId: SHOWCASE_ORG },
    select: { id: true, name: true, city: true, websiteUrl: true },
  });
  if (props.length === 0) throw new Error("No properties in showcase org");
  console.log(`Found ${props.length} properties: ${props.map((p) => p.name).join(", ")}`);

  // ── 1. AEO citation checks ─────────────────────────────────────────────
  console.log(`\n[1/3] Seeding AeoCitationCheck rows…`);
  const competitorPool = COMPETITOR_POOLS.default;
  let aeoInserted = 0;
  const today = Date.now();
  const DAY = 86_400_000;

  // Wipe existing AEO data for this org first so re-runs are clean.
  await prisma.aeoCitationCheck.deleteMany({ where: { orgId: SHOWCASE_ORG } });

  for (const prop of props) {
    const city = prop.city ?? "the area";
    const propUrl = prop.websiteUrl ?? `https://${prop.name.toLowerCase().replace(/\s+/g, "")}.com`;

    for (const engine of ENGINES) {
      for (let pi = 0; pi < PROMPT_TEMPLATES.length; pi++) {
        const prompt = PROMPT_TEMPLATES[pi](city);
        // Distribution roll
        const r = Math.random();
        let status: AeoCitationStatus;
        let mentioned: boolean;
        let citedUrl: string | null = null;
        let competitorsCited: string[] = [];
        let position: number | null = null;
        let responseText = "";

        if (r < 0.25) {
          // 25% CITED — engine surfaces this property by name
          status = AeoCitationStatus.CITED;
          mentioned = true;
          citedUrl = propUrl;
          position = 1 + Math.floor(Math.random() * 3);
          responseText = `For modern apartments in ${city}, ${prop.name} stands out for its location, amenities, and resident reviews. Their website (${propUrl}) lists current availability and floor plans.`;
          // Sometimes a competitor also gets mentioned
          if (Math.random() < 0.4) {
            const comp = competitorPool[Math.floor(Math.random() * competitorPool.length)];
            competitorsCited = [comp];
            responseText += ` Other options to consider include ${comp}.`;
          }
        } else if (r < 0.75) {
          // 50% COMPETITOR_CITED — engine named rivals, not us (THE WEDGE)
          status = AeoCitationStatus.COMPETITOR_CITED;
          mentioned = false;
          // 2-4 competitors named
          const shuffled = [...competitorPool].sort(() => Math.random() - 0.5);
          competitorsCited = shuffled.slice(0, 2 + Math.floor(Math.random() * 3));
          responseText = `Some popular apartment options in ${city} include ${competitorsCited.join(", ")}. Each offers different amenities and price points worth comparing.`;
        } else {
          // 25% NOT_CITED — generic non-naming advice
          status = AeoCitationStatus.NOT_CITED;
          mentioned = false;
          responseText = `I don't have specific recommendations for individual apartment buildings in ${city}, but I'd suggest browsing Apartments.com or Zillow filtered by your budget and commute preferences to find current listings.`;
        }

        // Spread over last 21 days so the AEO timeline has data depth
        const daysAgo = Math.floor(Math.random() * 21);
        await prisma.aeoCitationCheck.create({
          data: {
            orgId: SHOWCASE_ORG,
            propertyId: prop.id,
            engine,
            prompt,
            queryRunAt: new Date(today - daysAgo * DAY),
            status,
            mentioned,
            position,
            responseText,
            citedUrl,
            competitorsCited,
          },
        });
        aeoInserted++;
      }
    }
  }
  console.log(`  ✓ ${aeoInserted} citation checks across ${ENGINES.length} engines × ${PROMPT_TEMPLATES.length} prompts × ${props.length} properties`);

  // ── 2. SEO action recommendations ──────────────────────────────────────
  console.log(`\n[2/3] Seeding SeoActionRecommendation rows…`);
  await prisma.seoActionRecommendation.deleteMany({ where: { orgId: SHOWCASE_ORG } });
  let seoInserted = 0;

  for (const prop of props) {
    // Each property gets 4-5 recs from the template pool
    const templatePool = [...SEO_ACTION_TEMPLATES];
    const pickCount = 4 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pickCount && templatePool.length > 0; i++) {
      const idx = Math.floor(Math.random() * templatePool.length);
      const tpl = templatePool.splice(idx, 1)[0];
      const daysAgo = Math.floor(Math.random() * 14);
      await prisma.seoActionRecommendation.create({
        data: {
          orgId: SHOWCASE_ORG,
          propertyId: prop.id,
          category: tpl.category,
          kind: tpl.kind,
          title: tpl.title,
          detail: tpl.detail,
          severity: tpl.severity,
          estimateMinutes: tpl.estimateMinutes,
          score: tpl.score,
          actionHref: tpl.category === SeoActionCategory.NEIGHBORHOOD_PAGE
            ? "/portal/seo/neighborhoods"
            : tpl.category === SeoActionCategory.AEO_GAP
              ? "/portal/seo/aeo"
              : tpl.category === SeoActionCategory.CTR_FIX
                ? "/portal/seo"
                : tpl.category === SeoActionCategory.ONPAGE_AUDIT
                  ? "/portal/seo"
                  : "/portal/content",
          actionLabel: tpl.actionLabel,
          status: SeoActionStatus.OPEN,
          generatedAt: new Date(today - daysAgo * DAY),
          updatedAt: new Date(today - daysAgo * DAY),
        },
      });
      seoInserted++;
    }
  }
  console.log(`  ✓ ${seoInserted} SEO action recommendations seeded`);

  // ── 3. Property competitor scans ───────────────────────────────────────
  console.log(`\n[3/3] Seeding PropertyCompetitorScan rows…`);
  await prisma.propertyCompetitorScan.deleteMany({
    where: { property: { orgId: SHOWCASE_ORG } },
  });
  let compInserted = 0;
  for (const prop of props) {
    const shuffled = [...competitorPool].sort(() => Math.random() - 0.5);
    const comps = shuffled.slice(0, 4);
    for (let i = 0; i < comps.length; i++) {
      const comp = comps[i];
      const daysAgo = Math.floor(Math.random() * 10);
      await prisma.propertyCompetitorScan.create({
        data: {
          orgId: SHOWCASE_ORG,
          propertyId: prop.id,
          competitorName: comp,
          competitorUrl: `https://${comp.toLowerCase().replace(/\s+/g, "")}.com`,
          source: CompetitorScanSource.GOOGLE_PLACES_NEARBY,
          rating: 3.8 + Math.random() * 1.0,
          reviewCount: 40 + Math.floor(Math.random() * 200),
          distanceMeters: 400 + Math.floor(Math.random() * 2400),
          scannedAt: new Date(today - daysAgo * DAY),
        },
      });
      compInserted++;
    }
  }
  console.log(`  ✓ ${compInserted} competitor scans seeded`);

  console.log(`\n=== Showcase AEO + SEO surfaces populated ===\n`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
