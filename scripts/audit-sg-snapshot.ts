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
    where: { slug: "telegraph-commons" },
    select: { id: true },
  });
  if (!sg) throw new Error("no SG");

  // SeoSnapshot has daily org-wide rollup
  const now = new Date();
  const periodStart = new Date(now.getTime() - 28 * 24 * 3600 * 1000);
  const snaps = await prisma.seoSnapshot.findMany({
    where: { orgId: sg.id, date: { gte: periodStart, lt: now } },
    orderBy: { date: "asc" },
  });
  console.log(`SeoSnapshot rows last 28d: ${snaps.length}`);
  for (const s of snaps) {
    console.log(
      `  ${s.date.toISOString().slice(0, 10)}  organic=${s.organicSessions ?? 0} clicks=${s.totalClicks ?? 0} impr=${s.totalImpressions ?? 0}`,
    );
  }

  // SeoQuery has daily query-level data with date
  const qDays = await prisma.seoQuery.groupBy({
    by: ["date"],
    where: { orgId: sg.id, date: { gte: periodStart, lt: now } },
    _sum: { clicks: true, impressions: true },
    orderBy: { date: "asc" },
  });
  console.log(`\nSeoQuery daily aggregations: ${qDays.length}`);
  for (const r of qDays) {
    console.log(
      `  ${r.date.toISOString().slice(0, 10)}  clicks=${r._sum.clicks ?? 0} impr=${r._sum.impressions ?? 0}`,
    );
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
