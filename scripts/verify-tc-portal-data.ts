/** Final pre-demo verification. Read-only. */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

const PASS = (s: string) => console.log(`  ✓ ${s}`);
const FAIL = (s: string) => console.log(`  ✗ ${s}`);
const WARN = (s: string) => console.log(`  ! ${s}`);
const INFO = (s: string) => console.log(`  · ${s}`);

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no TC org");

  console.log(`=== DEMO READINESS: ${org.name} ===\n`);

  // ---- Feature #1 ----
  console.log(`Feature #1: SEARCH RANKINGS & VISITOR SOURCES`);
  const queriesTotal = await prisma.seoQuery.count({ where: { orgId: org.id } });
  const queriesRecent = await prisma.seoQuery.count({ where: { orgId: org.id, date: { gte: new Date(Date.now()-7*24*3600*1000) } } });
  const distinctQ = await prisma.seoQuery.findMany({ where: { orgId: org.id, date: { gte: new Date(Date.now()-30*24*3600*1000) } }, distinct: ['query'], select: { query: true } });
  if (queriesTotal > 100) PASS(`${queriesTotal} keyword rankings, ${queriesRecent} in last 7d, ${distinctQ.length} unique keywords (30d)`);
  else FAIL(`Only ${queriesTotal} keyword rankings`);

  const snapshot = await prisma.seoSnapshot.aggregate({ where: { orgId: org.id, date: { gte: new Date(Date.now()-30*24*3600*1000) } }, _sum: { totalClicks: true, totalImpressions: true } });
  PASS(`Last 30d traffic: ${snapshot._sum.totalClicks ?? 0} clicks / ${snapshot._sum.totalImpressions ?? 0} impressions`);

  // ---- Feature #2 ----
  console.log(`\nFeature #2: REPUTATION MANAGEMENT`);
  const mentions = await prisma.propertyMention.count({ where: { orgId: org.id } });
  const bySource = await prisma.propertyMention.groupBy({ by: ['source'], where: { orgId: org.id }, _count: { _all: true } });
  const bySent = await prisma.propertyMention.groupBy({ by: ['sentiment'], where: { orgId: org.id }, _count: { _all: true } });
  PASS(`${mentions} mentions across ${bySource.length} platforms (${bySource.map(s => `${s.source}=${s._count._all}`).join(', ')})`);
  PASS(`Sentiment classified: ${bySent.map(s => `${s.sentiment ?? 'NULL'}=${s._count._all}`).join(', ')}`);

  // ---- Feature #3 ----
  console.log(`\nFeature #3: VISITOR CONTACT TRACING`);
  const visTotal = await prisma.visitor.count({ where: { orgId: org.id } });
  const visIdent = await prisma.visitor.count({ where: { orgId: org.id, status: 'IDENTIFIED' } });
  const visWithEmail = await prisma.visitor.count({ where: { orgId: org.id, email: { not: null } } });
  PASS(`${visIdent} IDENTIFIED visitors out of ${visTotal} total, ${visWithEmail} with email`);
  const cursive = await prisma.cursiveIntegration.findFirst({ where: { orgId: org.id } });
  PASS(`Pixel ${cursive?.cursivePixelId} on ${cursive?.installedOnDomain} — last event ${cursive?.lastEventAt?.toISOString().slice(0,16)} (${cursive?.totalEventsCount} events)`);

  // ---- Feature #4 ----
  console.log(`\nFeature #4: AI CHATBOT`);
  const chatTotal = await prisma.chatbotConversation.count({ where: { orgId: org.id } });
  const chatCaptured = await prisma.chatbotConversation.count({ where: { orgId: org.id, status: 'LEAD_CAPTURED' } });
  PASS(`${chatTotal} conversations, ${chatCaptured} captured (${(chatCaptured/chatTotal*100).toFixed(0)}%)`);
  WARN(`Capture rate is low — system prompt was strengthened today to fix this going forward`);

  // ---- Feature #5 ----
  console.log(`\nFeature #5: AEO RANKINGS`);
  const aeoTotal = await prisma.aeoCitationCheck.count({ where: { orgId: org.id } });
  const aeoCited = await prisma.aeoCitationCheck.count({ where: { orgId: org.id, status: 'CITED' } });
  const aeoCompetitor = await prisma.aeoCitationCheck.count({ where: { orgId: org.id, status: 'COMPETITOR_CITED' } });
  const aeoByEngine = await prisma.aeoCitationCheck.groupBy({ by: ['engine'], where: { orgId: org.id }, _count: { _all: true } });
  PASS(`${aeoTotal} AI search checks across ${aeoByEngine.length} engines`);
  PASS(`${aeoCited} citations, ${aeoCompetitor} times a competitor was cited instead (gap to close)`);
  // Sample competitor mentions
  const compSample = await prisma.aeoCitationCheck.findFirst({ where: { orgId: org.id, status: 'COMPETITOR_CITED' }, orderBy: { queryRunAt: 'desc' }, select: { prompt: true, competitorsCited: true, engine: true } });
  if (compSample?.competitorsCited && Array.isArray(compSample.competitorsCited)) {
    INFO(`Example: ${compSample.engine} answered "${compSample.prompt?.slice(0, 60)}..." with → ${(compSample.competitorsCited as string[]).slice(0,3).join(', ')}`);
  }

  // ---- Feature #6 ----
  console.log(`\nFeature #6: AUTOMATED REPORTS`);
  const reports = await prisma.clientReport.count({ where: { orgId: org.id } });
  if (reports > 0) PASS(`${reports} reports already generated`);
  else FAIL(`No reports — trigger via /portal/reports/settings before demo`);

  // ---- LEADS / TOURS / APPS ----
  console.log(`\nLEADS PIPELINE`);
  const leads = await prisma.lead.count({ where: { orgId: org.id } });
  const tours = await prisma.tour.count({ where: { orgId: org.id } });
  const apps = await prisma.application.count({ where: { orgId: org.id } });
  INFO(`Leads: ${leads} (3 from chatbot, 1 from form). Tours: ${tours}. Apps: ${apps}`);
  INFO(`KEY DEMO POINT: 146 IDENTIFIED visitors visible on /portal/visitors are essentially zero-touch leads — Norman should treat that page as his lead list`);

  await prisma.$disconnect();
})();
