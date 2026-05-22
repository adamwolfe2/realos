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

  // Visitors
  const visTotal = await prisma.visitor.count({ where: { orgId: org.id } });
  const sessTotal = await prisma.visitorSession.count({ where: { orgId: org.id } });
  const visIdent = await prisma.visitor.count({ where: { orgId: org.id, status: 'IDENTIFIED' } });
  const sess7d = await prisma.visitorSession.count({ where: { orgId: org.id, startedAt: { gte: new Date(Date.now()-7*24*3600*1000) } } });
  const sess30d = await prisma.visitorSession.count({ where: { orgId: org.id, startedAt: { gte: new Date(Date.now()-30*24*3600*1000) } } });
  const sessMostRecent = await prisma.visitorSession.findFirst({ where: { orgId: org.id }, orderBy: { startedAt: 'desc' }, select: { startedAt: true } });
  console.log(`\nVISITORS: ${visTotal} total / ${visIdent} identified`);
  console.log(`SESSIONS: ${sessTotal} total / ${sess7d} last 7d / ${sess30d} last 30d / most recent: ${sessMostRecent?.startedAt?.toISOString() ?? 'never'}`);

  // Cursive integration (visitor identification)
  const cursive = await prisma.cursiveIntegration.findMany({ where: { orgId: org.id }, select: { id: true, propertyId: true, cursivePixelId: true, installedOnDomain: true, lastEventAt: true, totalEventsCount: true } });
  console.log(`\nCURSIVE pixels (${cursive.length} rows):`);
  cursive.forEach(c => console.log(`  pixelId=${c.cursivePixelId ?? '-'} property=${c.propertyId ?? 'ORG-WIDE'} domain=${c.installedOnDomain ?? '-'} lastEvent=${c.lastEventAt?.toISOString() ?? 'never'} events=${c.totalEventsCount}`));

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

  // Recent visitor sessions (verify pixel is firing)
  const recentSess = await prisma.visitorSession.findMany({ where: { orgId: org.id }, orderBy: { startedAt: 'desc' }, take: 5, select: { startedAt: true, firstUrl: true, utmSource: true, pageviewCount: true, country: true } });
  console.log(`\nLast 5 visitor sessions:`);
  recentSess.forEach(s => console.log(`  ${s.startedAt.toISOString()} ${s.country ?? '-'} ${s.utmSource ?? 'organic'} ${s.pageviewCount}pv ${s.firstUrl ?? '-'}`));

  // Recent identified visitors
  const identVis = await prisma.visitor.findMany({ where: { orgId: org.id, status: 'IDENTIFIED' }, orderBy: { lastSeenAt: 'desc' }, take: 5, select: { lastSeenAt: true, firstName: true, lastName: true, email: true, intentScore: true } });
  console.log(`\nLast 5 IDENTIFIED visitors:`);
  identVis.forEach(v => console.log(`  ${v.lastSeenAt.toISOString()} ${v.firstName ?? ''} ${v.lastName ?? ''} ${v.email ?? '-'} intent=${v.intentScore}`));

  await prisma.$disconnect();
})();
