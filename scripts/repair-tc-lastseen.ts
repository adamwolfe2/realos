/**
 * One-time repair for Telegraph Commons: lastSeenAt was overwritten to
 * NOW on every 5-min segment-sync cron, so ALL 146 visitors show the
 * same recent timestamp. The fix has shipped (lib/actions/admin-cursive.ts),
 * but existing rows already have lastSeenAt = the most-recent-sync time.
 *
 * Reset each visitor's lastSeenAt to firstSeenAt + 1 minute. That gives
 * an honest "we first saw this person at X, no fresh activity since"
 * signal until the next genuine event lands and bumps lastSeenAt
 * properly. The +1min offset prevents the firstSeen/lastSeen equality
 * check elsewhere from misinterpreting it as a brand-new visitor.
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const visitors = await prisma.visitor.findMany({
    where: { orgId: org!.id },
    select: { id: true, firstSeenAt: true, lastSeenAt: true },
  });
  let repaired = 0;
  for (const v of visitors) {
    const restored = new Date(v.firstSeenAt.getTime() + 60_000);
    if (v.lastSeenAt.getTime() === restored.getTime()) continue;
    await prisma.visitor.update({
      where: { id: v.id },
      data: { lastSeenAt: restored },
    });
    repaired++;
  }
  console.log(`Repaired ${repaired} / ${visitors.length} TC visitor lastSeenAt timestamps.`);
  await prisma.$disconnect();
})();
