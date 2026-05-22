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
    select: { id: true, name: true, slug: true },
  });
  if (!sg) throw new Error("no SG org");
  console.log("Org:", sg.name);

  const tc = await prisma.property.findFirst({
    where: { orgId: sg.id, lifecycle: "ACTIVE" },
    select: { id: true, name: true, slug: true },
  });
  console.log("Active property:", tc);

  const now = new Date();
  const day = 24 * 3600 * 1000;
  const periodStart = new Date(now.getTime() - 28 * day);

  // ─── Lease velocity (last 12 months) ──────────────────────────
  console.log("\n=== Lease velocity by month (last 12mo) ===");
  for (let m = 11; m >= 0; m--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 1);
    const count = await prisma.lease.count({
      where: {
        orgId: sg.id,
        property: { lifecycle: "ACTIVE" },
        startDate: { gte: monthStart, lt: monthEnd },
      },
    });
    console.log(`  ${monthStart.toISOString().slice(0, 7)}:  ${count}`);
  }

  // ─── Chatbot conversations ──────────────────────────
  console.log("\n=== Chatbot conversations ===");
  const cbTotal = await prisma.chatbotConversation.count({
    where: { orgId: sg.id },
  });
  const cbPeriod = await prisma.chatbotConversation.count({
    where: { orgId: sg.id, createdAt: { gte: periodStart, lt: now } },
  });
  console.log(`  Lifetime: ${cbTotal}`);
  console.log(`  Last 28d: ${cbPeriod}`);

  // ─── Traffic trend source ──────────────────────────
  console.log("\n=== SEO landing page hits per day (last 28d, top 20) ===");
  const traffic = await prisma.seoLandingPage.groupBy({
    by: ["date"],
    where: { orgId: sg.id, date: { gte: periodStart, lt: now } },
    _sum: { sessions: true },
    orderBy: { date: "asc" },
  });
  for (const r of traffic.slice(-20)) {
    console.log(
      `  ${r.date.toISOString().slice(0, 10)}:  ${r._sum.sessions ?? 0}`,
    );
  }
  console.log(`  Total rows: ${traffic.length}`);

  // ─── Top landing pages ──────────────────────────
  console.log("\n=== Top landing pages (last 28d, no filter) ===");
  const pages = await prisma.seoLandingPage.groupBy({
    by: ["url"],
    where: { orgId: sg.id, date: { gte: periodStart, lt: now } },
    _sum: { sessions: true },
    orderBy: { _sum: { sessions: "desc" } },
    take: 15,
  });
  for (const p of pages) {
    console.log(`  ${(p._sum.sessions ?? 0).toString().padStart(5)} ${p.url}`);
  }

  // ─── Top search queries ──────────────────────────
  console.log("\n=== Top GSC queries (last 28d) ===");
  const queries = await prisma.seoQuery.groupBy({
    by: ["query"],
    where: { orgId: sg.id, date: { gte: periodStart, lt: now } },
    _sum: { clicks: true, impressions: true },
    orderBy: { _sum: { clicks: "desc" } },
    take: 10,
  });
  for (const q of queries) {
    console.log(
      `  ${(q._sum.clicks ?? 0).toString().padStart(4)} clicks  ${q.query}`,
    );
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
