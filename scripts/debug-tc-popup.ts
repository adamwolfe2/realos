import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  console.log(`Org: ${org!.name} (slug=${org!.slug}, modulePopups=${(org as any).modulePopups})`);
  const popups = await prisma.popupCampaign.findMany({
    where: { orgId: org!.id },
  });
  console.log(`\nFound ${popups.length} popup(s):\n`);
  popups.forEach(p => console.log(JSON.stringify(p, null, 2)));

  const events = await prisma.popupEvent.findMany({
    where: { campaignId: { in: popups.map(p => p.id) } },
    take: 50,
    orderBy: { occurredAt: 'desc' },
  });
  console.log(`\nRecent events: ${events.length}`);
  events.forEach(e => console.log(`  ${e.occurredAt.toISOString()} ${e.type} session=${e.sessionId?.slice(0,8) ?? '-'} url=${e.pageUrl?.slice(0,80) ?? '-'}`));

  const eventCounts = await prisma.popupEvent.groupBy({
    by: ['type'],
    where: { campaignId: { in: popups.map(p => p.id) } },
    _count: { _all: true },
  });
  console.log(`\nEvent counts by type:`);
  eventCounts.forEach(c => console.log(`  ${c.type}: ${c._count._all}`));

  await prisma.$disconnect();
})();
