/**
 * tc-isolate — keep ONLY Telegraph Commons visible inside SG Real Estate.
 *
 * SG's AppFolio account has 127 properties; the operator only wants to
 * market Telegraph Commons through LeaseStack. Setting the other 126 to
 * lifecycle=EXCLUDED with lifecycleSetBy=OPERATOR hides them from every
 * operator-facing surface AND makes the change sticky — the next
 * AppFolio re-sync will NOT un-exclude them (the sync only re-classifies
 * rows whose lifecycle was last set by AUTO_CLASSIFIER).
 *
 * No data is deleted. AppFolio is the source of truth for the 126
 * buildings; they just won't appear in TC's portal view, dashboard
 * counts, marketplace, reports, etc.
 *
 * Also audits TC's per-property data so we know exactly what's
 * populated under "Telegraph Commons" vs at the org level.
 *
 * Run:
 *   DATABASE_URL=<unpooled-prod-url> ./node_modules/.bin/tsx scripts/tc-isolate.ts
 */

import { prisma } from "../lib/db";
import { PropertyLifecycle, PropertyLifecycleSource } from "@prisma/client";

const ORG_ID = "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
const TC_ID = "cmo402dzi0003c93lq9i6xz6h"; // Telegraph Commons

(async () => {
  console.log("=== TC isolate starting ===\n");

  // ── STEP 1: Confirm TC exists + is ACTIVE ────────────────────────────────
  const tc = await prisma.property.findUnique({
    where: { id: TC_ID },
    select: { id: true, name: true, lifecycle: true, lifecycleSetBy: true },
  });
  if (!tc) {
    throw new Error("Telegraph Commons row not found — aborting.");
  }
  console.log(
    `[verify] Telegraph Commons (${tc.id}): lifecycle=${tc.lifecycle} setBy=${tc.lifecycleSetBy}`,
  );
  // Always pin to ACTIVE + OPERATOR so future AppFolio re-syncs cannot
  // re-classify it. The classifier only respects rows whose lifecycleSetBy
  // is OPERATOR; AUTO_CLASSIFIER is overridable on every sync.
  if (
    tc.lifecycle !== PropertyLifecycle.ACTIVE ||
    tc.lifecycleSetBy !== PropertyLifecycleSource.OPERATOR
  ) {
    console.log(
      `  → Pinning to ACTIVE (lifecycleSetBy=OPERATOR) so AppFolio re-sync can't touch it`,
    );
    await prisma.property.update({
      where: { id: TC_ID },
      data: {
        lifecycle: PropertyLifecycle.ACTIVE,
        lifecycleSetBy: PropertyLifecycleSource.OPERATOR,
      },
    });
  }

  // ── STEP 2: Count what we're about to exclude ────────────────────────────
  const toExclude = await prisma.property.findMany({
    where: {
      orgId: ORG_ID,
      id: { not: TC_ID },
      lifecycle: { not: PropertyLifecycle.EXCLUDED },
    },
    select: { id: true, name: true, lifecycle: true, lifecycleSetBy: true },
  });
  console.log(`\n[1/2] Found ${toExclude.length} non-TC properties to EXCLUDE.`);
  console.log(`        Current breakdown:`);
  const byState = new Map<string, number>();
  for (const p of toExclude) {
    const key = `${p.lifecycle} (${p.lifecycleSetBy})`;
    byState.set(key, (byState.get(key) ?? 0) + 1);
  }
  for (const [k, v] of byState) console.log(`          · ${v}× ${k}`);

  if (toExclude.length === 0) {
    console.log(`        Nothing to do — already isolated.`);
  } else {
    const result = await prisma.property.updateMany({
      where: {
        orgId: ORG_ID,
        id: { not: TC_ID },
        lifecycle: { not: PropertyLifecycle.EXCLUDED },
      },
      data: {
        lifecycle: PropertyLifecycle.EXCLUDED,
        lifecycleSetBy: PropertyLifecycleSource.OPERATOR,
      },
    });
    console.log(
      `        ✓ Set lifecycle=EXCLUDED, lifecycleSetBy=OPERATOR on ${result.count} rows.`,
    );
    console.log(`        ✓ AppFolio re-sync will not re-include them (sticky).`);
  }

  // ── STEP 3: TC-specific data audit ───────────────────────────────────────
  console.log(`\n[2/2] Telegraph Commons data audit:`);
  const [
    tcInsights,
    tcMentions,
    tcCompetitorScans,
    tcSerpRankings,
    tcSeoActionRecs,
    tcAeoCitations,
    tcContentDrafts,
    tcLeads,
    tcVisitors,
    tcChats,
    tcOnPageAudits,
    tcBacklinks,
    tcListings,
  ] = await Promise.all([
    prisma.insight.groupBy({
      by: ["status", "severity"],
      where: { orgId: ORG_ID, propertyId: TC_ID },
      _count: { _all: true },
    }),
    prisma.propertyMention.count({ where: { orgId: ORG_ID, propertyId: TC_ID } }),
    prisma.propertyCompetitorScan.count({ where: { propertyId: TC_ID } }),
    prisma.serpRanking.count({ where: { propertyId: TC_ID } }).catch(() => 0),
    prisma.seoActionRecommendation.groupBy({
      by: ["status", "severity"],
      where: { orgId: ORG_ID, propertyId: TC_ID },
      _count: { _all: true },
    }),
    prisma.aeoCitationCheck.groupBy({
      by: ["status"],
      where: { orgId: ORG_ID, propertyId: TC_ID },
      _count: { _all: true },
    }),
    prisma.contentDraft.groupBy({
      by: ["status"],
      where: { orgId: ORG_ID, propertyId: TC_ID },
      _count: { _all: true },
    }),
    prisma.lead.count({ where: { orgId: ORG_ID, propertyId: TC_ID } }),
    prisma.visitor.count({ where: { orgId: ORG_ID, propertyId: TC_ID } }).catch(() => null),
    prisma.chatbotConversation.count({ where: { propertyId: TC_ID } }).catch(() => null),
    prisma.onPageAudit.count({ where: { propertyId: TC_ID } }).catch(() => 0),
    prisma.backlinkSummary.count({ where: { propertyId: TC_ID } }).catch(() => 0),
    prisma.listing.count({ where: { propertyId: TC_ID } }).catch(() => 0),
  ]);

  console.log(`        Leads:                 ${tcLeads}`);
  console.log(`        Visitors:              ${tcVisitors ?? "n/a (per-prop nullable)"}`);
  console.log(`        Chatbot conversations: ${tcChats ?? "n/a"}`);
  console.log(`        Listings:              ${tcListings}`);
  console.log(`        SEO recommendations:`);
  for (const g of tcSeoActionRecs)
    console.log(`          · ${g._count._all}× ${g.status}/${g.severity}`);
  console.log(`        SERP rankings:         ${tcSerpRankings}`);
  console.log(`        On-page audits:        ${tcOnPageAudits}`);
  console.log(`        Backlink summaries:    ${tcBacklinks}`);
  console.log(`        AEO citation checks:`);
  for (const g of tcAeoCitations)
    console.log(`          · ${g._count._all}× ${g.status}`);
  console.log(`        Property mentions:     ${tcMentions}`);
  console.log(`        Competitor scans:      ${tcCompetitorScans}`);
  console.log(`        Insights:`);
  for (const g of tcInsights)
    console.log(`          · ${g._count._all}× ${g.status}/${g.severity}`);
  console.log(`        Content drafts:`);
  for (const g of tcContentDrafts)
    console.log(`          · ${g._count._all}× ${g.status}`);

  // ── STEP 4: Final org-level check ────────────────────────────────────────
  const orgPropertyCounts = await prisma.property.groupBy({
    by: ["lifecycle"],
    where: { orgId: ORG_ID },
    _count: { _all: true },
  });
  console.log(`\nFinal SG Real Estate property breakdown:`);
  for (const g of orgPropertyCounts)
    console.log(`  · ${g._count._all}× ${g.lifecycle}`);

  console.log("\n=== TC isolate complete ===\n");
  await prisma.$disconnect();
})().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
