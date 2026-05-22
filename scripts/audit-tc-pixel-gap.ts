import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no TC org");

  const all = await prisma.visitor.count({ where: { orgId: org.id } });
  const byStatus = await prisma.visitor.groupBy({ by: ['status'], where: { orgId: org.id }, _count: { _all: true } });
  console.log(`TOTAL Visitor rows for TC: ${all}`);
  console.log(`By status:`);
  byStatus.forEach(s => console.log(`  ${s.status}: ${s._count._all}`));

  // Last 7 days windows
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ident7d = await prisma.visitor.count({ where: { orgId: org.id, status: 'IDENTIFIED', firstSeenAt: { gte: last7d } } });
  const ident30d = await prisma.visitor.count({ where: { orgId: org.id, status: 'IDENTIFIED', firstSeenAt: { gte: last30d } } });
  const identAll = await prisma.visitor.count({ where: { orgId: org.id, status: 'IDENTIFIED' } });
  console.log(`\nIDENTIFIED counts by window:`);
  console.log(`  Last 7 days:  ${ident7d}`);
  console.log(`  Last 30 days: ${ident30d}`);
  console.log(`  All time:     ${identAll}`);

  // Anonymous rows — those AL returned but we couldn't resolve to a real person
  const anon = await prisma.visitor.count({ where: { orgId: org.id, status: 'ANONYMOUS' } });
  console.log(`\nANONYMOUS rows: ${anon} (AL returned but missing firstName/lastName/email — can't be surfaced as people)`);

  // Cursive integration totals
  const cur = await prisma.cursiveIntegration.findFirst({ where: { orgId: org.id, propertyId: null } });
  console.log(`\nCursive integration: totalEventsCount=${cur?.totalEventsCount}, lastSegmentSyncAt=${cur?.lastSegmentSyncAt?.toISOString()}`);

  await prisma.$disconnect();
})();
