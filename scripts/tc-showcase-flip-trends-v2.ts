/**
 * tc-showcase-flip-trends-v2 — second pass: amplify VALUES in the recent
 * 28d window and deflate values in the prior 28d window. Targets
 * SeoSnapshot (organic visitors) + AdMetricDaily (ad spend) which can't
 * be re-dated due to unique constraints on (orgId|propertyId|campaignId,
 * date).
 *
 * Rules:
 *   - Last 28d:    × 1.6 (creates a sharp recent uptrend)
 *   - 28-56d ago:  × 0.55 (drops the baseline so delta swings positive)
 *   - Older:       untouched
 *
 * Result: every KPI tile reads green, every trend line slopes up.
 */

import { prisma } from "../lib/db";

const SHOWCASE_ORG = "cmp76brh80000nt3lxg5epqzt";

(async () => {
  const now = new Date();
  const cutoff28 = new Date(now.getTime() - 28 * 86400000);
  const cutoff56 = new Date(now.getTime() - 56 * 86400000);

  console.log("=== TC showcase value amplification ===");
  console.log(`current window: ${cutoff28.toISOString()} → ${now.toISOString()}`);
  console.log(`prior window:   ${cutoff56.toISOString()} → ${cutoff28.toISOString()}\n`);

  // ── SeoSnapshot: boost sessions, users, organic clicks in recent ──────
  const seoBoost = await prisma.$executeRaw`
    UPDATE "SeoSnapshot"
    SET
      "organicSessions"  = ROUND("organicSessions"  * 1.6)::int,
      "organicUsers"     = ROUND("organicUsers"     * 1.6)::int,
      "totalImpressions" = ROUND("totalImpressions" * 1.6)::int,
      "totalClicks"      = ROUND("totalClicks"      * 1.6)::int
    WHERE "orgId" = ${SHOWCASE_ORG}
      AND "date" >= ${cutoff28};
  `;
  console.log(`SeoSnapshot recent ×1.6: ${seoBoost} rows`);

  const seoDeflate = await prisma.$executeRaw`
    UPDATE "SeoSnapshot"
    SET
      "organicSessions"  = ROUND("organicSessions"  * 0.55)::int,
      "organicUsers"     = ROUND("organicUsers"     * 0.55)::int,
      "totalImpressions" = ROUND("totalImpressions" * 0.55)::int,
      "totalClicks"      = ROUND("totalClicks"      * 0.55)::int
    WHERE "orgId" = ${SHOWCASE_ORG}
      AND "date" >= ${cutoff56}
      AND "date" < ${cutoff28};
  `;
  console.log(`SeoSnapshot prior ×0.55: ${seoDeflate} rows`);

  // ── AdMetricDaily: same pattern on impressions/clicks/spend/conversions ──
  const adBoost = await prisma.$executeRaw`
    UPDATE "AdMetricDaily"
    SET
      "impressions" = ROUND("impressions" * 1.6)::int,
      "clicks"      = ROUND("clicks" * 1.6)::int,
      "spendCents"  = ROUND("spendCents" * 1.6)::int,
      "conversions" = "conversions" * 1.6
    WHERE "orgId" = ${SHOWCASE_ORG}
      AND "date" >= ${cutoff28};
  `;
  console.log(`AdMetricDaily recent ×1.6: ${adBoost} rows`);

  const adDeflate = await prisma.$executeRaw`
    UPDATE "AdMetricDaily"
    SET
      "impressions" = ROUND("impressions" * 0.55)::int,
      "clicks"      = ROUND("clicks" * 0.55)::int,
      "spendCents"  = ROUND("spendCents" * 0.55)::int,
      "conversions" = "conversions" * 0.55
    WHERE "orgId" = ${SHOWCASE_ORG}
      AND "date" >= ${cutoff56}
      AND "date" < ${cutoff28};
  `;
  console.log(`AdMetricDaily prior ×0.55: ${adDeflate} rows`);

  // ── Sanity check: print current vs prior totals so we know it flipped ──
  const seoCurrent = await prisma.seoSnapshot.aggregate({
    where: { orgId: SHOWCASE_ORG, date: { gte: cutoff28 } },
    _sum: { organicSessions: true, totalClicks: true },
  });
  const seoPrior = await prisma.seoSnapshot.aggregate({
    where: {
      orgId: SHOWCASE_ORG,
      date: { gte: cutoff56, lt: cutoff28 },
    },
    _sum: { organicSessions: true, totalClicks: true },
  });
  const adCurrent = await prisma.adMetricDaily.aggregate({
    where: { orgId: SHOWCASE_ORG, date: { gte: cutoff28 } },
    _sum: { spendCents: true, clicks: true, conversions: true },
  });
  const adPrior = await prisma.adMetricDaily.aggregate({
    where: {
      orgId: SHOWCASE_ORG,
      date: { gte: cutoff56, lt: cutoff28 },
    },
    _sum: { spendCents: true, clicks: true, conversions: true },
  });
  const leadCurrent = await prisma.lead.count({
    where: { orgId: SHOWCASE_ORG, createdAt: { gte: cutoff28 } },
  });
  const leadPrior = await prisma.lead.count({
    where: {
      orgId: SHOWCASE_ORG,
      createdAt: { gte: cutoff56, lt: cutoff28 },
    },
  });

  console.log(`\n=== Post-flip deltas ===`);
  console.log(
    `Leads:    ${leadCurrent} current vs ${leadPrior} prior (delta ${
      leadPrior > 0
        ? Math.round(((leadCurrent - leadPrior) / leadPrior) * 100) + "%"
        : "—"
    })`,
  );
  console.log(
    `Organic:  ${seoCurrent._sum.organicSessions ?? 0} current vs ${
      seoPrior._sum.organicSessions ?? 0
    } prior (delta ${
      (seoPrior._sum.organicSessions ?? 0) > 0
        ? Math.round(
            (((seoCurrent._sum.organicSessions ?? 0) -
              (seoPrior._sum.organicSessions ?? 0)) /
              (seoPrior._sum.organicSessions ?? 1)) *
              100,
          ) + "%"
        : "—"
    })`,
  );
  console.log(
    `Ad spend: $${Math.round((adCurrent._sum.spendCents ?? 0) / 100).toLocaleString()} current vs $${Math.round(
      (adPrior._sum.spendCents ?? 0) / 100,
    ).toLocaleString()} prior (delta ${
      (adPrior._sum.spendCents ?? 0) > 0
        ? Math.round(
            (((adCurrent._sum.spendCents ?? 0) -
              (adPrior._sum.spendCents ?? 0)) /
              (adPrior._sum.spendCents ?? 1)) *
              100,
          ) + "%"
        : "—"
    })`,
  );
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
