import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no org");

  const bySent = await prisma.propertyMention.groupBy({ by: ['sentiment'], where: { orgId: org.id }, _count: { _all: true } });
  console.log("Sentiment breakdown for TC mentions:");
  bySent.forEach(s => console.log(`  ${s.sentiment ?? 'NULL'}: ${s._count._all}`));

  const negsamples = await prisma.propertyMention.findMany({ where: { orgId: org.id, sentiment: 'NEGATIVE' }, take: 5, select: { source: true, excerpt: true, sentiment: true, sentimentConfidence: true } });
  console.log(`\nNegative mention samples:`);
  negsamples.forEach(m => console.log(`  [${m.source}] (conf ${m.sentimentConfidence?.toFixed(2)}): ${m.excerpt?.slice(0,150)}...`));

  const possamples = await prisma.propertyMention.findMany({ where: { orgId: org.id, sentiment: 'POSITIVE' }, take: 3, select: { source: true, excerpt: true } });
  console.log(`\nPositive mention samples:`);
  possamples.forEach(m => console.log(`  [${m.source}]: ${m.excerpt?.slice(0,150)}...`));

  // AEO check details
  const aeoLatest = await prisma.aeoCitationCheck.findMany({ where: { orgId: org.id }, orderBy: { queryRunAt: 'desc' }, take: 12, select: { engine: true, status: true, prompt: true, queryRunAt: true, citedUrl: true, mentioned: true, competitorsCited: true } });
  console.log(`\nLast 12 AEO checks:`);
  aeoLatest.forEach(a => console.log(`  ${a.queryRunAt.toISOString()} ${a.engine} ${a.status} mentioned=${a.mentioned} "${a.prompt?.slice(0, 60)}"${a.citedUrl ? ` → ${a.citedUrl.slice(0,40)}` : ''}${Array.isArray(a.competitorsCited) && (a.competitorsCited as any[]).length ? ` competitors=${(a.competitorsCited as string[]).slice(0,3).join(',')}` : ''}`));

  await prisma.$disconnect();
})();
