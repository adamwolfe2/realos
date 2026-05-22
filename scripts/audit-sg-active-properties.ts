import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

(async () => {
  const sg = await prisma.organization.findFirst({
    where: { slug: { in: ["sg-real-estate", "telegraph-commons"] } },
    select: { id: true, name: true },
  });
  if (!sg) throw new Error("no SG org");
  console.log("Org:", sg);

  const byLifecycle = await prisma.property.groupBy({
    by: ["lifecycle"],
    where: { orgId: sg.id },
    _count: { _all: true },
  });
  console.log("\nProperty lifecycle counts:");
  for (const r of byLifecycle) {
    console.log(`  ${r.lifecycle}:  ${r._count._all}`);
  }

  const active = await prisma.property.findMany({
    where: { orgId: sg.id, lifecycle: "ACTIVE" },
    select: {
      id: true,
      name: true,
      _count: { select: { leases: true } },
    },
    orderBy: { name: "asc" },
  });
  console.log(`\nACTIVE properties (${active.length}):`);
  for (const p of active) {
    console.log(`  ${p.name.padEnd(40)} ${p._count.leases} leases`);
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
