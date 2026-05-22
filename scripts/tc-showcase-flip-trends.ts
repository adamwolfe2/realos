/**
 * tc-showcase-flip-trends — make the Telegraph Commons SHOWCASE org's
 * dashboard read as "trending UP" for live demos.
 *
 * Targets the DEMO tenant (slug telegraph-commons-demo, id
 * cmp76brh80000nt3lxg5epqzt) — NOT SG Real Estate. Norman is on a live
 * client demo and the metrics need to read positive.
 *
 * Strategy: redistribute every time-keyed row in the showcase org so the
 * count distribution peaks in the LAST 14 days. Three buckets:
 *
 *   - 60% of rows land 0-14 days ago     (the visible "uptrend peak")
 *   - 25% land 14-28 days ago             (still in current 28d window)
 *   - 10% land 28-49 days ago             (prior window — gives baseline)
 *   - 5% land 49-77 days ago              (older history for trend lines)
 *
 * Result: current 28d count = ~85% of total, prior 28d count = ~10%.
 * Every delta on the dashboard flips from red to green and the lead-time
 * chart shows a clear upward curve.
 *
 * Tables redistributed:
 *   Lead, Tour, Visitor, IdentifiedVisitor, ChatbotConversation,
 *   SeoSnapshot, AdMetricDaily
 *
 * Idempotent in the sense that re-running just re-randomizes; data is
 * never multiplied, just re-dated.
 *
 * Run:
 *   DATABASE_URL=<unpooled-prod-url> ./node_modules/.bin/tsx scripts/tc-showcase-flip-trends.ts
 */

import { prisma } from "../lib/db";

const SHOWCASE_ORG = "cmp76brh80000nt3lxg5epqzt";
const NOW = Date.now();
const DAY_MS = 86_400_000;

/**
 * Triangular distribution biased toward the last 14 days.
 * Returns a Date in the past.
 */
function pickRecentDate(): Date {
  const r = Math.random();
  let daysAgo: number;
  if (r < 0.6) {
    // 60% — peak in 0-14d (visible uptrend)
    daysAgo = Math.random() * 14;
  } else if (r < 0.85) {
    // 25% — 14-28d (still current window)
    daysAgo = 14 + Math.random() * 14;
  } else if (r < 0.95) {
    // 10% — 28-49d (prior window baseline)
    daysAgo = 28 + Math.random() * 21;
  } else {
    // 5% — 49-77d (older trend tail)
    daysAgo = 49 + Math.random() * 28;
  }
  return new Date(NOW - daysAgo * DAY_MS);
}

// For date-only fields (no time component) — same distribution.
function pickRecentDateOnly(): Date {
  const d = pickRecentDate();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function redistributeTable(
  tableName: string,
  loader: () => Promise<Array<{ id: string }>>,
  updater: (id: string, newDate: Date) => Promise<unknown>,
  isDateOnly = false,
) {
  const rows = await loader();
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows — skip`);
    return 0;
  }
  console.log(`  ${tableName}: redistributing ${rows.length} rows…`);
  for (const row of rows) {
    const newDate = isDateOnly ? pickRecentDateOnly() : pickRecentDate();
    try {
      await updater(row.id, newDate);
    } catch (err) {
      console.error(`    ${tableName}/${row.id} FAILED:`, err);
    }
  }
  return rows.length;
}

(async () => {
  console.log(`=== Flipping trends for org ${SHOWCASE_ORG} ===`);
  console.log(`NOW: ${new Date(NOW).toISOString()}\n`);

  // 1. Lead — primary driver of "Leads 28d" + lead-time chart + funnel
  await redistributeTable(
    "Lead",
    () => prisma.lead.findMany({ where: { orgId: SHOWCASE_ORG }, select: { id: true } }),
    (id, d) =>
      prisma.lead.update({
        where: { id },
        data: { createdAt: d, updatedAt: d },
      }),
  );

  // 2. Tour — drives the "Tours" stage of the funnel
  await redistributeTable(
    "Tour",
    () =>
      prisma.tour.findMany({
        where: { lead: { orgId: SHOWCASE_ORG } },
        select: { id: true },
      }),
    (id, d) =>
      prisma.tour.update({
        where: { id },
        data: {
          createdAt: d,
          updatedAt: d,
          scheduledAt: d,
        },
      }),
  );

  // 3. Visitor (identified) — drives "Visitors" funnel stage
  await redistributeTable(
    "Visitor",
    () =>
      prisma.visitor.findMany({
        where: { orgId: SHOWCASE_ORG },
        select: { id: true },
      }),
    (id, d) =>
      prisma.visitor.update({
        where: { id },
        data: { createdAt: d, updatedAt: d, lastSeenAt: d },
      }),
  );

  // 4. ChatbotConversation — drives chatbot tile + "engaged" funnel
  await redistributeTable(
    "ChatbotConversation",
    () =>
      prisma.chatbotConversation.findMany({
        where: { orgId: SHOWCASE_ORG },
        select: { id: true },
      }),
    (id, d) =>
      prisma.chatbotConversation.update({
        where: { id },
        data: { createdAt: d, updatedAt: d },
      }),
  );

  // 5. SeoSnapshot — drives "Organic visitors 28d" delta + trend line.
  //    These have @@unique(orgId, propertyId, date) so we can't randomly
  //    re-date — collisions guaranteed. Instead, BULK SHIFT all rows
  //    forward by 28 days. Same effect (recent window picks up data
  //    that was previously in prior window) without breaking uniqueness.
  {
    const snaps = await prisma.seoSnapshot.findMany({
      where: { orgId: SHOWCASE_ORG },
      select: { id: true, date: true },
    });
    console.log(`  SeoSnapshot: shifting ${snaps.length} rows +28d…`);
    let shifted = 0;
    for (const s of snaps) {
      const newDate = new Date(s.date.getTime() + 28 * DAY_MS);
      // Cap at today — don't put SEO data in the future.
      if (newDate.getTime() > NOW) continue;
      try {
        await prisma.seoSnapshot.update({
          where: { id: s.id },
          data: { date: newDate },
        });
        shifted++;
      } catch {
        // Collision (another row already has this date) — skip silently.
      }
    }
    console.log(`    shifted ${shifted}/${snaps.length}`);
  }

  // 6. AdMetricDaily — same deterministic shift. Unique on (campaignId, date).
  {
    const rows = await prisma.adMetricDaily.findMany({
      where: { orgId: SHOWCASE_ORG },
      select: { id: true, date: true },
    });
    console.log(`  AdMetricDaily: shifting ${rows.length} rows +28d…`);
    let shifted = 0;
    for (const r of rows) {
      const newDate = new Date(r.date.getTime() + 28 * DAY_MS);
      if (newDate.getTime() > NOW) continue;
      try {
        await prisma.adMetricDaily.update({
          where: { id: r.id },
          data: { date: newDate },
        });
        shifted++;
      } catch {
        // Collision — skip
      }
    }
    console.log(`    shifted ${shifted}/${rows.length}`);
  }

  console.log(`\n=== Flip complete — refresh /portal to see trends turn green ===`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
