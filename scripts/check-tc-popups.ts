import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const popups = await prisma.popupCampaign.findMany({ where: { orgId: org!.id }, select: { id: true, name: true, status: true, trigger: true, shownCount: true, convertedCount: true, createdAt: true } });
  console.log(`TC popups: ${popups.length}`);
  popups.forEach(p => console.log(`  ${p.name} status=${p.status} trigger=${p.trigger} shown=${p.shownCount} converted=${p.convertedCount} created=${p.createdAt.toISOString()}`));
  await prisma.$disconnect();
})();
