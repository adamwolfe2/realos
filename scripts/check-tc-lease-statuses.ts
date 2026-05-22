import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const tc = await prisma.property.findFirst({ where: { orgId: org!.id, lifecycle: 'ACTIVE' } });
  const since30 = new Date(Date.now() - 30*86400000);
  const since90 = new Date(Date.now() - 90*86400000);

  const lByStatus = await prisma.lease.groupBy({ by: ['status'], where: { orgId: org!.id, propertyId: tc!.id }, _count: { _all: true } });
  console.log("TC leases by status:");
  lByStatus.forEach(s => console.log(`  ${s.status}: ${s._count._all}`));

  const recent = await prisma.lease.count({ where: { orgId: org!.id, propertyId: tc!.id, createdAt: { gte: since30 } } });
  const recent90 = await prisma.lease.count({ where: { orgId: org!.id, propertyId: tc!.id, createdAt: { gte: since90 } } });
  console.log(`\nNew leases last 30d: ${recent}`);
  console.log(`New leases last 90d: ${recent90}`);

  const rByStatus = await prisma.resident.groupBy({ by: ['status'], where: { orgId: org!.id, propertyId: tc!.id }, _count: { _all: true } });
  console.log("\nTC residents by status:");
  rByStatus.forEach(s => console.log(`  ${s.status}: ${s._count._all}`));

  await prisma.$disconnect();
})();
