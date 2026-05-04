import { PrismaClient } from "@prisma/client";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: false });
const prisma = new PrismaClient({
  adapter: new PrismaNeonHttp(process.env.DATABASE_URL!, {} as never),
});
async function main() {
  const sg = await prisma.organization.findFirst({
    where: { name: { contains: "SG Real", mode: "insensitive" } },
    select: { id: true, name: true, slug: true },
  });
  if (!sg) { console.log("No SG Real Estate org found"); return; }
  console.log("Org:", sg);
  const sessionCount = await prisma.visitorSession.count({ where: { orgId: sg.id } });
  const visitorCount = await prisma.visitor.count({ where: { orgId: sg.id } });
  const leadCount = await prisma.lead.count({ where: { orgId: sg.id } });
  const cursive = await prisma.cursiveIntegration.findUnique({
    where: { orgId: sg.id },
    select: { cursivePixelId: true, installedOnDomain: true, lastEventAt: true, totalEventsCount: true },
  });
  const sampleSession = await prisma.visitorSession.findFirst({
    where: { orgId: sg.id },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true, firstUrl: true, utmSource: true, utmCampaign: true, anonymousId: true },
  });
  const sampleVisitor = await prisma.visitor.findFirst({
    where: { orgId: sg.id, status: { in: ["IDENTIFIED", "ENRICHED", "MATCHED_TO_LEAD"] } },
    select: { firstName: true, lastName: true, email: true, status: true, utmSource: true },
  });
  console.log({ sessionCount, visitorCount, leadCount, cursive, sampleSession, sampleVisitor });
}
main().catch(console.error).finally(() => process.exit(0));
