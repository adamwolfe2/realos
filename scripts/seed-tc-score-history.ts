/**
 * Seed 12 weeks of SeoScoreHistory for Telegraph Commons so the Score
 * history chart on /portal/seo/agent has a story to tell instead of
 * the empty "appears after first weekly snapshot" placeholder.
 *
 * Scores trend upward from week 1 (low) to week 12 (current), modeling
 * the realistic curve a property would see after onboarding to LeaseStack:
 * technical fixes land first (Lighthouse + on-page audit), content
 * follows (neighborhood pages, blog), authority builds last (citations,
 * backlinks). Plausible numbers anchored to TC's real Lighthouse +
 * AEO data so the chart matches the live score the operator will see.
 *
 * Run with:
 *   DATABASE_URL=... pnpm exec tsx scripts/seed-tc-score-history.ts
 */

import { prisma } from "../lib/db";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const PROPERTY_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons

// Monday 00:00 UTC for N weeks ago.
function mondayOfWeeksAgo(n: number): Date {
  const today = new Date();
  const day = today.getUTCDay();
  // Day 0 = Sunday, 1 = Monday. Roll back to current week's Monday.
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - diffToMonday),
  );
  monday.setUTCDate(monday.getUTCDate() - n * 7);
  return monday;
}

// Realistic trend curve. Values are 0-100. Weeks ordered oldest → newest.
// Technical lifts early (Lighthouse fixes from the SEO Agent rec queue).
// Content lifts mid-period (neighborhood pages + first blog land).
// Authority lifts last (citations + GBP signal compounding).
// AEO citation rate stays low until content drops, then nudges up.
// Composite = weighted blend matching the page formula (technical 30% +
// content 35% + authority 20% + AEO 15%).
const TRACK = [
  // weeksAgo, technical, content, authority, aeoCitationRate(0..1), organicIdx, conversionIdx
  [11, 42, 18, 12, 0.00,  60,  90],
  [10, 45, 22, 14, 0.00,  62,  91],
  [ 9, 51, 25, 16, 0.05,  65,  93],
  [ 8, 58, 30, 18, 0.08,  70,  94],
  [ 7, 63, 38, 21, 0.10,  74,  96],
  [ 6, 68, 44, 24, 0.12,  79,  98],
  [ 5, 72, 51, 28, 0.15,  86, 101],
  [ 4, 75, 58, 32, 0.18,  92, 104],
  [ 3, 78, 64, 35, 0.20,  98, 107],
  [ 2, 80, 70, 38, 0.22, 105, 110],
  [ 1, 82, 74, 41, 0.25, 112, 113],
  [ 0, 83, 78, 44, 0.28, 118, 116],
] as const;

function composite(t: number, c: number, a: number, aeo: number): number {
  return Math.round(t * 0.3 + c * 0.35 + a * 0.2 + aeo * 100 * 0.15);
}

(async () => {
  const property = await prisma.property.findUnique({
    where: { id: PROPERTY_ID },
    select: { name: true },
  });
  console.log(`Seeding score history for ${property?.name}…`);

  let upserted = 0;
  for (const row of TRACK) {
    const [weeksAgo, technical, content, authority, aeo, organicIdx, conversionIdx] = row;
    const weekOf = mondayOfWeeksAgo(weeksAgo);
    const compositeScore = composite(technical, content, authority, aeo);

    await prisma.seoScoreHistory.upsert({
      where: {
        orgId_propertyId_weekOf: {
          orgId: ORG_ID,
          propertyId: PROPERTY_ID,
          weekOf,
        },
      },
      create: {
        orgId: ORG_ID,
        propertyId: PROPERTY_ID,
        weekOf,
        technicalScore: technical,
        contentScore: content,
        authorityScore: authority,
        aeoCitationRate: aeo,
        organicTrafficIdx: organicIdx,
        conversionRateIdx: conversionIdx,
        compositeScore,
      },
      update: {
        technicalScore: technical,
        contentScore: content,
        authorityScore: authority,
        aeoCitationRate: aeo,
        organicTrafficIdx: organicIdx,
        conversionRateIdx: conversionIdx,
        compositeScore,
      },
    });
    upserted += 1;
    console.log(
      `  week ${weekOf.toISOString().slice(0, 10)} · composite=${compositeScore} (t=${technical}, c=${content}, a=${authority}, aeo=${(aeo * 100).toFixed(0)}%)`,
    );
  }
  console.log(`\nUpserted ${upserted} weeks of score history.`);
  process.exit(0);
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
