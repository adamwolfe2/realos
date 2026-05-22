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

  console.log("=== Visitor referrer breakdown (top 10) ===");
  const referrers = await prisma.visitor.groupBy({
    by: ["referrer"],
    where: { orgId: sg.id, referrer: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { referrer: "desc" } },
    take: 10,
  });
  for (const r of referrers) {
    console.log(`  ${(r._count._all).toString().padStart(4)} ${r.referrer}`);
  }

  console.log("\n=== UTM Sources (top 5) ===");
  const utms = await prisma.visitor.groupBy({
    by: ["utmSource"],
    where: { orgId: sg.id, utmSource: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { utmSource: "desc" } },
    take: 5,
  });
  for (const u of utms) {
    console.log(`  ${(u._count._all).toString().padStart(4)} ${u.utmSource}`);
  }

  console.log("\n=== Visitor totals ===");
  const total = await prisma.visitor.count({ where: { orgId: sg.id } });
  const identified = await prisma.visitor.count({
    where: { orgId: sg.id, status: "IDENTIFIED" },
  });
  const enriched = await prisma.visitor.count({
    where: { orgId: sg.id, status: "ENRICHED" },
  });
  const matched = await prisma.visitor.count({
    where: { orgId: sg.id, status: "MATCHED_TO_LEAD" },
  });
  const anonymous = await prisma.visitor.count({
    where: { orgId: sg.id, status: "ANONYMOUS" },
  });
  const hotLeads = await prisma.visitor.count({
    where: { orgId: sg.id, intentScore: { gte: 70 } },
  });
  console.log(`  Total: ${total}`);
  console.log(`  Anonymous: ${anonymous}`);
  console.log(`  Identified: ${identified}`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Matched to lead: ${matched}`);
  console.log(`  Hot (intent >= 70): ${hotLeads}`);

  // Chatbot conversation status breakdown
  console.log("\n=== Chatbot conversation status ===");
  const chatStatus = await prisma.chatbotConversation.groupBy({
    by: ["status"],
    where: { orgId: sg.id },
    _count: { _all: true },
  });
  for (const c of chatStatus) {
    console.log(`  ${c.status.padEnd(20)} ${c._count._all}`);
  }

  // Enrichment data sample — what fields are available?
  console.log("\n=== Enrichment sample (1 row) ===");
  const sample = await prisma.visitor.findFirst({
    where: { orgId: sg.id, status: { in: ["ENRICHED", "IDENTIFIED"] } },
    select: { enrichedData: true },
  });
  if (sample?.enrichedData) {
    const e = sample.enrichedData as Record<string, unknown>;
    console.log("  Top-level keys:", Object.keys(e));
  }

  // City breakdown (from enrichedData if present, else from REFERRER)
  console.log("\n=== Top cities (from enrichedData.CITY) ===");
  const visitors = await prisma.visitor.findMany({
    where: {
      orgId: sg.id,
      status: { in: ["IDENTIFIED", "ENRICHED", "MATCHED_TO_LEAD"] },
    },
    select: { enrichedData: true },
    take: 200,
  });
  const cityMap = new Map<string, number>();
  for (const v of visitors) {
    if (v.enrichedData && typeof v.enrichedData === "object") {
      const e = v.enrichedData as Record<string, unknown>;
      const city =
        (typeof e.CITY === "string" && e.CITY) ||
        (typeof e.city === "string" && e.city) ||
        null;
      if (city) {
        cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
      }
    }
  }
  const cities = [...cityMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [city, count] of cities) {
    console.log(`  ${count.toString().padStart(4)} ${city}`);
  }

  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
