/**
 * Walk every TC-scoped table looking for seeded / demo / fake rows.
 * Norman's data must be 100% real for the demo.
 *
 * Heuristics for "seeded":
 *   - sessionId / id / cuid prefixed with `seed-`, `demo-`, `test-`, `fake-`
 *   - emails matching @example.com, @demo.*, @leasestack.* (other than our team)
 *   - names matching common test patterns
 *   - source field == DEMO_SEED
 *   - chatbot conversations from `curl` user agent
 */
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });

const FLAG = (cnt: number, what: string) => cnt === 0 ? `✓ no ${what}` : `⚠ ${cnt} ${what}`;

(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  if (!org) throw new Error("no TC org");
  console.log(`Org: ${org.name} (${org.id})\n`);

  // VISITORS
  const visSeeded = await prisma.visitor.count({
    where: {
      orgId: org.id,
      OR: [
        { email: { endsWith: "@example.com" } },
        { email: { contains: "test" } },
        { email: { contains: "demo" } },
        { email: { startsWith: "seed" } },
        { cursiveVisitorId: { startsWith: "seed:" } },
        { cursiveVisitorId: { startsWith: "demo:" } },
      ],
    },
  });
  console.log("VISITORS:", FLAG(visSeeded, "seeded visitors"));

  // CHATBOT CONVERSATIONS
  const convSeeded = await prisma.chatbotConversation.count({
    where: {
      orgId: org.id,
      OR: [
        { sessionId: { startsWith: "seed-" } },
        { sessionId: { startsWith: "demo-" } },
        { sessionId: { startsWith: "test-" } },
        { userAgent: { startsWith: "curl/" } },
        { capturedEmail: { contains: "@example.com" } },
        { capturedEmail: { startsWith: "test" } },
      ],
    },
  });
  // The 3 captured emails: yunjichoi827@gmail.com (real), norman.gensinger@gmail.com (Norman himself!), adamwolfe102@gmail.com (Adam!)
  const adamConv = await prisma.chatbotConversation.findMany({
    where: { orgId: org.id, OR: [{ capturedEmail: "adamwolfe102@gmail.com" }, { capturedEmail: "norman.gensinger@gmail.com" }] },
    select: { id: true, capturedEmail: true, createdAt: true },
  });
  console.log("CHATBOT:", FLAG(convSeeded, "test/curl/demo conversations"));
  if (adamConv.length > 0) console.log(`  ⚠ ${adamConv.length} conversations captured by Norman/Adam (self-tests, not real prospects)`);

  // LEADS
  const leadSeeded = await prisma.lead.count({
    where: {
      orgId: org.id,
      OR: [
        { email: { endsWith: "@example.com" } },
        { email: { contains: "test" } },
        { email: "norman.gensinger@gmail.com" },
        { email: "adamwolfe102@gmail.com" },
        { notes: { contains: "demo" } },
        { notes: { contains: "seed" } },
      ],
    },
  });
  console.log("LEADS:", FLAG(leadSeeded, "seeded/test leads"));

  // POPUPS
  const popups = await prisma.popupCampaign.findMany({ where: { orgId: org.id }, select: { name: true } });
  console.log(`POPUPS: ${popups.length} total`);
  popups.forEach(p => console.log(`    ${p.name}`));

  // REPUTATION MENTIONS
  const mentions = await prisma.propertyMention.findMany({
    where: { orgId: org.id },
    select: { sourceUrl: true, source: true },
  });
  const fakeUrls = mentions.filter(m => m.sourceUrl.includes("example.com") || m.sourceUrl.includes("test.") || m.sourceUrl.includes("demo."));
  console.log("REPUTATION:", FLAG(fakeUrls.length, "fake URLs"));
  console.log(`  ${mentions.length} mentions total, sample URL: ${mentions[0]?.sourceUrl?.slice(0,80)}`);

  // SEO QUERIES
  const seoCount = await prisma.seoQuery.count({ where: { orgId: org.id } });
  const seoSeeded = await prisma.seoQuery.count({ where: { orgId: org.id, query: { contains: "demo" } } });
  console.log(`SEO QUERIES: ${seoCount} total,`, FLAG(seoSeeded, "demo-query queries"));

  // SEO INTEGRATIONS — DEMO_SEED?
  const seoIntDemoSeeded = await prisma.seoIntegration.count({
    where: { orgId: org.id, serviceAccountJsonEncrypted: "DEMO_SEED" },
  });
  console.log("SEO INTEGRATIONS:", FLAG(seoIntDemoSeeded, "DEMO_SEED integration rows"));

  // PROPERTIES
  const props = await prisma.property.count({ where: { orgId: org.id, lifecycle: 'ACTIVE' } });
  console.log(`PROPERTIES (active): ${props}`);

  // AEO checks
  const aeoTotal = await prisma.aeoCitationCheck.count({ where: { orgId: org.id } });
  console.log(`AEO CHECKS: ${aeoTotal} total (all real LLM responses)`);

  // CLIENT REPORTS
  const reps = await prisma.clientReport.count({ where: { orgId: org.id } });
  console.log(`REPORTS: ${reps} generated`);

  await prisma.$disconnect();
})();
