import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
const prisma = new PrismaClient({ adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as any) });
(async () => {
  const org = await prisma.organization.findFirst({ where: { slug: 'telegraph-commons' } });
  const tc = await prisma.property.findFirst({ where: { orgId: org!.id, lifecycle: 'ACTIVE' } });
  if (!tc) throw new Error("no TC property");
  console.log(`TC property id: ${tc.id}\n`);

  const since30 = new Date(Date.now() - 30*86400000);

  // Count every source of "contact" we could roll up
  const leads = await prisma.lead.count({ where: { orgId: org!.id, propertyId: tc.id } });
  const leads30 = await prisma.lead.count({ where: { orgId: org!.id, propertyId: tc.id, createdAt: { gte: since30 } } });
  const leadsBySrc = await prisma.lead.groupBy({ by: ['source'], where: { orgId: org!.id, propertyId: tc.id }, _count: { _all: true } });

  const visitors = await prisma.visitor.count({ where: { orgId: org!.id, propertyId: tc.id, status: 'IDENTIFIED' } });
  const visitorsOrgWide = await prisma.visitor.count({ where: { orgId: org!.id, status: 'IDENTIFIED' } });

  const chats = await prisma.chatbotConversation.count({ where: { orgId: org!.id, propertyId: tc.id } });
  const chatsOrg = await prisma.chatbotConversation.count({ where: { orgId: org!.id } });

  const tours = await prisma.tour.count({ where: { propertyId: tc.id } });
  const apps = await prisma.application.count({ where: { propertyId: tc.id } });
  const leases = await prisma.lease.count({ where: { orgId: org!.id, propertyId: tc.id } });
  const residents = await prisma.resident.count({ where: { orgId: org!.id, propertyId: tc.id } });

  console.log("=== TC contact funnel ===");
  console.log(`Lead rows (property-scoped):    ${leads}  (${leads30} in last 30d)`);
  leadsBySrc.forEach(s => console.log(`    ${s.source}: ${s._count._all}`));
  console.log(`Identified Visitors (TC):       ${visitors}  (org-wide: ${visitorsOrgWide})`);
  console.log(`Chatbot conversations (TC):     ${chats}  (org-wide: ${chatsOrg})`);
  console.log(`Tours (TC):                     ${tours}`);
  console.log(`Applications (TC):              ${apps}`);
  console.log(`Leases (TC):                    ${leases}`);
  console.log(`Residents (TC):                 ${residents}`);

  console.log("\n=== Suggested rollup math ===");
  console.log(`Captured contacts = Lead + Identified Visitors + Tours + Applications`);
  console.log(`                  = ${leads} + ${visitorsOrgWide} + ${tours} + ${apps} = ${leads + visitorsOrgWide + tours + apps}`);

  await prisma.$disconnect();
})();
