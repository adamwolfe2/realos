import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no org");

  // Were any conversations seeded? Look for distinct IP addresses + sessionId patterns
  const convs = await prisma.chatbotConversation.findMany({
    where: { orgId: org.id },
    select: { sessionId: true, ipAddress: true, userAgent: true, createdAt: true, capturedEmail: true, pageUrl: true },
    orderBy: { createdAt: 'asc' },
  });
  const ips = new Set(convs.map(c => c.ipAddress).filter(Boolean));
  const seededLooking = convs.filter(c => c.sessionId.startsWith('demo-') || c.sessionId.startsWith('seed-'));
  console.log(`Chatbot conversations: ${convs.length} total, ${ips.size} unique IPs, ${seededLooking.length} seeded-looking`);
  console.log(`Oldest: ${convs[0]?.createdAt.toISOString()}  Newest: ${convs[convs.length-1]?.createdAt.toISOString()}`);
  console.log(`\nUser agents (first 5 distinct):`);
  const uas = [...new Set(convs.map(c => c.userAgent).filter(Boolean))].slice(0, 5);
  uas.forEach(ua => console.log(`  ${ua?.slice(0, 100)}`));

  // Reputation mentions — was anything seeded?
  const mentions = await prisma.propertyMention.findMany({
    where: { orgId: org.id },
    select: { source: true, sourceUrl: true, createdAt: true, firstSeenScanId: true },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  console.log(`\nReputation mentions sample (5 oldest):`);
  mentions.forEach(m => console.log(`  ${m.createdAt.toISOString()} [${m.source}] ${m.sourceUrl.slice(0, 80)}`));

  // SEO queries — verify provenance
  const seoSample = await prisma.seoQuery.findFirst({ where: { orgId: org.id }, orderBy: { date: 'desc' }, select: { date: true, query: true, clicks: true, position: true } });
  const seoIntegration = await prisma.seoIntegration.findFirst({ where: { orgId: org.id, provider: 'GSC' }, select: { propertyIdentifier: true, lastSyncAt: true, serviceAccountEmail: true } });
  console.log(`\nSEO data source:`);
  console.log(`  GSC site: ${seoIntegration?.propertyIdentifier}  via ${seoIntegration?.serviceAccountEmail}  lastSync: ${seoIntegration?.lastSyncAt?.toISOString()}`);
  console.log(`  most recent query row: ${seoSample?.date.toISOString()} "${seoSample?.query}" ${seoSample?.clicks} clicks pos ${seoSample?.position?.toFixed(1)}`);

  await prisma.$disconnect();
})();
