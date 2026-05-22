import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no org");

  const all = await prisma.visitor.findMany({
    where: { orgId: org.id, status: 'IDENTIFIED' },
    select: { firstName: true, lastName: true, email: true, intentScore: true, sessionCount: true, totalTimeSeconds: true, pagesViewed: true, cursiveVisitorId: true, firstSeenAt: true, lastSeenAt: true, createdAt: true, referrer: true, utmSource: true, enrichedData: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`Total IDENTIFIED: ${all.length}\n`);

  const byMinute = new Map<string, number>();
  all.forEach(v => {
    const min = v.createdAt.toISOString().slice(0, 16);
    byMinute.set(min, (byMinute.get(min) || 0) + 1);
  });
  console.log("Top 10 creation minutes (a single minute with 20+ rows = batch sync, not organic):");
  [...byMinute.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([m, c]) => console.log(`  ${m}: ${c} visitors`));

  const fromPixel = all.filter(v => v.cursiveVisitorId !== null);
  const withSessions = all.filter(v => v.sessionCount > 0);
  const withPageviews = all.filter(v => Array.isArray(v.pagesViewed) && (v.pagesViewed as any[]).length > 0);
  const withTime = all.filter(v => v.totalTimeSeconds > 0);
  console.log(`\nProvenance breakdown:`);
  console.log(`  has cursiveVisitorId: ${fromPixel.length} / ${all.length}`);
  console.log(`  sessionCount > 0:     ${withSessions.length} / ${all.length}`);
  console.log(`  has pagesViewed:      ${withPageviews.length} / ${all.length}`);
  console.log(`  totalTimeSeconds > 0: ${withTime.length} / ${all.length}`);

  const scores = all.map(v => v.intentScore);
  const uniqueScores = [...new Set(scores)];
  console.log(`\nintentScore values: ${uniqueScores.sort().join(', ')} (if all = 70, that's a batch default not real engagement)`);

  console.log(`\nSample 3 visitors with enrichedData:`);
  for (const v of all.slice(0, 3)) {
    console.log(`  ${v.firstName} ${v.lastName} <${v.email}>`);
    console.log(`    firstSeen: ${v.firstSeenAt.toISOString()}  lastSeen: ${v.lastSeenAt.toISOString()}`);
    console.log(`    sessionCount=${v.sessionCount} totalTime=${v.totalTimeSeconds}s  referrer=${v.referrer ?? '-'}  utm=${v.utmSource ?? '-'}`);
    if (v.enrichedData) {
      const keys = Object.keys(v.enrichedData as object).slice(0, 8);
      console.log(`    enrichedData keys: [${keys.join(', ')}]`);
    }
  }

  await prisma.$disconnect();
})();
