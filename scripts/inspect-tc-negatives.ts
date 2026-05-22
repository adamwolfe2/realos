import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const negs = await prisma.propertyMention.findMany({
    where: { orgId: org!.id, sentiment: 'NEGATIVE' },
    select: { id: true, source: true, authorName: true, excerpt: true, topics: true, sentimentConfidence: true, publishedAt: true, sourceUrl: true },
  });
  console.log(`${negs.length} negative mentions for TC:\n`);
  negs.forEach((m, i) => {
    console.log(`[${i+1}] ${m.source} by ${m.authorName ?? '?'} (conf ${m.sentimentConfidence?.toFixed(2)}, ${m.publishedAt?.toISOString().slice(0,10) ?? 'undated'})`);
    console.log(`    topics: ${JSON.stringify(m.topics)}`);
    console.log(`    "${m.excerpt.slice(0, 250)}"`);
    console.log();
  });
  await prisma.$disconnect();
})();
