import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { extractIdentity } from "../lib/visitors/enrichment";

const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const sample = await prisma.visitor.findMany({
    where: { orgId: org!.id, status: 'IDENTIFIED' },
    select: { id: true, firstName: true, lastName: true, email: true, sessionCount: true, lastSeenAt: true, firstSeenAt: true, enrichedData: true },
    take: 8,
  });
  console.log("Simulated table render (post-fix):");
  console.log("NAME                       | LOCATION              | LAST PAGE                                 | LAST SEEN");
  console.log("---------------------------|-----------------------|-------------------------------------------|-------------------");
  sample.forEach(v => {
    const id = extractIdentity(v);
    const displayAt = v.firstSeenAt && v.firstSeenAt < v.lastSeenAt ? v.firstSeenAt : v.lastSeenAt;
    const ago = Math.floor((Date.now() - displayAt.getTime()) / 60000);
    const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.floor(ago/60)}h ago` : `${Math.floor(ago/1440)}d ago`;
    console.log(`${id.displayName.padEnd(26)} | ${(id.location ?? '—').padEnd(21)} | ${(id.lastPageUrl ?? '—').padEnd(41).slice(0,41)} | ${agoStr}`);
  });
  await prisma.$disconnect();
})();
