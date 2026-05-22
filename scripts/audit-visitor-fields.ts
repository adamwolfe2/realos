import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const sample = await prisma.visitor.findMany({
    where: { orgId: org!.id, status: 'IDENTIFIED' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  console.log("Full visitor records (3 most recent):\n");
  sample.forEach(v => console.log(JSON.stringify(v, null, 2)));

  // Distribution of fields
  const all = await prisma.visitor.findMany({ where: { orgId: org!.id, status: 'IDENTIFIED' }, select: { lastSeenAt: true, firstSeenAt: true, referrer: true, sessionCount: true, totalTimeSeconds: true, pagesViewed: true, enrichedData: true } });
  const distinctLastSeen = new Set(all.map(v => v.lastSeenAt.toISOString().slice(0,16)));
  const withReferrer = all.filter(v => v.referrer && v.referrer !== '').length;
  const withPages = all.filter(v => Array.isArray(v.pagesViewed) && (v.pagesViewed as any[]).length > 0).length;
  console.log(`\nDistinct lastSeenAt minutes: ${distinctLastSeen.size}`);
  console.log(`Visitors with referrer set: ${withReferrer}/${all.length}`);
  console.log(`Visitors with pagesViewed: ${withPages}/${all.length}`);

  // Sample enrichedData keys
  const keysSeen = new Set<string>();
  all.forEach(v => {
    if (v.enrichedData && typeof v.enrichedData === 'object') {
      Object.keys(v.enrichedData as object).forEach(k => keysSeen.add(k));
    }
  });
  console.log(`\nAll enrichedData keys ever seen: ${[...keysSeen].join(', ')}`);

  // Sample first enriched payload in full
  const first = all.find(v => v.enrichedData);
  if (first) console.log(`\nSample enrichedData:\n${JSON.stringify(first.enrichedData, null, 2)}`);

  await prisma.$disconnect();
})();
