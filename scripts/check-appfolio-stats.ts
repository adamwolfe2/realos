import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const integ = await prisma.appFolioIntegration.findUnique({ where: { orgId: org!.id } });
  console.log(JSON.stringify({
    syncStatus: integ?.syncStatus,
    lastSyncAt: integ?.lastSyncAt,
    lastError: integ?.lastError,
    lastSyncStats: integ?.lastSyncStats,
  }, null, 2));
  await prisma.$disconnect();
})();
