import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: "telegraph-commons" } });
  if (!org) throw new Error("not found");
  console.log("Org:", org.name, org.id);

  // Chatbot
  const chatTotal = await prisma.chatbotConversation.count({ where: { orgId: org.id } });
  const chatLast30 = await prisma.chatbotConversation.count({ where: { orgId: org.id, createdAt: { gte: new Date(Date.now() - 30*24*3600*1000) } } });
  const chatByStatus = await prisma.chatbotConversation.groupBy({ by: ['status'], where: { orgId: org.id }, _count: { _all: true } });
  console.log(`\nCHATBOT: ${chatTotal} convs total / ${chatLast30} last 30d`);
  chatByStatus.forEach(s => console.log(`  ${s.status}: ${s._count._all}`));

  // Recent convs
  const recent = await prisma.chatbotConversation.findMany({ where: { orgId: org.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, status: true, capturedEmail: true, capturedPhone: true, messageCount: true, pageUrl: true } });
  console.log(`\nLast 10 conversations:`);
  recent.forEach(c => console.log(`  ${c.createdAt.toISOString()} ${c.status} email=${c.capturedEmail ?? '-'} msgs=${c.messageCount} url=${c.pageUrl ?? '-'}`));

  // Leads
  const leadTotal = await prisma.lead.count({ where: { orgId: org.id } });
  const leadBySrc = await prisma.lead.groupBy({ by: ['source'], where: { orgId: org.id }, _count: { _all: true } });
  console.log(`\nLEADS: ${leadTotal} total`);
  leadBySrc.forEach(s => console.log(`  ${s.source}: ${s._count._all}`));

  // SeoLandingPage (top URLs)
  const seoLp = await prisma.seoLandingPage.count({ where: { orgId: org.id } });
  const seoLpRecent = await prisma.seoLandingPage.findFirst({ where: { orgId: org.id }, orderBy: { date: 'desc' }, select: { date: true } });
  console.log(`\nSeoLandingPage: ${seoLp} total, most recent: ${seoLpRecent?.date?.toISOString() ?? 'none'}`);

  // SeoQuery (keywords)
  const seoQ = await prisma.seoQuery.count({ where: { orgId: org.id } });
  console.log(`SeoQuery: ${seoQ} total`);
  const seoQRecent = await prisma.seoQuery.findFirst({ where: { orgId: org.id }, orderBy: { date: 'desc' }, select: { date: true } });
  console.log(`Most recent: ${seoQRecent?.date?.toISOString() ?? 'none'}`);

  // Top keywords
  const top = await prisma.seoQuery.findMany({ where: { orgId: org.id }, orderBy: [{ impressions: 'desc' }], take: 10, select: { query: true, impressions: true, clicks: true, position: true } });
  console.log(`Top 10 keywords by impressions:`);
  top.forEach(q => console.log(`  "${q.query}" — ${q.impressions} imp, ${q.clicks} clicks, pos ${q.position?.toFixed(1)}`));

  // Reputation - properties with mentions
  const mentionsByPlatform = await prisma.propertyMention.groupBy({ by: ['source'], where: { orgId: org.id }, _count: { _all: true } });
  console.log(`\nMentions by source:`);
  mentionsByPlatform.forEach(m => console.log(`  ${m.source}: ${m._count._all}`));

  await prisma.$disconnect();
})();
