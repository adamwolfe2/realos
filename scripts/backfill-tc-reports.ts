/**
 * Backfill identifiedVisitors on existing TC ClientReport snapshots.
 *
 * Reports generated before the May 22 captured-contacts change stored
 * snapshots without the identifiedVisitors / identifiedVisitorsPct
 * fields. The view's defensive `?? 0` keeps them from crashing but they
 * still render "0 identified visitors" in the demo, which understates
 * the marketing surface area.
 *
 * For each TC ClientReport: count IDENTIFIED visitors with
 * firstSeenAt in the report's period window and patch the snapshot
 * JSON. Idempotent — running again yields the same numbers.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient, VisitorIdentificationStatus, Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("no TC org");

  const reports = await prisma.clientReport.findMany({
    where: { orgId: org.id },
    orderBy: { generatedAt: "desc" },
  });
  console.log(`Found ${reports.length} TC reports.`);

  for (const r of reports) {
    const periodStart = r.periodStart;
    const periodEnd = r.periodEnd;
    const priorMs = periodEnd.getTime() - periodStart.getTime();
    const priorEnd = periodStart;
    const priorStart = new Date(periodStart.getTime() - priorMs);

    const [current, prior] = await Promise.all([
      prisma.visitor.count({
        where: {
          orgId: org.id,
          status: { in: [VisitorIdentificationStatus.IDENTIFIED, VisitorIdentificationStatus.ENRICHED, VisitorIdentificationStatus.MATCHED_TO_LEAD] },
          firstSeenAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      prisma.visitor.count({
        where: {
          orgId: org.id,
          status: { in: [VisitorIdentificationStatus.IDENTIFIED, VisitorIdentificationStatus.ENRICHED, VisitorIdentificationStatus.MATCHED_TO_LEAD] },
          firstSeenAt: { gte: priorStart, lt: priorEnd },
        },
      }),
    ]);

    const pct = prior > 0 ? Math.round(((current - prior) / prior) * 100) : current > 0 ? 100 : null;

    const snap = r.snapshot as any;
    if (!snap || typeof snap !== "object") {
      console.log(`  ${r.id} (${periodStart.toISOString().slice(0,10)} - ${periodEnd.toISOString().slice(0,10)}) — snapshot missing/invalid, skipped`);
      continue;
    }
    snap.kpis = { ...(snap.kpis ?? {}), identifiedVisitors: current };
    snap.kpiDeltas = { ...(snap.kpiDeltas ?? {}), identifiedVisitorsPct: pct };

    await prisma.clientReport.update({
      where: { id: r.id },
      data: { snapshot: snap as Prisma.InputJsonValue },
    });
    console.log(`  ${r.id} (${periodStart.toISOString().slice(0,10)} - ${periodEnd.toISOString().slice(0,10)}) — identifiedVisitors=${current} (pct=${pct ?? "—"})`);
  }

  console.log(`\nDone. Reports now show 'Captured contacts' that includes both leads + identified visitors.`);
  await prisma.$disconnect();
})();
