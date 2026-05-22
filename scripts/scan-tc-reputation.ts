/**
 * Trigger a fresh reputation scan for Telegraph Commons / SG Real Estate.
 *
 * Goes around the portal /scan endpoint (which requires user auth) and
 * calls orchestrateScan() directly for each property that has at least
 * one external source configured (Google place, Yelp, or Reddit subreddits).
 *
 * Demo-prep: SG Real Estate has 127 properties, but only 5 are
 * "well-configured" — the rest will yield no mentions and waste Tavily quota.
 */

import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });

import { prisma } from "@/lib/db";
import { orchestrateScan } from "@/lib/reputation/orchestrate";
import type { PropertySeed } from "@/lib/reputation/types";

const ORG_SLUG = "telegraph-commons";

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: ORG_SLUG } });
  if (!org) throw new Error(`org ${ORG_SLUG} not found`);

  // Properties with at least Google or address — Tavily will work for any
  // property with a name + city, so we should not over-filter.
  const properties = await prisma.property.findMany({
    where: { orgId: org.id, lifecycle: 'ACTIVE' },
    select: {
      id: true,
      orgId: true,
      name: true,
      addressLine1: true,
      city: true,
      state: true,
      postalCode: true,
      propertyType: true,
      residentialSubtype: true,
      googlePlaceId: true,
      googleReviewUrl: true,
      yelpBusinessId: true,
      redditSubreddits: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Prioritize properties WITH sources configured first, then sample others.
  const withSources = properties.filter(
    (p) => p.googlePlaceId || p.googleReviewUrl || p.yelpBusinessId || (Array.isArray(p.redditSubreddits) && p.redditSubreddits.length > 0),
  );
  const target = withSources.length >= 3 ? withSources : properties.slice(0, 8);

  console.log(`[scan-tc-rep] org=${org.name} ${properties.length} total properties, ${withSources.length} with sources configured`);
  console.log(`[scan-tc-rep] scanning ${target.length} properties:`);
  target.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.city ?? '-'}, ${p.state ?? '-'}) google=${!!p.googlePlaceId} yelp=${!!p.yelpBusinessId} reddit=${Array.isArray(p.redditSubreddits) ? p.redditSubreddits.length : 0}`));

  let totalMentions = 0;
  let totalFailures = 0;

  for (const p of target) {
    const seed: PropertySeed = {
      id: p.id,
      orgId: p.orgId,
      name: p.name,
      addressLine1: p.addressLine1,
      city: p.city,
      state: p.state,
      postalCode: p.postalCode,
      propertyType: p.propertyType,
      residentialSubtype: p.residentialSubtype,
      googlePlaceId: p.googlePlaceId,
      googleReviewUrl: p.googleReviewUrl,
      yelpBusinessId: p.yelpBusinessId,
      redditSubreddits: Array.isArray(p.redditSubreddits) ? (p.redditSubreddits as string[]) : null,
    };
    console.log(`\n[scan-tc-rep] === ${p.name} ===`);
    const start = Date.now();
    let mentionCount = 0;
    const sourceErrors: Array<{ source: string; error: string }> = [];
    try {
      for await (const evt of orchestrateScan({ property: seed })) {
        if (evt.type === "mention_persisted") mentionCount++;
        if (evt.type === "source_failed") sourceErrors.push({ source: evt.source, error: evt.error });
        if (evt.type === "done") console.log(`  done status=${evt.status} mentions=${mentionCount} in ${((Date.now()-start)/1000).toFixed(1)}s`);
        if (evt.type === "error") {
          totalFailures++;
          console.log(`  ERROR: ${evt.message ?? '?'}`);
        }
      }
      totalMentions += mentionCount;
      if (sourceErrors.length) sourceErrors.forEach(se => console.log(`  source_failed: ${se.source} — ${se.error.slice(0, 100)}`));
    } catch (err) {
      totalFailures++;
      console.log(`  FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n[scan-tc-rep] TOTAL: ${totalMentions} new mentions persisted, ${totalFailures} property failures`);
  await prisma.$disconnect();
})().catch((err) => {
  console.error("scan-tc-rep FAILED:", err);
  process.exit(1);
});
