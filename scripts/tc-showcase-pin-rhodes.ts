/**
 * Pins The Rhodes as the featured property on the showcase dashboard by
 * (a) seeding 12 weeks of SeoScoreHistory with a clear upward trend,
 * (b) ensuring it has the most score-history depth so the page-side
 *     ranking rule (score-history desc → rating desc → name asc) picks
 *     it over the other three properties.
 *
 * Also populates the score-history chart on /portal/properties/[id] for
 * The Rhodes so it doesn't look empty during a property-detail drill.
 */

import { prisma } from "../lib/db";

const SHOWCASE_ORG = "cmp76brh80000nt3lxg5epqzt";
const RHODES_ID = "cmpanijj50004l53l0dae0srj";

(async () => {
  // Verify the property + org match
  const prop = await prisma.property.findUnique({
    where: { id: RHODES_ID },
    select: { name: true, orgId: true },
  });
  if (!prop || prop.orgId !== SHOWCASE_ORG) {
    throw new Error(`Property ${RHODES_ID} not in showcase org`);
  }
  console.log(`Pinning ${prop.name} as featured`);

  // Clear any prior history for this property to make re-runs clean
  await prisma.seoScoreHistory.deleteMany({
    where: { orgId: SHOWCASE_ORG, propertyId: RHODES_ID },
  });

  // Build 12 weeks of Monday anchors going back from this past Monday.
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const lastMonday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceMonday,
      0,
      0,
      0,
      0,
    ),
  );

  const weeks: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    weeks.push(new Date(lastMonday.getTime() - i * 7 * 86400000));
  }

  // Upward-trending scores. Start at ~52, climb to ~84 with realistic noise.
  let inserted = 0;
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    const progress = i / (weeks.length - 1); // 0..1
    const base = Math.round(52 + progress * 32);
    const noise = () => Math.round((Math.random() - 0.5) * 6);
    const tech = clamp(base + 4 + noise(), 30, 95);
    const content = clamp(base - 2 + noise(), 25, 90);
    const authority = clamp(base - 6 + noise(), 20, 85);
    const composite = Math.round((tech + content + authority) / 3);
    const aeoRate = 0.04 + progress * 0.32 + (Math.random() - 0.5) * 0.04;
    const trafficIdx = Math.round(base + 6 + noise());
    const conversionIdx = Math.round(base + 2 + noise());

    await prisma.seoScoreHistory.create({
      data: {
        orgId: SHOWCASE_ORG,
        propertyId: RHODES_ID,
        weekOf: week,
        technicalScore: tech,
        contentScore: content,
        authorityScore: authority,
        aeoCitationRate: Math.max(0, Math.min(1, aeoRate)),
        organicTrafficIdx: trafficIdx,
        conversionRateIdx: conversionIdx,
        compositeScore: composite,
      },
    });
    inserted++;
  }
  console.log(`Inserted ${inserted} weekly SeoScoreHistory rows for The Rhodes`);

  // Confirm
  const counts = await prisma.seoScoreHistory.groupBy({
    by: ["propertyId"],
    where: {
      propertyId: {
        in: [
          "cmpanijj40001l53lpn71w72i", // Westbrook
          "cmpanijj40002l53lhrh2jow0", // Park & Pearl
          "cmpanijj50003l53l0d2p12to", // Sage
          "cmpanijj50004l53l0dae0srj", // Rhodes
        ],
      },
    },
    _count: { _all: true },
  });
  console.log("\nFinal score-history counts (higher = wins featured slot):");
  for (const c of counts) {
    console.log(`  ${c.propertyId} → ${c._count._all} rows`);
  }
  await prisma.$disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
