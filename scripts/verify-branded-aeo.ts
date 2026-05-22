import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no TC");

  // Get the 15 newest checks (the ones from this scan)
  const recent = await prisma.aeoCitationCheck.findMany({
    where: { orgId: org.id },
    orderBy: { queryRunAt: 'desc' },
    take: 20,
    select: { engine: true, status: true, prompt: true, mentioned: true, citedUrl: true, queryRunAt: true },
  });

  console.log(`Last 20 AEO checks for TC:\n`);
  const branded = recent.filter(c => /telegraph commons/i.test(c.prompt));
  const discovery = recent.filter(c => !/telegraph commons/i.test(c.prompt));

  console.log(`BRANDED prompts (${branded.length}):`);
  branded.forEach(c => console.log(`  ${c.engine.padEnd(11)} ${c.status.padEnd(18)} mentioned=${c.mentioned} cited=${!!c.citedUrl}  "${c.prompt.slice(0, 80)}..."`));

  console.log(`\nDISCOVERY prompts (${discovery.length}):`);
  discovery.forEach(c => console.log(`  ${c.engine.padEnd(11)} ${c.status.padEnd(18)} mentioned=${c.mentioned} cited=${!!c.citedUrl}  "${c.prompt.slice(0, 80)}..."`));

  // Summary stats matching the dashboard
  const last30Total = await prisma.aeoCitationCheck.count({ where: { orgId: org.id, queryRunAt: { gte: new Date(Date.now()-30*86400_000) } } });
  const last30Mentioned = await prisma.aeoCitationCheck.count({ where: { orgId: org.id, queryRunAt: { gte: new Date(Date.now()-30*86400_000) }, mentioned: true } });
  const last30Cited = await prisma.aeoCitationCheck.count({ where: { orgId: org.id, queryRunAt: { gte: new Date(Date.now()-30*86400_000) }, status: 'CITED' } });

  console.log(`\nLast 30 days dashboard numbers:`);
  console.log(`  Total checks:   ${last30Total}`);
  console.log(`  Mention rate:   ${last30Total > 0 ? Math.round(last30Mentioned/last30Total*100) : 0}% (${last30Mentioned}/${last30Total})`);
  console.log(`  Citation rate:  ${last30Total > 0 ? Math.round(last30Cited/last30Total*100) : 0}% (${last30Cited}/${last30Total})`);

  await prisma.$disconnect();
})();
