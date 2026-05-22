import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { generateReportSnapshot } from "../lib/reports/generate";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { randomBytes } from "crypto";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("no TC org");

  // Generate fresh weekly + monthly snapshots
  for (const kind of ["weekly", "monthly"] as const) {
    console.log(`\nGenerating ${kind} report for ${org.name}…`);
    const start = Date.now();
    const snap = await generateReportSnapshot(org.id, kind);
    console.log(`Done in ${((Date.now()-start)/1000).toFixed(1)}s`);
    console.log(`  captured contacts: ${snap.kpis.leads + (snap.kpis.identifiedVisitors ?? 0)} (${snap.kpis.leads} leads + ${snap.kpis.identifiedVisitors ?? 0} identified)`);
    console.log(`  aeoStats: ${snap.aeoStats ? `${snap.aeoStats.totalChecks} checks, ${snap.aeoStats.cited} cited, ${snap.aeoStats.competitorCited} competitor-cited` : 'none'}`);

    // Persist as a fresh ClientReport row
    const periodStart = new Date(snap.periodStart);
    const periodEnd = new Date(snap.periodEnd);
    const created = await prisma.clientReport.create({
      data: {
        orgId: org.id,
        kind,
        periodStart,
        periodEnd,
        snapshot: snap as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        headline: kind === "monthly" ? "End of Month Report 5/22" : "Weekly Report 5/22",
        status: "generated",
        shareToken: randomBytes(16).toString("hex"),
      },
    });
    console.log(`  saved as ${created.id}`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
