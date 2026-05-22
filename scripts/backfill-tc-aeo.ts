/** Backfill aeoStats on TC ClientReport snapshots so the demo shows real
 * AEO data without waiting for the next cron tick. Mirrors buildAeoStats
 * but reads in-process so we don't depend on regenerating the full report.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("no TC org");

  const reports = await prisma.clientReport.findMany({
    where: { orgId: org.id },
    orderBy: { generatedAt: "desc" },
  });
  console.log(`Found ${reports.length} TC reports`);

  for (const r of reports) {
    const checks = await prisma.aeoCitationCheck.findMany({
      where: { orgId: org.id, queryRunAt: { gte: r.periodStart, lt: r.periodEnd } },
      select: { engine: true, status: true, prompt: true, competitorsCited: true },
    });

    if (checks.length === 0) {
      console.log(`  ${r.id} (${r.periodStart.toISOString().slice(0,10)} - ${r.periodEnd.toISOString().slice(0,10)}) — no AEO checks, skipped`);
      continue;
    }

    let cited = 0, competitorCited = 0, notMentioned = 0;
    const enginesSeen = new Set<string>();
    const competitorCounts = new Map<string, number>();
    const samples: Array<{ prompt: string; engine: string; competitors: string[] }> = [];

    for (const c of checks) {
      enginesSeen.add(c.engine);
      if (c.status === "CITED") cited++;
      else if (c.status === "COMPETITOR_CITED") {
        competitorCited++;
        const names = Array.isArray(c.competitorsCited) ? (c.competitorsCited as string[]) : [];
        for (const n of names) competitorCounts.set(n, (competitorCounts.get(n) ?? 0) + 1);
        if (samples.length < 3 && !samples.some((s) => s.engine === c.engine)) {
          samples.push({ prompt: c.prompt, engine: c.engine, competitors: names.slice(0, 5) });
        }
      } else if (c.status === "NOT_CITED") notMentioned++;
    }

    const topCompetitors = [...competitorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, mentions]) => ({ name, mentions }));

    const aeoStats = {
      totalChecks: checks.length,
      cited,
      competitorCited,
      notMentioned,
      enginesUsed: [...enginesSeen].sort(),
      topCompetitors,
      sampleCompetitorQueries: samples,
    };

    const snap = r.snapshot as any;
    snap.aeoStats = aeoStats;
    await prisma.clientReport.update({
      where: { id: r.id },
      data: { snapshot: snap as Prisma.InputJsonValue },
    });
    console.log(`  ${r.id} (${r.periodStart.toISOString().slice(0,10)} - ${r.periodEnd.toISOString().slice(0,10)}) — ${checks.length} checks, ${cited} cited, ${competitorCited} competitor-cited`);
  }
  await prisma.$disconnect();
})();
