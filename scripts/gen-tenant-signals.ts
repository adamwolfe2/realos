// One-off: compute + persist a REAL tenant signal snapshot for an org so the
// /portal/insights page populates immediately (instead of waiting for the
// daily cron). Usage:
//   node --env-file=.env.production.local --import tsx scripts/gen-tenant-signals.ts <orgId>
import { computeSignals } from "@/lib/signals/compute";
import { persistSnapshot } from "@/lib/signals/persist";
import { prisma } from "@/lib/db";

async function main() {
  const orgId = process.argv[2] ?? "cmo402dwz0002c93lf3okkgi0"; // SG Real Estate
  const scope = { kind: "tenant" as const, orgId };
  console.log(`[signals] computing real snapshot for org ${orgId} …`);
  const snap = await computeSignals(scope);
  // Org-level key (tenant:orgId:_) — what the fixed page + daily cron read.
  await persistSnapshot(scope, snap);

  // Also persist under each LIVE property's scope key. The currently-deployed
  // page reads a per-property key for single-property orgs, so this makes the
  // real snapshot visible on the live site immediately (pre-deploy). Same
  // org-level data, just mirrored under the property scope.
  const liveProps = await prisma.property.findMany({
    where: { orgId, lifecycle: "ACTIVE" },
    select: { id: true },
  });
  for (const p of liveProps) {
    await persistSnapshot({ kind: "tenant", orgId, propertyId: p.id }, snap);
  }
  console.log(`[signals] mirrored to ${liveProps.length} live-property scope(s)`);
  const summary = {
    overallScore: snap.overallScore,
    seo: snap.seo && {
      score: snap.seo.score,
      organicKeywords: snap.seo.organicKeywords,
      avgPosition: snap.seo.avgPosition,
    },
    aeo: snap.aeo && {
      score: snap.aeo.score,
      enginesChecked: snap.aeo.enginesChecked,
      citationsFound: snap.aeo.citationsFound,
    },
    reputation: snap.reputation && {
      score: snap.reputation.score,
      totalMentions: snap.reputation.totalMentions,
      avgRating: snap.reputation.avgRating,
    },
    chatbot: snap.chatbot && {
      score: snap.chatbot.score,
      conversations: snap.chatbot.conversations,
    },
    leads: snap.leads && {
      score: snap.leads.score,
      newLeads: snap.leads.newLeads,
      qualified: snap.leads.qualified,
    },
    traffic: snap.traffic && {
      score: snap.traffic.score,
      sessions: snap.traffic.sessions,
    },
  };
  console.log("[signals] persisted:", JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[signals] FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
