import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const groups = await prisma.property.groupBy({ by: ['lifecycle'], where: { orgId: org!.id }, _count: { _all: true } });
  console.log('Lifecycle breakdown:');
  groups.forEach(g => console.log(`  ${g.lifecycle}: ${g._count._all}`));
  const active = await prisma.property.findMany({ where: { orgId: org!.id, lifecycle: 'ACTIVE' }, select: { name: true } });
  console.log(`\nACTIVE properties (visible on /portal/properties):`);
  active.forEach(p => console.log(`  - ${p.name}`));
  await prisma.$disconnect();
})();
