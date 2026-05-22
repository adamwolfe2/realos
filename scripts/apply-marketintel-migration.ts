import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: "/Users/adamwolfe/realos/.env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  await prisma.$executeRawUnsafe(`ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "moduleMarketIntelligence" BOOLEAN NOT NULL DEFAULT false`);
  // Confirm via select
  const r: any = await prisma.$queryRawUnsafe(`SELECT slug, "moduleMarketIntelligence" FROM "Organization" WHERE slug = 'telegraph-commons'`);
  console.log("After migration:", r);
  await prisma.$disconnect();
})();
