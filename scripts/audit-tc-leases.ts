import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";

const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any),
});

(async () => {
  // The production SG TC, not the showcase clone.
  const orgs = await prisma.organization.findMany({
    where: { OR: [{ slug: { contains: "sg" } }, { name: { contains: "SG" } }] },
    select: { id: true, slug: true, name: true },
  });
  console.log("SG-ish orgs:", orgs);
  const sg = orgs[0];
  if (!sg) throw new Error("no SG org");
  const tc = await prisma.property.findFirst({
    where: {
      orgId: sg.id,
      name: { contains: "Telegraph", mode: "insensitive" },
    },
    select: { id: true, name: true, orgId: true, lifecycle: true },
  });
  if (!tc) throw new Error("no Telegraph Commons property");
  console.log("TC:", tc);

  const all = await prisma.lease.count({ where: { propertyId: tc.id } });
  const active = await prisma.lease.count({
    where: { propertyId: tc.id, status: "ACTIVE" },
  });
  console.log(`\nTotal leases: ${all}`);
  console.log(`Active leases: ${active}`);

  // Bucket Lease.startDate by month to see real lease velocity
  const recent = await prisma.lease.findMany({
    where: { propertyId: tc.id, startDate: { not: null } },
    select: { startDate: true, status: true, endDate: true },
    orderBy: { startDate: "desc" },
    take: 30,
  });
  console.log(`\nRecent 30 leases by startDate:`);
  for (const r of recent) {
    console.log(`  ${r.startDate?.toISOString().slice(0, 10)}  ${r.status}  end=${r.endDate?.toISOString().slice(0, 10) ?? "—"}`);
  }

  // Count by month
  const now = new Date();
  const buckets = [7, 28, 60, 90, 180, 365];
  console.log(`\nLeases.startDate buckets (looking back):`);
  for (const days of buckets) {
    const from = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const count = await prisma.lease.count({
      where: { propertyId: tc.id, startDate: { gte: from, lte: now } },
    });
    console.log(`  last ${days}d:  ${count}`);
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
